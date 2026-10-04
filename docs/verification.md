# Verification — 3 October 2026

Local implementation: C:\Users\atsiriplis\Code\CodeX\MyCoinsCollectionWebSite

- ESLint, TypeScript and production build passed.
- Unit/component checks cover combined filters, publication, unknown years, references, pagination, query parameters, side switching and configured service failures.
- Embedded PostgreSQL checks passed for migration syntax, anonymous/non-owner permissions, authorized owner operations, storage policies, filtering, search and pagination.
- Twelve Playwright tests passed across Chromium, WebKit and an iPhone viewport: browsing, shareable filters, image viewer focus, empty states, invalid years, deep links, viewport fit and sample-image loading.
- Photograph preparation passed checks for output sizes, EXIF rotation, metadata stripping and original preservation.
- Desktop and mobile screenshots were inspected.
- npm production dependency audit reported no vulnerabilities.

Firefox test browser downloaded successfully but cannot start on this Windows host: the operating system reports an invalid side-by-side configuration. Firefox tests remain configured. Re-run them on a working Firefox test environment; no Windows runtime installation was performed.

Production: https://mycoinscollection.pages.dev, deployed from TheATsiri/MyCoinsCollection on the main branch.

- Hosted Supabase migration applied successfully: six protected public tables and the coin-photos bucket.
- Anonymous search and filter RPCs returned HTTP 200 with an empty live catalogue. Private detail requests were denied.
- Hosted SQL security checks passed for anonymous and authenticated non-owner access; temporary fixtures were rolled back.
- Cloudflare Pages production build succeeded with Node 24, npm run build, dist output, and live Supabase public variables.
- Public collection loaded successfully with demonstration mode off; direct reload works. Browser reported no warnings/errors during the smoke check.
- Home, collection, about and a coin deep URL returned HTTP 200 with SPA fallback. X-Content-Type-Options, X-Frame-Options and Content-Security-Policy were verified on the hosted responses.

No genuine coin records have been supplied. Real specimen photos, future owner login, and actual mobile devices still need validation when available.

## Administration verification — 4 October 2026

- 45 unit/component checks passed, covering administrator login/recovery/session restoration, non-owner denial, explicit import review, idempotent save retry, image validation/resizing, source extraction, private network URL rejection, and live-query invalidation/reconnect polling.
- Both migrations and embedded database tests passed: owner saves, non-owner denial, unchanged slugs, duplicate request receipts, stale-edit rejection, failed-save rollback, deletion cleanup, and empty public refresh payloads.
- 21 public/demo browser checks passed across Chromium, WebKit, and an iPhone viewport.
- Six authenticated workflow browser checks passed against isolated mocked APIs, including actual PNG-to-WebP processing in each browser, retained login sessions, explicit source review, publish, logout, and non-owner rejection.
- Deno type-check and a real public-page fetch passed using the importer runtime.
- Migration 002 and the three-file import function were deployed to hosted Supabase. Production origin configuration was saved, and custom Auth getUser/owner checks handle modern user tokens.
- Hosted anonymous API checks passed: writes denied, cleanup rows undisclosed, import authentication enforced, unapproved origins rejected, and production CORS preflight accepted.
- Existing hosted SQL authorization tests and rollback-only transactional owner/non-owner tests completed successfully without retaining fixtures or changing collection records.

Actual owner login, recovery email delivery, authenticated reference fetch/photo uploads, and a live two-browser change test remain pending creation of the real administrator account. No administrator email or password has been supplied. Public signups are disabled, and the production site/recovery redirect URLs are configured. The previous Firefox Windows startup limitation remains documented above.
