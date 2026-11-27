begin;

insert into public.coins(id, slug, name, issuing_authority, is_published) values
  ('10000000-0000-0000-0000-000000000001', 'feed-one', 'First coin', 'Test', true),
  ('10000000-0000-0000-0000-000000000002', 'feed-two', 'Second coin', 'Test', true),
  ('10000000-0000-0000-0000-000000000003', 'feed-hidden', 'Hidden coin', 'Test', false);

insert into public.coin_reviews(coin_id, display_name, rating, status, created_at)
select ('10000000-0000-0000-0000-00000000000' || coin)::uuid, reviewer, rating, status, created_at
from (values
  (1, 'Newest', 5, 'approved', now()),
  (2, 'Second', 4, 'approved', now() - interval '1 hour'),
  (1, 'Third', 5, 'approved', now() - interval '2 hours'),
  (2, 'Boundary', 2, 'approved', now() - interval '168 hours'),
  (2, 'Expired', 1, 'approved', now() - interval '168 hours 1 second'),
  (1, 'Pending', 1, 'pending', now()),
  (1, 'Rejected', 1, 'rejected', now()),
  (3, 'Hidden', 1, 'approved', now())
) as fixtures(coin, reviewer, rating, status, created_at);

set local role anon;
do $$
declare
  weekly jsonb := public.get_public_reviews(true);
  archive jsonb := public.get_public_reviews();
begin
  if (weekly->>'total')::int <> 4 or (weekly->>'average')::numeric <> 4.0
     or jsonb_array_length(weekly->'items') <> 3 then
    raise exception 'Weekly summary did not use the complete rolling window';
  end if;
  if weekly->'items'->0->>'display_name' <> 'Newest'
     or weekly->'items'->1->>'coin_slug' <> 'feed-two'
     or weekly->'items'->0 ? 'status' then
    raise exception 'Weekly items were not public reviews in date order';
  end if;
  if (archive->>'total')::int <> 5 or archive->'items'->4->>'display_name' <> 'Expired' then
    raise exception 'Archive did not include older public reviews';
  end if;
end;
$$;

reset role;
update public.coin_reviews set status = 'approved' where display_name = 'Pending';
do $$
begin
  if (public.get_public_reviews(true)->>'total')::int <> 5 then
    raise exception 'Approved submission was missing from the weekly feed';
  end if;
end;
$$;

rollback;
