-- Run once in Supabase SQL Editor. PostgreSQL privileges + RLS enforce access.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on private.admin_users from public, anon, authenticated;
create function public.is_collection_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from private.admin_users where user_id = auth.uid()) $$;
revoke all on function public.is_collection_owner() from public;
grant execute on function public.is_collection_owner() to authenticated;

create table public.coins (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check (length(trim(name)) between 1 and 200),
 issuing_authority text not null check (length(trim(issuing_authority)) between 1 and 200),
 year integer check (year between 1 and 9999),
 denomination text, denomination_value numeric(18,6) check (denomination_value >= 0), denomination_unit text,
 metal text, weight_g numeric(12,4) check (weight_g > 0), diameter_mm numeric(12,4) check (diameter_mm > 0),
 mint text, mint_mark text, ruler text, historical_period text,
 obverse_description text, reverse_description text, historical_notes text,
 grade text, grading_system text, measurement_source text,
 extra_attributes jsonb not null default '{}' check (jsonb_typeof(extra_attributes) = 'object'),
 is_published boolean not null default false,
 catalogued_at date not null default current_date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.coin_images (
 id uuid primary key default gen_random_uuid(),
 coin_id uuid not null references public.coins(id) on delete cascade,
 side text not null check (side in ('obverse','reverse','edge','other')),
 image_path text not null unique check (length(image_path)>0),
 thumbnail_path text, alt_text text not null check (length(trim(alt_text))>0),
 credit text, display_order integer not null default 0 check (display_order>=0)
);
create table public.coin_references (
 id uuid primary key default gen_random_uuid(),
 coin_id uuid not null references public.coins(id) on delete cascade,
 catalogue text not null, reference_number text not null, edition text,
 source_url text check (source_url is null or source_url ~ '^https?://')
);
create table public.coin_private_details (
 coin_id uuid primary key references public.coins(id) on delete cascade,
 acquisition_date date,
 purchase_price numeric(18,2) check (purchase_price >= 0),
 purchase_currency text check (purchase_currency ~ '^[A-Z]{3}$'),
 estimated_value numeric(18,2) check (estimated_value >= 0),
 estimated_currency text check (estimated_currency ~ '^[A-Z]{3}$'),
 valuation_date date, valuation_source text, personal_notes text,
 check (purchase_price is null or purchase_currency is not null),
 check (estimated_value is null or estimated_currency is not null)
);
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.coin_categories (
 coin_id uuid not null references public.coins(id) on delete cascade,
 category_id uuid not null references public.categories(id) on delete cascade,
 primary key (coin_id,category_id)
);
create index coins_public_year on public.coins(year desc) where is_published;
create index coins_public_country on public.coins(issuing_authority) where is_published;
create index coins_public_catalogued on public.coins(catalogued_at desc) where is_published;
create index coin_images_coin on public.coin_images(coin_id);
create index coin_references_coin on public.coin_references(coin_id);
create index coin_categories_category on public.coin_categories(category_id);
create function public.touch_coin() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger coins_updated before update on public.coins for each row execute function public.touch_coin();

alter table public.coins enable row level security;
alter table public.coin_images enable row level security;
alter table public.coin_references enable row level security;
alter table public.coin_private_details enable row level security;
alter table public.categories enable row level security;
alter table public.coin_categories enable row level security;
create policy published_coins on public.coins for select to anon, authenticated using (is_published);
create policy published_images on public.coin_images for select to anon, authenticated
 using (exists(select 1 from public.coins c where c.id=coin_id and c.is_published));
create policy published_references on public.coin_references for select to anon, authenticated
 using (exists(select 1 from public.coins c where c.id=coin_id and c.is_published));
create policy published_membership on public.coin_categories for select to anon, authenticated
 using (exists(select 1 from public.coins c where c.id=coin_id and c.is_published));
create policy published_categories on public.categories for select to anon, authenticated
 using (exists(select 1 from public.coin_categories cc join public.coins c on c.id=cc.coin_id where cc.category_id=categories.id and c.is_published));
create policy owner_coins on public.coins for all to authenticated using (public.is_collection_owner()) with check (public.is_collection_owner());
create policy owner_images on public.coin_images for all to authenticated using (public.is_collection_owner()) with check (public.is_collection_owner());
create policy owner_references on public.coin_references for all to authenticated using (public.is_collection_owner()) with check (public.is_collection_owner());
create policy owner_private on public.coin_private_details for all to authenticated using (public.is_collection_owner()) with check (public.is_collection_owner());
create policy owner_categories on public.categories for all to authenticated using (public.is_collection_owner()) with check (public.is_collection_owner());
create policy owner_membership on public.coin_categories for all to authenticated using (public.is_collection_owner()) with check (public.is_collection_owner());

revoke all on public.coins, public.coin_images, public.coin_references, public.coin_private_details, public.categories, public.coin_categories from anon, authenticated;
grant select on public.coins, public.coin_images, public.coin_references, public.categories, public.coin_categories to anon;
grant select,insert,update,delete on public.coins, public.coin_images, public.coin_references, public.coin_private_details, public.categories, public.coin_categories to authenticated;

create function public.search_coins(
 p_query text default '', p_country text default '',
 p_year_from integer default null, p_year_to integer default null,
 p_period text default '', p_denomination text default '', p_metal text default '', p_grade text default '',
 p_sort text default 'year_desc', p_page integer default 1
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
 if p_page is null or p_page < 1 or p_page > 10000 then raise exception 'Invalid page'; end if;
 if p_sort is null or p_sort not in ('year_desc','year_asc','country','denomination','added') then raise exception 'Invalid sort'; end if;
 if length(p_query)>200 then raise exception 'Search too long'; end if;
 if (p_year_from is not null and p_year_from not between 1 and 9999)
 or (p_year_to is not null and p_year_to not between 1 and 9999)
 or (p_year_from is not null and p_year_to is not null and p_year_from>p_year_to)
 then raise exception 'Invalid year range'; end if;
 with filtered as materialized (
  select c.* from public.coins c where c.is_published
  and (coalesce(p_country,'')='' or c.issuing_authority=p_country)
  and (p_year_from is null or c.year>=p_year_from) and (p_year_to is null or c.year<=p_year_to)
  and (coalesce(p_period,'')='' or c.historical_period=p_period)
  and (coalesce(p_denomination,'')='' or c.denomination=p_denomination)
  and (coalesce(p_metal,'')='' or c.metal=p_metal)
  and (coalesce(p_grade,'')='' or c.grade=p_grade)
  and (coalesce(trim(p_query),'')='' or
   strpos(lower(concat_ws(' ',c.name,c.issuing_authority,c.obverse_description,c.reverse_description,c.historical_notes)),lower(trim(p_query)))>0
   or exists(select 1 from public.coin_references r where r.coin_id=c.id and strpos(lower(concat_ws(' ',r.catalogue,r.reference_number)),lower(trim(p_query)))>0))
 ), ranked as (
  select c.*, row_number() over(order by
   case when p_sort='year_desc' then c.year end desc nulls last,
   case when p_sort='year_asc' then c.year end asc nulls last,
   case when p_sort='country' then c.issuing_authority end asc nulls last,
   case when p_sort='denomination' then c.denomination_unit end asc nulls last,
   case when p_sort='denomination' then c.denomination_value end asc nulls last,
   case when p_sort='added' then c.catalogued_at end desc nulls last, c.id asc) as rn
  from filtered c
 ), page_items as (
  select (to_jsonb(c)-'rn') || jsonb_build_object(
   'coin_images',coalesce((select jsonb_agg(to_jsonb(i) order by i.display_order,i.id) from public.coin_images i where i.coin_id=c.id),'[]'::jsonb),
   'coin_references',coalesce((select jsonb_agg(to_jsonb(r) order by r.catalogue,r.reference_number) from public.coin_references r where r.coin_id=c.id),'[]'::jsonb)
  ) as item,c.rn from ranked c where rn>(p_page-1)*24 and rn<=p_page*24
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by rn) from page_items),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
 return result;
end $$;

create function public.get_filter_options() returns jsonb language sql stable security invoker set search_path = '' as $$
with c as materialized (select * from public.coins where is_published)
select jsonb_build_object(
 'countries',coalesce((select jsonb_agg(v order by v) from (select distinct issuing_authority v from c where issuing_authority is not null) x),'[]'::jsonb),
 'periods',coalesce((select jsonb_agg(v order by v) from (select distinct historical_period v from c where historical_period is not null and historical_period<>'') x),'[]'::jsonb),
 'denominations',coalesce((select jsonb_agg(v order by v) from (select distinct denomination v from c where denomination is not null and denomination<>'') x),'[]'::jsonb),
 'metals',coalesce((select jsonb_agg(v order by v) from (select distinct metal v from c where metal is not null and metal<>'') x),'[]'::jsonb),
 'grades',coalesce((select jsonb_agg(v order by v) from (select distinct grade v from c where grade is not null and grade<>'') x),'[]'::jsonb)
) $$;
revoke all on function public.search_coins(text,text,integer,integer,text,text,text,text,text,integer) from public;
revoke all on function public.get_filter_options() from public;
grant execute on function public.search_coins(text,text,integer,integer,text,text,text,text,text,integer), public.get_filter_options() to anon,authenticated;

-- Public photos are public by URL, even after a coin is unpublished.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('coin-photos','coin-photos',true,2097152,array['image/webp','image/jpeg','image/png'])
 on conflict (id) do nothing;
create policy owner_photo_insert on storage.objects for insert to authenticated
 with check (bucket_id='coin-photos' and public.is_collection_owner());
create policy owner_photo_update on storage.objects for update to authenticated
 using (bucket_id='coin-photos' and public.is_collection_owner())
 with check (bucket_id='coin-photos' and public.is_collection_owner());
create policy owner_photo_delete on storage.objects for delete to authenticated
 using (bucket_id='coin-photos' and public.is_collection_owner());
create policy owner_photo_metadata on storage.objects for select to authenticated
 using (bucket_id='coin-photos' and public.is_collection_owner());
commit;
