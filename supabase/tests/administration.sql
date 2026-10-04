begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000020'),('00000000-0000-0000-0000-000000000021');
insert into private.admin_users(user_id) values('00000000-0000-0000-0000-000000000020');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000021"}',true);
do $$ begin
 begin perform public.save_coin(gen_random_uuid(),'{}','[]','[]'); raise exception 'FAIL non-owner save'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000020"}',true);
insert into storage.objects(bucket_id,name) values
 ('coin-photos','00000000-0000-0000-0000-000000000022/obverse.webp'),
 ('coin-photos','00000000-0000-0000-0000-000000000022/reverse.webp');
do $$ declare
 coin jsonb := '{"id":"00000000-0000-0000-0000-000000000022","slug":"admin-test","name":"Admin coin","issuing_authority":"Testland","is_published":false}';
 images jsonb := '[{"side":"obverse","image_path":"00000000-0000-0000-0000-000000000022/obverse.webp","alt_text":"Front"},{"side":"reverse","image_path":"00000000-0000-0000-0000-000000000022/reverse.webp","alt_text":"Back"}]';
 refs jsonb := '[{"catalogue":"Website","reference_number":"","source_url":"https://example.com/coin"}]';
 submission uuid := '00000000-0000-0000-0000-000000000023'; v_id uuid;
begin
 v_id := public.save_coin(submission,coin,images,refs);
 if public.save_coin(submission,coin,images,refs) <> v_id then raise exception 'FAIL idempotent return'; end if;
 if (select count(*) from public.coin_images where coin_id=v_id)<>2 then raise exception 'FAIL duplicate photos'; end if;
 begin
  perform public.save_coin(submission,coin||'{"name":"Different"}',images,refs);
  raise exception 'FAIL reused request allowed';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 coin := coin || jsonb_build_object('expected_updated_at',(select updated_at from public.coins where id=v_id),'is_published',true,'slug','changed-slug');
 perform public.save_coin(gen_random_uuid(),coin,images,refs);
 if (select slug from public.coins where id=v_id)<>'admin-test' then raise exception 'FAIL changed slug'; end if;
 if exists(select 1 from public.photo_cleanup where path like v_id::text||'/%') then raise exception 'FAIL referenced photos queued'; end if;
 begin
  perform public.save_coin(gen_random_uuid(),coin||'{"expected_updated_at":"2000-01-01T00:00:00Z"}',images,refs);
  raise exception 'FAIL stale edit accepted';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin
  perform public.save_coin(gen_random_uuid(),coin||jsonb_build_object('expected_updated_at',(select updated_at from public.coins where id=v_id),'name','Should roll back'), '[{"side":"obverse","image_path":"invalid.webp","alt_text":"X"}]',refs);
  raise exception 'FAIL missing upload accepted';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 if (select name from public.coins where id=v_id)<>'Admin coin' then raise exception 'FAIL partial update survived'; end if;
 delete from public.coins where id=v_id;
 if (select count(*) from public.photo_cleanup where path like v_id::text||'/%')<>2 then raise exception 'FAIL deletion cleanup missing'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from realtime.test_events where topic='public-collection' and (payload<>'{}'::jsonb or private or event<>'refresh')) then raise exception 'FAIL event disclosure'; end if;
 if not exists(select 1 from realtime.test_events where topic='public-collection') then raise exception 'FAIL no live event'; end if;
end $$;
rollback;
