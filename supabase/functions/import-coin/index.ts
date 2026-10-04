import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { extractCoin } from './extract.ts'
import { fetchPublicPage } from './safe-fetch.ts'
const allowedOrigins = (Deno.env.get('ADMIN_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  }
  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] =
      'authorization,x-client-info,apikey,content-type'
    headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
  }
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers })
  if (origin && !allowedOrigins.includes(origin))
    return reply({ error: 'Origin is not allowed' }, 403)
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers })
  if (request.method !== 'POST')
    return reply({ error: 'Method not allowed' }, 405)
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer '))
    return reply({ error: 'Administrator access required' }, 401)
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    },
  )
  const { data: user, error: authError } = await client.auth.getUser(
    authorization.slice(7),
  )
  if (authError || !user.user)
    return reply({ error: 'Administrator access required' }, 401)
  const { data: owner, error: ownerError } = await client.rpc(
    'is_collection_owner',
  )
  if (ownerError || owner !== true)
    return reply({ error: 'Administrator access required' }, 403)
  try {
    // Bound the incoming body as well as the outgoing page fetch.
    const bodyText = await request.text()
    if (bodyText.length > 8192)
      return reply({ error: 'Request too large' }, 413)
    const body = JSON.parse(bodyText)
    if (typeof body.url !== 'string' || body.url.length > 4096)
      return reply({ error: 'Invalid reference URL' }, 400)
    const page = await fetchPublicPage(body.url)
    return reply(extractCoin(page.html, page.url))
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Information could not be retrieved.',
      },
      422,
    )
  }
})
