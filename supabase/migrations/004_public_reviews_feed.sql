begin;

create function public.get_public_reviews(
  p_last_week boolean default false,
  p_page integer default 1
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  page_size integer := case when p_last_week then 3 else 10 end;
  result jsonb;
begin
  if p_last_week is null or p_page is null or p_page not between 1 and 10000 then
    raise exception 'Invalid review feed parameters';
  end if;

  with visible as not materialized (
    select r.id, r.display_name, r.rating, r.review_text, r.created_at,
           c.name as coin_name, c.slug as coin_slug
    from public.coin_reviews r
    join public.coins c on c.id = r.coin_id
    where r.status = 'approved' and c.is_published
      and (not p_last_week or r.created_at between now() - interval '168 hours' and now())
  ),
  items as (
    select * from visible
    order by created_at desc, id
    limit page_size offset (p_page - 1) * page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(items) order by created_at desc, id) from items), '[]'::jsonb),
    'total', count(*),
    'average', round(avg(rating), 1)
  )
  into result
  from visible;

  return result;
end;
$$;

revoke all on function public.get_public_reviews(boolean, integer) from public;
grant execute on function public.get_public_reviews(boolean, integer) to anon, authenticated;

commit;
