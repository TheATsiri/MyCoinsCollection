begin;
insert into public.coins(id,slug,name,issuing_authority,is_published) values
 ('10000000-0000-0000-0000-000000000001','review-one','Review one','Test',true),
 ('10000000-0000-0000-0000-000000000002','review-two','Review two','Test',true),
 ('10000000-0000-0000-0000-000000000003','review-hidden','Review hidden','Test',false);
select public.submit_coin_review('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Collector',5,'A lovely coin',repeat('a',64));
select public.submit_coin_review('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Collector',5,'A lovely coin',repeat('a',64));
do $$ begin
 if (select count(*) from public.coin_reviews where coin_id='10000000-0000-0000-0000-000000000001')<>1 then raise exception 'Duplicate receipt failed'; end if;
 if (public.get_coin_reviews('10000000-0000-0000-0000-000000000001')->>'total')::int<>0 then raise exception 'Pending review leaked'; end if;
 if public.get_coin_reviews('10000000-0000-0000-0000-000000000001')->'average'<>'null'::jsonb then raise exception 'Empty average must be null'; end if;
 begin
  perform public.submit_coin_review('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Collector',5,'A lovely coin',repeat('a',64));
  raise exception 'Cross-coin receipt accepted';
 exception when raise_exception then if sqlerrm='Cross-coin receipt accepted' then raise; end if; end;
 begin
  perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','Collector',0,'',repeat('a',64));
  raise exception 'Invalid rating accepted';
 exception when raise_exception then if sqlerrm='Invalid rating accepted' then raise; end if; end;
 begin
  perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','Collector',null,'',repeat('a',64));
  raise exception 'Null rating accepted';
 exception when raise_exception then if sqlerrm='Null rating accepted' then raise; end if; end;
 begin
  perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','',5,'',repeat('a',64));
  raise exception 'Empty name accepted';
 exception when raise_exception then if sqlerrm='Empty name accepted' then raise; end if; end;
 begin
  perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','Collector',5,repeat('x',2001),repeat('a',64));
  raise exception 'Oversized review accepted';
 exception when raise_exception then if sqlerrm='Oversized review accepted' then raise; end if; end;
 begin
  perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000099','Collector',5,'',repeat('a',64));
  raise exception 'Missing coin accepted';
 exception when no_data_found then null; end;
 begin
  perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000003','Collector',5,'',repeat('a',64));
  raise exception 'Hidden coin accepted';
 exception when no_data_found then null; end;
end $$;
select public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','Rating only',3,'',repeat('a',64));
update public.coin_reviews set status='approved' where coin_id='10000000-0000-0000-0000-000000000001';
do $$ declare result jsonb; begin
 result=public.get_coin_reviews('10000000-0000-0000-0000-000000000001','highest');
 if (result->>'total')::int<>2 or (result->>'written_count')::int<>1 or (result->>'average')::numeric<>4 then raise exception 'Incorrect aggregate'; end if;
 if (result->'distribution'->>'5')::int<>1 or (result->'distribution'->>'3')::int<>1 then raise exception 'Incorrect distribution'; end if;
 if (result->'items'->0->>'rating')::int<>5 then raise exception 'Highest sort failed'; end if;
 if (public.get_coin_reviews('10000000-0000-0000-0000-000000000001','lowest')->'items'->0->>'rating')::int<>3 then raise exception 'Lowest sort failed'; end if;
 if (public.get_coin_reviews('10000000-0000-0000-0000-000000000002')->>'total')::int<>0 then raise exception 'Reviews crossed coins'; end if;
 if result->'items'->0 ? 'status' or result->'items'->0 ? 'coin_id' then raise exception 'Private fields leaked'; end if;
 if not exists(select 1 from realtime.test_events where topic='public-collection') then raise exception 'Approval did not broadcast'; end if;
end $$;
update public.coin_reviews set status='rejected' where display_name='Rating only';
do $$ begin
 if (public.get_coin_reviews('10000000-0000-0000-0000-000000000001')->>'average')::numeric<>5 then raise exception 'Rejected included in summary'; end if;
 for i in 1..3 loop perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','Rate test',4,'',repeat('a',64)); end loop;
 begin
  perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','Rate test',4,'',repeat('a',64));
  raise exception 'Rate limit bypassed';
 exception when sqlstate 'P0003' then null; end;
end $$;
set local role anon;
do $$ begin
 perform public.get_coin_reviews('10000000-0000-0000-0000-000000000001');
 begin perform 1 from public.coin_reviews; raise exception 'Anonymous direct table read'; exception when insufficient_privilege then null; end;
 begin perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','Forged',5,'',repeat('b',64)); raise exception 'Anonymous write bypass'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into auth.users(id) values('30000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000002');
insert into private.admin_users values('30000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000002"}',true);
do $$ begin
 if exists(select 1 from public.coin_reviews) then raise exception 'Non-owner read reviews'; end if;
 update public.coin_reviews set status='approved'; if found then raise exception 'Non-owner moderation'; end if;
 begin perform public.search_admin_reviews(); raise exception 'Non-owner admin search'; exception when insufficient_privilege then null; end;
 begin perform public.submit_coin_review(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','Forged',5,'',repeat('b',64)); raise exception 'Authenticated write bypass'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001"}',true);
do $$ begin
 if (public.search_admin_reviews(p_query=>'Review one')->>'total')::int<>5 then raise exception 'Coin name search failed'; end if;
 if (public.search_admin_reviews(p_query=>'Collector',p_rating=>5,p_status=>'approved')->>'total')::int<>1 then raise exception 'Admin filters failed'; end if;
 if (public.search_admin_reviews(p_query=>'%')->>'total')::int<>0 then raise exception 'Search wildcard not literal'; end if;
 begin update public.coin_reviews set coin_id='10000000-0000-0000-0000-000000000002'; raise exception 'Owner could reassign coin'; exception when insufficient_privilege then null; end;
 update public.coin_reviews set status='approved' where status='pending';
 delete from public.coin_reviews where display_name='Rate test';
end $$;
reset role;
-- Verify page size and stable sort with a larger result set.
insert into public.coin_reviews(coin_id,display_name,rating,status,created_at)
select '10000000-0000-0000-0000-000000000002','Page '||n,4,'approved',now()+n*interval '1 second' from generate_series(1,12) n;
do $$ declare a jsonb; b jsonb; begin
 a=public.get_coin_reviews('10000000-0000-0000-0000-000000000002','newest',1);
 b=public.get_coin_reviews('10000000-0000-0000-0000-000000000002','newest',2);
 if jsonb_array_length(a->'items')<>10 or jsonb_array_length(b->'items')<>2 then raise exception 'Review pagination failed'; end if;
 if a->'items'->0->>'display_name'<>'Page 12' then raise exception 'Newest sort failed'; end if;
 if public.get_coin_reviews('10000000-0000-0000-0000-000000000002','oldest')->'items'->0->>'display_name'<>'Page 1' then raise exception 'Oldest sort failed'; end if;
end $$;
delete from public.coins where id='10000000-0000-0000-0000-000000000001';
do $$ begin
 if exists(select 1 from public.coin_reviews where coin_id='10000000-0000-0000-0000-000000000001') or exists(select 1 from private.review_receipts where coin_id='10000000-0000-0000-0000-000000000001') then raise exception 'Coin deletion cascade failed'; end if;
end $$;
rollback;
