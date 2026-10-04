# Administration

The existing React/Supabase project now provides `/admin/login`, `/admin`, `/admin/coins/new`, and `/admin/coins/:id/edit` in English, German, and Greek.

## Deploy and provision

1. Apply `supabase/migrations/002_administration.sql` after migration 001. It adds owner-authorized transactional saves, private submission receipts, a protected photo cleanup queue, and minimal public Realtime refresh broadcasts. Existing coin URLs and private ownership data are preserved.
2. Deploy `supabase/functions/import-coin` with Supabase CLI (`supabase functions deploy import-coin --project-ref YOUR_PROJECT_REF`) or upload its four files through the dashboard editor. The checked-in function configuration uses custom token verification: the function calls Auth `getUser` and `is_collection_owner` before fetching a reference. For dashboard deployments, turn off the redundant legacy-only JWT gateway verifier after deploying this code.
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

## Numista Free Plan and secure setup

Reviewed 4 October 2026 against [Numista API documentation](https://en.numista.com/api/doc/index.php), [pricing](https://en.numista.com/api/pricing.php), and [license](https://en.numista.com/api/license.php).

The Free Plan provides 2,000 requests per calendar month, no credit card requirement, and no image search. This integration uses one `GET https://api.numista.com/v3/types/{id}?lang=en` per explicit lookup. It does not enable a paid plan, perform image identification, scrape Numista pages as a fallback, or automatically fetch additional endpoints. Numista controls the quota; other applications sharing your key also consume it. A 429 response means quota or concurrency limits have been reached. Check usage in the Numista API account and retry later as appropriate. German and Greek interface users receive English API catalogue text because the API supports en/es/fr.

1. Sign in at [Numista API](https://en.numista.com/api/index.php) and activate the **Free Plan** yourself after reviewing its agreement. Obtain the API key from your API account.
2. Open [Supabase Edge Function secrets](https://supabase.com/dashboard/project/bwndmbfjyifrzfomjxvg/functions/secrets). Add the name `NUMISTA_API_KEY`, paste your actual key into its secret Value field, and save. Do not send the key in chat.
3. Deploy the updated `import-coin` function, including `index.ts`, `extract.ts`, `safe-fetch.ts`, and `numista.ts`. Existing administrator token/owner checks and exact-origin restrictions still apply. No database migration is required.
4. The server reads `Deno.env.get('NUMISTA_API_KEY')` and sends it only to `api.numista.com` in the `Numista-API-Key` header. Redirects are rejected. Responses are bounded to 12 seconds and 1 MB; transport and upstream error bodies are not shown or logged. Do not put the key in `VITE_*`, Cloudflare frontend build variables, source files, Git, browser storage, or the coin database. Rotate it through Numista and replace the Supabase secret if exposed.

### Use it in administration

1. Log in at `/admin/login`, then choose **Add coin** or edit a coin.
2. Find the coin on Numista and copy its catalogue URL, for example `https://en.numista.com/catalogue/pieces420.html` or `https://en.numista.com/420` (N#420).
3. Paste the URL into the **first Reference URL** field. Click **Retrieve information**. Each click consumes one API request; no polling or automatic retries are used.
4. Review **Numista live lookup**, its N# identifier, and **Source: Numista**. This read-only preview remains in component memory only and disappears when you leave/reload the editor. It is not included in session-storage pending submissions or database writes.
5. Click **Add Numista reference**. This retains only the Numista catalogue name, N# identifier, and canonical link; it does not fill catalogue fields or copy photographs. Repeated clicks do not duplicate the reference. When the first reference is a blank Website reference, it is replaced; existing catalogue references are retained.
6. Enter your independently sourced catalogue details and upload your own obverse/reverse photographs. Review publication status, then click **Add to My Coins Collection** (or **Save changes**).
7. The saved reference links visitors to Numista. Existing coin management, transactional saves, and live refresh behavior remain unchanged.

The current license permits storing identifiers indefinitely. It prohibits persistent storage of other API catalogue data except specified metadata caching or private personal projects; the private-project exception does not cover this public website. Written permission from Numista would be needed before adding persistent API-detail imports for publication. Do not copy temporary preview details into public catalogue fields as a workaround.

Missing configuration, rejected keys, quota limits, unknown N# IDs, and unavailable responses leave editor details and the original URL intact. Use another independent source or retry an explicit lookup after resolving the error.
