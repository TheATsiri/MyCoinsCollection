begin;
create table public.coin_reviews (
 id uuid primary key default gen_random_uuid(),
 coin_id uuid not null references public.coins(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 1 and 100),
 rating integer not null check (rating between 1 and 5),
 review_text text check (length(review_text)<=2000),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index reviews_coin_status_date on public.coin_reviews(coin_id,status,created_at desc,id);
create index reviews_moderation on public.coin_reviews(status,created_at desc);
alter table public.coin_reviews enable row level security;
create policy owner_reviews on public.coin_reviews for all to authenticated
 using (public.is_collection_owner()) with check (public.is_collection_owner());
revoke all on public.coin_reviews from public,anon,authenticated;
grant select,delete on public.coin_reviews to authenticated;
grant update(status) on public.coin_reviews to authenticated;
grant all on public.coin_reviews to service_role;
create table private.review_receipts (
 submission_id uuid primary key, coin_id uuid not null references public.coins(id) on delete cascade,
 review_id uuid not null references public.coin_reviews(id) on delete cascade,
 request jsonb not null, actor_hash text not null, created_at timestamptz not null default now()
);
create index review_receipts_actor_date on private.review_receipts(actor_hash,created_at);
revoke all on private.review_receipts from public,anon,authenticated;

-- Only the server function can call this: visitors cannot choose their own rate-limit identity.
create function public.submit_coin_review(p_submission_id uuid,p_coin_id uuid,p_display_name text,p_rating integer,p_review_text text,p_actor_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare v_request jsonb; v_receipt private.review_receipts; v_review_id uuid;
begin
 if p_submission_id is null or p_actor_hash is null or length(p_actor_hash)<>64 then raise exception 'Invalid submission'; end if;
 if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose a rating from 1 to 5'; end if;
 if p_display_name is null or length(trim(p_display_name)) not between 1 and 100 then raise exception 'Enter a display name (1–100 characters)'; end if;
 if length(p_review_text)>2000 then raise exception 'Review must not exceed 2,000 characters'; end if;
 -- A row lock prevents publication/deletion racing the submission.
 perform 1 from public.coins where id=p_coin_id and is_published for share;
 if not found then raise exception 'Coin not found' using errcode='P0002'; end if;
 v_request := jsonb_build_object('name',trim(p_display_name),'rating',p_rating,'text',nullif(trim(p_review_text),''));
 perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text,3));
 select * into v_receipt from private.review_receipts where submission_id=p_submission_id;
 if found then
  if v_receipt.coin_id<>p_coin_id or v_receipt.request<>v_request or v_receipt.actor_hash<>p_actor_hash then
   raise exception 'Submission already used with different data';
  end if;
  return;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_hash,4));
 if (select count(*) from private.review_receipts where actor_hash=p_actor_hash and created_at>now()-interval '1 hour')>=5 then
  raise exception 'Too many reviews. Please try again in an hour.' using errcode='P0003';
 end if;
 -- Receipt retention is limited; reviews remain until deleted by the owner or coin deletion.
 delete from private.review_receipts where created_at<now()-interval '7 days';
 insert into public.coin_reviews(coin_id,display_name,rating,review_text)
 values(p_coin_id,trim(p_display_name),p_rating,nullif(trim(p_review_text),'')) returning id into v_review_id;
 insert into private.review_receipts(submission_id,coin_id,review_id,request,actor_hash) values(p_submission_id,p_coin_id,v_review_id,v_request,p_actor_hash);
end $$;
revoke all on function public.submit_coin_review(uuid,uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.submit_coin_review(uuid,uuid,text,integer,text,text) to service_role;

-- Explicit projection avoids exposing moderation state or future private columns.
create function public.get_coin_reviews(p_coin_id uuid,p_sort text default 'newest',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if p_sort is null or p_sort not in ('newest','oldest','highest','lowest') then raise exception 'Invalid sort'; end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid page'; end if;
 if not exists(select 1 from public.coins where id=p_coin_id and is_published) then raise exception 'Coin not found' using errcode='P0002'; end if;
 with approved as materialized (select id,display_name,rating,review_text,created_at from public.coin_reviews where coin_id=p_coin_id and status='approved'),
 ranked as (select *,row_number() over(order by
  case when p_sort='highest' then rating end desc,
  case when p_sort='lowest' then rating end asc,
  case when p_sort='oldest' then created_at end asc,
  case when p_sort<>'oldest' then created_at end desc,id) rn from approved),
 items as (select to_jsonb(r)-'rn' item,rn from ranked r where rn>(p_page-1)*10 and rn<=p_page*10),
 levels as (select s,count(a.id) total from generate_series(1,5) s left join approved a on a.rating=s group by s)
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(item order by rn) from items),'[]'::jsonb),
  'total',(select count(*) from approved),
  'written_count',(select count(*) from approved where review_text is not null),
  'average',(select round(avg(rating),1) from approved),
  'distribution',(select jsonb_object_agg(s,total) from levels)) into v_result;
 return v_result;
end $$;
revoke all on function public.get_coin_reviews(uuid,text,integer) from public;
grant execute on function public.get_coin_reviews(uuid,text,integer) to anon,authenticated;

create function public.search_admin_reviews(p_coin_id uuid default null,p_rating integer default null,p_status text default '',p_query text default '',p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if not public.is_collection_owner() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 10000 or length(p_query)>200 or p_query is null then raise exception 'Invalid search'; end if;
 if p_rating is not null and p_rating not between 1 and 5 then raise exception 'Invalid rating'; end if;
 if p_status is null or p_status not in ('','pending','approved','rejected') then raise exception 'Invalid status'; end if;
 with filtered as materialized (
  select r.*,jsonb_build_object('name',c.name) coins from public.coin_reviews r join public.coins c on c.id=r.coin_id
  where (p_coin_id is null or r.coin_id=p_coin_id) and (p_rating is null or r.rating=p_rating)
  and (p_status='' or r.status=p_status) and (p_query='' or strpos(lower(c.name||' '||r.display_name),lower(trim(p_query)))>0)
 ), items as (select * from filtered order by created_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by created_at desc,id) from items i),'[]'::jsonb),'total',(select count(*) from filtered)) into v_result;
 return v_result;
end $$;
revoke all on function public.search_admin_reviews(uuid,integer,text,text,integer) from public,anon;
grant execute on function public.search_admin_reviews(uuid,integer,text,text,integer) to authenticated;

create function public.review_refresh() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then new.updated_at=now(); end if;
 if (tg_op<>'INSERT' and old.status='approved') or (tg_op<>'DELETE' and new.status='approved') then
  perform realtime.send('{}'::jsonb,'refresh','public-collection',false);
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger refresh_reviews before insert or update or delete on public.coin_reviews for each row execute function public.review_refresh();
commit;
