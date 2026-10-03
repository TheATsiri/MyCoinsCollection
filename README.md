# My Coin Collection

A light museum-style coin catalogue built with React, TypeScript, Vite, and Supabase. The first release uses the Supabase dashboard for administration. A custom login/editor is a later milestone.

## Start locally

Requirements: Node.js 24 LTS and npm. Git is already initialized in this folder.

```powershell
cd C:\Users\atsiriplis\Code\CodeX\MyCoinsCollectionWebSite
npm ci
npm run dev
```

Open the localhost address printed by Vite, normally http://127.0.0.1:5173.

With no Supabase settings, the site shows **clearly labelled sample records and original illustrative coin artwork**. These are not the owner's coins or verified catalogue references. No genuine specimen photos were supplied. Hero illustrations remain labelled artwork in live mode; replace them with owner photographs when available.

## What is implemented

- Responsive home, collection, about, individual coin pages and not-found states.
- Original vector logo, museum palette, subtle hover effects and reduced-motion support.
- Obverse/reverse gallery switching; enlarged images in a native dialog with keyboard controls and focus restoration.
- Keyword search, country, year, period, denomination, metal and grade filters.
- Shareable URL filters, five sort choices, and 24-item server-side pagination.
- Live Supabase query module; refetch on navigation and window focus.
- Database schema, publication rules, separate private ownership details, references and categories.
- Single-owner database authorization ready for a future authenticated admin interface.
- Tests, photo preparation instructions, security headers and Cloudflare deployment configuration.

There is no custom admin UI, continuous realtime subscription, server-rendered SEO or visitor account system in this release.

## Connect your database

1. Create a **Free** project at https://supabase.com/dashboard, preferably in a European region.
2. In SQL Editor, run `supabase/migrations/001_collection.sql` once. It creates the tables, search functions, policies and photo bucket. Save subsequent database changes as new migration files.
3. Run `supabase/tests/security.sql` in SQL Editor. It creates temporary fixtures, checks public/private permissions, and rolls back. Any raised exception indicates a failed check.
4. Copy `.env.example` to `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project's connection settings. Leave `VITE_DEMO_MODE=false`.
6. Restart the development server. In hosting, changing these variables requires a rebuild.

**The URL and publishable key are public browser settings.** Never use a secret key, database password or legacy service-role key in this app. Every `VITE_*` value is compiled into frontend code.

Setting only one connection value is an error, not a switch back to demonstration data. A configured service failure shows an unavailable message instead of sample coins.

Schema types are checked into `src/types/database.ts`. After migration, regenerate them from the real project:

```powershell
npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public |
  Set-Content -Encoding utf8 src/types/database.ts
```

This command requires Supabase CLI authentication; use `npx supabase login` locally and keep its token out of Git. The public UI type remains separate from private details.

## Add your first specimen

Use Supabase Table Editor with your owner dashboard account. Create one `coins` row:

- `name`: your verified coin name.
- `slug`: unique lower-case URL identifier, for example `germany-2-euros-2002-specimen-1`.
- `issuing_authority`: Germany.
- `year`: 2002.
- `denomination`: 2 euros.
- `denomination_value`: 2.
- `denomination_unit`: EUR.
- `is_published`: false until content is ready.

Copy its generated UUID for associated images and references. Record metal, mint, weight and other details only when verified. Leave unknown values null. Use `measurement_source` to distinguish catalogue specifications from measurements of your specimen.

Add private acquisition, financial and personal notes to `coin_private_details`, using the same coin UUID. Never put private details in public historical notes or `extra_attributes`.

Publish by setting `is_published=true`. Changes appear on the next navigation, reload or window refocus without redeploying.

Each row is an individual physical specimen. Duplicate types are allowed with different IDs/slugs. Public date sorting uses `catalogued_at`, not the private acquisition date. Denomination sorting groups denomination units, then orders numeric amounts; it does not convert between currencies.

Add references to `coin_references` with catalogue, number, optional edition and source URL. Grade and grading system are separate fields. Store uncommon public attributes in the JSON object `extra_attributes`; promote frequently filtered attributes to typed columns later.

## Prepare and upload photographs

Keep original files backed up outside this repository. Do not clean or digitally retouch a coin to make its grade appear better.

Create two exports per side:

- Detailed photo: maximum 1,600 pixels, WebP, approximately 400 KB.
- Thumbnail: maximum 400 pixels, WebP, approximately 50 KB.

You can use your normal photo editor or the included tool:

```powershell
npm run photos -- "C:\Photos\obverse.jpg" "C:\Photos\prepared" "SPECIMEN_UUID" "obverse"
```

The tool corrects orientation, preserves the whole image, strips metadata, and writes unique detailed/thumbnail files. Upload both into the matching UUID folder in Storage → `coin-photos`.

Create a `coin_images` row with coin ID, side, both storage paths, useful alt text, optional credit and display order. Paths are relative to the bucket, not full URLs. Supported uploads: WebP, JPEG and PNG, up to 2 MB per file. Demo SVG illustrations are local assets, not bucket uploads.

**The photo bucket is public.** Its URLs remain public even when a coin is unpublished. Keep drafts/originals locally. To withdraw a published photograph, delete the storage object as well as its metadata; previously downloaded copies cannot be revoked.

Database deletion cascades associated metadata, but does not delete photo files. Delete unused objects separately. Use new filenames for replacements to avoid old CDN copies.

At 500 coins, two sides and two sizes averaging 450 KB per side, storage is approximately 450 MB. Large photos or extra images change that estimate. Supabase's egress quotas apply even though the frontend host has generous static traffic allowances.

## Future administrator login

The migration includes owner-only authenticated policies. Dashboard editing does not need an application login.

When implementing the next milestone:

1. Disable public signups in Supabase Auth.
2. Create your single owner account manually.
3. Add its user UUID through privileged SQL Editor:

```sql
insert into private.admin_users(user_id)
values ('YOUR_AUTH_USER_UUID');
```

4. Build login and coin/photo forms. Enable session persistence only in the admin client.
5. Verify signed-in non-owners still cannot read private records, edit coins or upload photos.

Visitors cannot self-assign owner status. Route guards improve navigation; database policies enforce authorization. No secret key belongs in the admin browser either.

## Verify changes

```powershell
npm run check
npm run test:db
npm run test:photos
npx playwright install chromium firefox webkit
npm run test:e2e
```

`check` runs ESLint, unit tests, TypeScript and the production build. The embedded PostgreSQL check executes the migration with local Supabase auth/storage scaffolding, then tests RLS, owner access, search and pagination. It does not replace tests against the hosted API.

Playwright covers Chromium, Firefox, WebKit and an iPhone viewport. Actual Android/iOS devices still need a smoke test before a real public launch.

For a production preview:

```powershell
npm run build
npm run preview
```

Cloudflare security headers are in `public/_headers`; Vite's local preview does not apply them. The policy assumes standard `*.supabase.co` URLs. Update exact origins if you later use a custom Supabase domain.

## Publish for free

1. Create an empty **private** GitHub repository named `MyCoinsCollectionWebSite`.
2. Review files, then push from this folder:

```powershell
git add .
git commit -m "Build personal coin collection catalogue"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/MyCoinsCollectionWebSite.git
git push -u origin main
```

3. In Cloudflare dashboard, open Workers & Pages → Create → Pages → Connect to Git.
4. Authorize this repository only.
5. Set production branch `main`, build command `npm run build`, output directory `dist`, root directory empty.
6. Set `NODE_VERSION=24`, both public Supabase settings and `VITE_DEMO_MODE=false` for production.
7. Deploy. Cloudflare provides HTTPS and a `PROJECT.pages.dev` address.
8. Reload a deep URL such as `/coins/your-slug` directly. Do not add a top-level `404.html`, because Pages' default SPA fallback handles these routes.
9. Verify unpublished records and private data are inaccessible with anonymous API requests.

Subsequent pushes rebuild the frontend. Coin edits do not rebuild it. Review code through branch previews. Apply backward-compatible database migrations before deploying code that depends on them.

No cloud projects or repository were created by this implementation. Account setup and production deployment require your own accounts.

## Maintenance and recovery

After substantial edits, export all catalogue and private tables as CSV through the dashboard, and keep copies of uploaded files. Save these backups outside Git. CSV exports do not contain the database schema; migrations preserve that separately. Periodically test restoring into a spare project.

Check storage and cached/uncached egress monthly. Investigate usage at roughly 70% of allowance. Supabase Free projects can pause after low activity; resume through the dashboard and retry. No synthetic keepalive is configured.

Keep provider accounts on Free. A custom domain and upgraded plans are optional expenses, not requirements.

## Architecture and free-plan comparison

See `docs/architecture.md` for the service comparison, security model and learning roadmap. The current code is the dashboard-managed first release from the agreed plan.

See docs/verification.md for verified results and the Firefox runtime limitation on this Windows machine.
