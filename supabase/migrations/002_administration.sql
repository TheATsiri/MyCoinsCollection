begin;
create table public.photo_cleanup (
 path text primary key, retry_after timestamptz not null default now(), last_error text,
 created_at timestamptz not null default now()
);
alter table public.photo_cleanup enable row level security;
create policy owner_cleanup on public.photo_cleanup for all to authenticated
 using (public.is_collection_owner()) with check (public.is_collection_owner());
grant select,insert,update,delete on public.photo_cleanup to authenticated;
create table private.coin_submissions (submission_id uuid primary key, coin_id uuid not null, request jsonb not null, created_at timestamptz not null default now());
revoke all on private.coin_submissions from public,anon,authenticated;
create function public.queue_old_photos() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or old.image_path is distinct from new.image_path then
  insert into public.photo_cleanup(path) values(old.image_path) on conflict(path) do update set retry_after=now();
 end if;
 if old.thumbnail_path is not null and (tg_op='DELETE' or old.thumbnail_path is distinct from new.thumbnail_path) then
  insert into public.photo_cleanup(path) values(old.thumbnail_path) on conflict(path) do update set retry_after=now();
 end if;
 return null;
end $$;
create trigger obsolete_photos after update or delete on public.coin_images for each row execute function public.queue_old_photos();
create function public.save_coin(p_submission_id uuid,p_coin jsonb,p_images jsonb,p_references jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_id uuid := (p_coin->>'id')::uuid;
 v_existing public.coins; v_coin public.coins;
 v_request jsonb := jsonb_build_object('coin',p_coin,'images',p_images,'references',p_references);
 v_receipt private.coin_submissions; v_image jsonb; v_reference jsonb; v_slug text;
begin
 if not public.is_collection_owner() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_submission_id is null or v_id is null then raise exception 'Missing submission or coin identifier'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text,0));
 select * into v_receipt from private.coin_submissions where submission_id=p_submission_id;
 if found then
  if v_receipt.request <> v_request then raise exception 'Submission already used with different data'; end if;
  return v_receipt.coin_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,1));
 select * into v_existing from public.coins where id=v_id for update;
 if found and (p_coin->>'expected_updated_at')::timestamptz is distinct from v_existing.updated_at then
  raise exception 'This coin changed. Reload before saving.';
 end if;
 if not found and p_coin->>'expected_updated_at' is not null then raise exception 'Coin no longer exists'; end if;
 v_slug := coalesce(v_existing.slug,p_coin->>'slug');
 select * into v_coin from jsonb_populate_record(null::public.coins,p_coin);
 if jsonb_typeof(p_images) is distinct from 'array' or jsonb_typeof(p_references) is distinct from 'array' then raise exception 'Invalid images or references'; end if;
 if v_existing.id is null and (
   not exists(select 1 from jsonb_array_elements(p_images) x where x->>'side'='obverse') or
   not exists(select 1 from jsonb_array_elements(p_images) x where x->>'side'='reverse')
 ) then raise exception 'Both coin photographs are required'; end if;
 if not exists(select 1 from jsonb_array_elements(p_references) x where x->>'source_url' ~ '^https?://[^[:space:]]+$') then raise exception 'Reference URL is required'; end if;
 insert into public.coins(id,slug,name,issuing_authority,year,denomination,denomination_value,denomination_unit,
 metal,weight_g,diameter_mm,mint,mint_mark,ruler,historical_period,obverse_description,reverse_description,
 historical_notes,grade,grading_system,measurement_source,extra_attributes,is_published,catalogued_at)
 values(v_id,v_slug,v_coin.name,v_coin.issuing_authority,v_coin.year,v_coin.denomination,v_coin.denomination_value,v_coin.denomination_unit,
 v_coin.metal,v_coin.weight_g,v_coin.diameter_mm,v_coin.mint,v_coin.mint_mark,v_coin.ruler,v_coin.historical_period,
 v_coin.obverse_description,v_coin.reverse_description,v_coin.historical_notes,v_coin.grade,v_coin.grading_system,
 v_coin.measurement_source,coalesce(v_coin.extra_attributes,'{}'),coalesce(v_coin.is_published,true),coalesce(v_coin.catalogued_at,current_date))
 on conflict(id) do update set name=excluded.name,issuing_authority=excluded.issuing_authority,year=excluded.year,
 denomination=excluded.denomination,denomination_value=excluded.denomination_value,denomination_unit=excluded.denomination_unit,
 metal=excluded.metal,weight_g=excluded.weight_g,diameter_mm=excluded.diameter_mm,mint=excluded.mint,mint_mark=excluded.mint_mark,
 ruler=excluded.ruler,historical_period=excluded.historical_period,obverse_description=excluded.obverse_description,
 reverse_description=excluded.reverse_description,historical_notes=excluded.historical_notes,grade=excluded.grade,
 grading_system=excluded.grading_system,measurement_source=excluded.measurement_source,extra_attributes=excluded.extra_attributes,
 is_published=excluded.is_published,catalogued_at=excluded.catalogued_at;
 for v_image in select value from jsonb_array_elements(p_images) loop
  if not exists(select 1 from public.coin_images where coin_id=v_id and image_path=v_image->>'image_path') and
     (v_image->>'image_path' not like v_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='coin-photos' and name=v_image->>'image_path')) then
   raise exception 'Photograph upload missing or invalid';
  end if;
  if v_image->>'thumbnail_path' is not null and not exists(select 1 from public.coin_images where coin_id=v_id and thumbnail_path=v_image->>'thumbnail_path') and
     (v_image->>'thumbnail_path' not like v_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='coin-photos' and name=v_image->>'thumbnail_path')) then
   raise exception 'Thumbnail upload missing or invalid';
  end if;
 end loop;
 delete from public.coin_images where coin_id=v_id;
 for v_image in select value from jsonb_array_elements(p_images) loop
  insert into public.coin_images(coin_id,side,image_path,thumbnail_path,alt_text,credit,display_order)
  values(v_id,v_image->>'side',v_image->>'image_path',v_image->>'thumbnail_path',v_image->>'alt_text',v_image->>'credit',coalesce((v_image->>'display_order')::integer,0));
 end loop;
 delete from public.coin_references where coin_id=v_id;
 for v_reference in select value from jsonb_array_elements(p_references) loop
  insert into public.coin_references(coin_id,catalogue,reference_number,edition,source_url)
  values(v_id,v_reference->>'catalogue',v_reference->>'reference_number',v_reference->>'edition',v_reference->>'source_url');
 end loop;
 delete from public.photo_cleanup q where exists(select 1 from public.coin_images i where i.image_path=q.path or i.thumbnail_path=q.path);
 insert into private.coin_submissions(submission_id,coin_id,request) values(p_submission_id,v_id,v_request);
 return v_id;
end $$;
revoke all on function public.save_coin(uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_coin(uuid,jsonb,jsonb,jsonb) to authenticated;
create function public.collection_refresh() returns trigger language plpgsql security definer set search_path='' as $$
declare v_public boolean := false;
begin
 if tg_table_name='coins' then
  if tg_op <> 'INSERT' then v_public := old.is_published; end if;
  if tg_op <> 'DELETE' then v_public := v_public or new.is_published; end if;
 else
  if tg_op <> 'INSERT' then select is_published into v_public from public.coins where id=old.coin_id; end if;
  if tg_op <> 'DELETE' then v_public := coalesce(v_public,false) or coalesce((select is_published from public.coins where id=new.coin_id),false); end if;
 end if;
 if v_public then perform realtime.send('{}'::jsonb,'refresh','public-collection',false); end if;
 return null;
end $$;
create trigger refresh_coins after insert or update or delete on public.coins for each row execute function public.collection_refresh();
create trigger refresh_images after insert or update or delete on public.coin_images for each row execute function public.collection_refresh();
create trigger refresh_references after insert or update or delete on public.coin_references for each row execute function public.collection_refresh();
commit;
