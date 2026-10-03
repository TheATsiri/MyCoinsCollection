-- Run after migration 001 in SQL Editor. All fixtures roll back.
begin;
insert into public.coins(id,slug,name,issuing_authority,is_published) values
 ('00000000-0000-0000-0000-000000000001','policy-public','Policy public fixture','Testland',true),
 ('00000000-0000-0000-0000-000000000002','policy-draft','Policy draft fixture','Secretland',false);
insert into public.coin_images(coin_id,side,image_path,alt_text) values
 ('00000000-0000-0000-0000-000000000002','obverse','security-test/draft.webp','Secret draft image');
insert into public.coin_private_details(coin_id,purchase_price,purchase_currency,personal_notes) values
 ('00000000-0000-0000-0000-000000000001',999,'EUR','PRIVATE_SENTINEL');
set local role anon;
do $$
declare result jsonb; affected integer;
begin
 if (select count(*) from public.coins where slug='policy-draft')<>0 then raise exception 'FAIL: draft disclosed'; end if;
 if (select count(*) from public.coin_images where image_path='security-test/draft.webp')<>0 then raise exception 'FAIL: draft metadata disclosed'; end if;
 result := public.search_coins(p_query=>'Policy');
 if result::text like '%PRIVATE_SENTINEL%' or result::text like '%policy-draft%' then raise exception 'FAIL: search disclosure'; end if;
 if not (result->'items') @> '[{"slug":"policy-public"}]'::jsonb then raise exception 'FAIL: published coin missing'; end if;
 if public.get_filter_options()::text like '%Secretland%' then raise exception 'FAIL: draft filter disclosure'; end if;
 begin
  perform * from public.coin_private_details;
  raise exception 'FAIL: anonymous private table access';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.coins(slug,name,issuing_authority) values ('unauthorized','Forbidden','Test');
  raise exception 'FAIL: anonymous insert';
 exception when insufficient_privilege then null; end;
 begin
  update public.coins set name='Forbidden' where slug='policy-public';
  get diagnostics affected=row_count;
  if affected>0 then raise exception 'FAIL: anonymous update'; end if;
 exception when insufficient_privilege then null; end;
 begin
  delete from public.coins where slug='policy-public';
  get diagnostics affected=row_count;
  if affected>0 then raise exception 'FAIL: anonymous delete'; end if;
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name) values ('coin-photos','security-test/forbidden.webp');
  raise exception 'FAIL: anonymous upload';
 exception when insufficient_privilege then null; end;
 raise notice 'PASS: anonymous publication and write boundaries';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}',true);
do $$
declare affected integer;
begin
 if public.is_collection_owner() then raise exception 'FAIL: non-owner elevated'; end if;
 if (select count(*) from public.coin_private_details)>0 then raise exception 'FAIL: authenticated non-owner private read'; end if;
 if (select count(*) from public.coins where slug='policy-draft')>0 then raise exception 'FAIL: authenticated draft read'; end if;
 update public.coins set name='Forbidden' where slug='policy-public';
 get diagnostics affected=row_count;
 if affected>0 then raise exception 'FAIL: authenticated non-owner update'; end if;
 begin
  insert into public.coins(slug,name,issuing_authority) values ('unauthorized-user','Forbidden','Test');
  raise exception 'FAIL: authenticated non-owner insert';
 exception when insufficient_privilege then null; end;
 raise notice 'PASS: authenticated non-owner boundaries';
end $$;
reset role;
rollback;
