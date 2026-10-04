import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const settings = await readFile(
  new URL('../.env.local', import.meta.url),
  'utf8',
)
const value = (name) =>
  settings
    .match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]
    .trim()
    .replace(/^['"]|['"]$/g, '')
const url = value('VITE_SUPABASE_URL'),
  key = value('VITE_SUPABASE_PUBLISHABLE_KEY')
if (!url || !key) throw new Error('Connected Supabase settings are required.')
async function call(path, options = {}) {
  return fetch(url + path, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}
const settingsResponse = await call('/auth/v1/settings')
assert.equal(settingsResponse.status, 200)
assert.equal((await settingsResponse.json()).disable_signup, true, 'Public signups must remain disabled')
const save = await call('/rest/v1/rpc/save_coin', {
  method: 'POST',
  body: JSON.stringify({
    p_submission_id: '00000000-0000-0000-0000-000000000001',
    p_coin: {},
    p_images: [],
    p_references: [],
  }),
})
assert.ok(
  [401, 403].includes(save.status),
  `Anonymous save must be denied, received ${save.status}`,
)
const cleanup = await call('/rest/v1/photo_cleanup?select=path')
if (cleanup.status === 200)
  assert.deepEqual(
    await cleanup.json(),
    [],
    'Anonymous cleanup queue must be empty',
  )
else
  assert.ok(
    [401, 403].includes(cleanup.status),
    `Cleanup queue must be private, received ${cleanup.status}`,
  )
const importer = await call('/functions/v1/import-coin', {
  method: 'POST',
  headers: { Origin: 'https://mycoinscollection.pages.dev' },
  body: JSON.stringify({ url: 'https://example.com' }),
})
assert.equal(importer.status, 401)
assert.equal((await importer.json()).error, 'Administrator access required')
const crossOrigin = await call('/functions/v1/import-coin', {
  method: 'POST',
  headers: { Origin: 'https://untrusted.example' },
  body: '{}',
})
assert.equal(crossOrigin.status, 403)
const cors = await call('/functions/v1/import-coin', {
  method: 'OPTIONS',
  headers: { Origin: 'https://mycoinscollection.pages.dev' },
})
assert.equal(cors.status, 204)
assert.equal(
  cors.headers.get('access-control-allow-origin'),
  'https://mycoinscollection.pages.dev',
)
console.log(
  'PASS hosted: anonymous saves denied, cleanup queue private, importer verifies authentication, foreign origins blocked, production CORS enabled.',
)
