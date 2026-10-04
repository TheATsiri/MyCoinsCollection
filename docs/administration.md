# Administration

The existing React/Supabase project now provides `/admin/login`, `/admin`, `/admin/coins/new`, and `/admin/coins/:id/edit` in English, German, and Greek.

## Deploy and provision

1. Apply `supabase/migrations/002_administration.sql` after migration 001. It adds owner-authorized transactional saves, private submission receipts, a protected photo cleanup queue, and minimal public Realtime refresh broadcasts. Existing coin URLs and private ownership data are preserved.
2. Deploy `supabase/functions/import-coin` with Supabase CLI (`supabase functions deploy import-coin --project-ref YOUR_PROJECT_REF`) or upload its three files through the dashboard editor. The checked-in function configuration uses custom token verification: the function calls Auth `getUser` and `is_collection_owner` before fetching a reference. For dashboard deployments, turn off the redundant legacy-only JWT gateway verifier after deploying this code.
3. Set `ADMIN_ORIGINS` to the exact public website origin. Add local development origins as a comma-separated list only when needed. No AI key or paid service is used.
4. Disable public signups. Create the one owner account through Supabase Authentication; the owner should choose their password themselves. Add its UUID to `private.admin_users` through privileged SQL. Never put a password, secret API key, or service-role key in frontend settings.
5. Set Auth Site URL to the production origin and permit `https://mycoinscollection.pages.dev/admin/login` as a recovery redirect. Sign in through the public `/admin/login` page after the frontend release.
6. Release the frontend through the existing Cloudflare Pages Git integration. CSP now permits Supabase WebSocket connections.

## Using the administrator area

Upload obverse and reverse photographs, provide a public reference URL, and select Retrieve information. Suggestions do not overwrite the editor: use each value individually after reviewing it. Missing or blocked information can be entered manually. Name, issuing authority, one source URL, and both sides are required for new coins. Years retain the existing database range of 1–9999; leave undated or unsupported dates empty.

JPEG, PNG, and WebP inputs up to 20 MB are oriented and resized in the browser, retaining the whole photograph and removing source metadata. Detailed WebP images are at most 1600 pixels and thumbnails at most 400 pixels. Outputs must each fit the existing 2 MB bucket limit. Storage paths are unique so replaced images do not collide with cached copies.

Add publishes by default; uncheck Published to keep a hidden catalogue record. Existing coins can be edited, hidden, republished, or permanently deleted with a named confirmation. Photographs remain accessible by their URLs when a coin is hidden because the existing bucket is public. Deleting a coin also queues its photographs for removal.

Private acquisition, price, valuation, and personal-note editing remains outside this interface. Keep these details in the existing private ownership table.

## Failure handling

Coin, photograph metadata, and references are saved in one transaction after the uploads succeed. A submission UUID and matching request receipt make retries idempotent. Ambiguous save failures lock the editor and offer Retry save. The same request is retained in session storage across reloads; it contains catalogue data only. Signing out clears pending submissions. If browser storage is disabled, in-memory retries still work until the page closes.

Edits check the original `updated_at`; a conflicting edit must be reloaded before saving. Server validation failures unlock the form. Failed uploads and unused replacement files are tracked in `photo_cleanup`. Obsolete images are queued by database triggers, including dashboard deletions. Cleanup runs when administration opens and after mutations; Retry photograph cleanup repeats failed deletions. Abandoned staged uploads become eligible after 24 hours and are cleared on the next administration visit. There is no background cleanup scheduler.

Do not delete staged files after an uncertain database response. Cleanup checks for active image references before removing files. Successful saves remove their referenced paths from the queue.

## Imports and live updates

Extraction recognises explicit table/definition-list labels in English, German, and Greek, Product/Coin JSON-LD properties, and page titles. It does not execute page JavaScript, bypass blocked pages, infer specimen grades, or guess year ranges and unsupported units. Imported measurements carry catalogue provenance. Some websites supply only a title or no usable data.

The Edge Function permits only public HTTP/HTTPS destinations on normal ports, validates DNS addresses and every redirect, and pins the vetted address to the outgoing connection. Fetches have a 12-second deadline, at most three redirects, and a 2 MB uncompressed HTML limit. Authentication happens before any reference fetch.

Public changes broadcast only an empty refresh payload on `public-collection`; hidden-only edits and private details are excluded. Visitors refetch public catalogue queries, including removal of a hidden/deleted open coin. Reconnect and visibility changes trigger refetching; disconnected foreground pages poll every 30 seconds. Filters and pagination remain in the URL.

## Verification

- `npm run check`: lint, unit/component tests, both migrations, embedded authorization/transaction tests, TypeScript, and build.
- `npx playwright test --project=chromium --project=webkit --project=mobile`: public/demo browsing and translated admin routing.
- `npx playwright test --config=playwright.admin.config.ts`: isolated authenticated workflow against mocked Supabase responses, including real browser WebP processing. It does not create production records or use production credentials.
- `npm exec --yes --package=deno -- deno check --config=supabase/functions/deno.json supabase/functions/import-coin/index.ts`: actual Deno type-check.
- `node scripts/test-admin-hosted.mjs`: read-only hosted anonymous/CORS checks using the existing local public settings, without printing keys.

Hosted account login, password recovery, and owner photo storage operations require provisioning the real owner account. Run a real two-browser update test once that account is available. Firefox retains the previously documented Windows startup limitation.
