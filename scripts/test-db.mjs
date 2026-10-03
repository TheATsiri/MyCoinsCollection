import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite()
try {
  await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
  $$;
  grant usage on schema auth,storage to anon,authenticated;
  grant execute on function auth.uid() to anon,authenticated;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to anon,authenticated;
 `)
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/001_collection.sql', import.meta.url),
      'utf8',
    ),
  )
  await db.exec(
    await readFile(
      new URL('../supabase/tests/security.sql', import.meta.url),
      'utf8',
    ),
  )
  await db.exec(`insert into public.coins(slug,name,issuing_authority,year,is_published)
  select 'test-'||i,'Specimen '||i,'Filterland',2000+i,true from generate_series(1,55) i;
  insert into public.coin_references(coin_id,catalogue,reference_number)
   select id,'Catalogue','REF-XYZ' from public.coins where slug='test-1';`)
  const result = await db.query(
    "select public.search_coins(p_country=>'Filterland',p_sort=>'year_asc',p_page=>2) result",
  )
  assert.equal(result.rows[0].result.total, 55)
  assert.equal(result.rows[0].result.items.length, 24)
  assert.equal(result.rows[0].result.items[0].year, 2025)
  const reference = await db.query(
    "select public.search_coins(p_query=>'ref-xyz') result",
  )
  assert.equal(reference.rows[0].result.total, 1)
  const wildcard = await db.query(
    "select public.search_coins(p_query=>'%') result",
  )
  assert.equal(wildcard.rows[0].result.total, 0)
  await assert.rejects(
    db.query("select public.search_coins(p_sort=>'malicious')"),
    /Invalid sort/,
  )
  await assert.rejects(
    db.query('select public.search_coins(p_year_from=>2020,p_year_to=>1900)'),
    /Invalid year/,
  )
  await db.exec(`
 begin;
 insert into auth.users(id) values ('00000000-0000-0000-0000-000000000010');
 insert into private.admin_users(user_id) values ('00000000-0000-0000-0000-000000000010');
 set local role authenticated;
 select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
 insert into public.coins(id,slug,name,issuing_authority) values ('00000000-0000-0000-0000-000000000011','owner-draft','Owner draft','Testland');
 insert into public.coin_private_details(coin_id,personal_notes) values ('00000000-0000-0000-0000-000000000011','Owner secret');
 insert into storage.objects(bucket_id,name) values ('coin-photos','owner/test.webp');
 do $$ begin
  if not public.is_collection_owner() then raise exception 'Owner permission missing'; end if;
  if (select personal_notes from public.coin_private_details where coin_id='00000000-0000-0000-0000-000000000011')<>'Owner secret' then raise exception 'Owner private read failed'; end if;
  update public.coins set name='Updated owner draft' where slug='owner-draft';
  if (select name from public.coins where slug='owner-draft')<>'Updated owner draft' then raise exception 'Owner update failed'; end if;
 end $$;
 rollback;`)
  console.log(
    'PASS: migration, anonymous/non-owner RLS, authorized owner writes, storage policies, reference search, literal keywords, pagination and input validation',
  )
  console.log(
    'Note: auth/storage scaffolding is local. Repeat the SQL security checks on your hosted Supabase project.',
  )
} finally {
  await db.close()
}
