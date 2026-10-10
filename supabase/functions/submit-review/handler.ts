import { validateReview } from './validation.ts'
type Settings = {
  origins: string[]
  secret: string | undefined
  salt: string | undefined
  ready: boolean
  verify: typeof fetch
  save: (
    args: Record<string, string | number>,
  ) => PromiseLike<{ error: { code: string; message: string } | null }>
}
export function createReviewHandler({
  origins,
  secret,
  salt,
  ready,
  verify,
  save,
}: Settings) {
  return async (request: Request) => {
    const origin = request.headers.get('origin') ?? ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    }
    if (origins.includes(origin))
      Object.assign(headers, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers':
          'authorization,x-client-info,apikey,content-type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      })
    const reply = (error: string, status: number) =>
      new Response(JSON.stringify({ error }), { status, headers })
    if (!origins.includes(origin)) return reply('Origin is not allowed', 403)
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply('Method not allowed', 405)
    if (!secret || !salt || salt.length < 32 || !ready)
      return reply('Reviews are temporarily unavailable', 503)
    try {
      // Stream and bound the body before parsing, including chunked requests.
      const reader = request.body?.getReader()
      if (!reader) return reply('Invalid request', 400)
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 16384) {
          await reader.cancel()
          return reply('Request too large', 413)
        }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      let review: ReturnType<typeof validateReview>
      try {
        review = validateReview(JSON.parse(new TextDecoder().decode(bytes)))
      } catch (error) {
        return reply(
          error instanceof Error ? error.message : 'Invalid request',
          400,
        )
      }
      const response = await verify(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret, response: review.token }),
          signal: AbortSignal.timeout(10000),
        },
      )
      const verification = await response.json()
      if (
        !response.ok ||
        verification.success !== true ||
        verification.hostname !== new URL(origin).hostname ||
        verification.action !== 'coin-review'
      )
        return reply('Complete the verification and try again', 403)
      // Use the gateway-provided forwarded address; never accept an identity in the JSON body.
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      if (!ip) return reply('Reviews are temporarily unavailable', 503)
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(salt),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const digest = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(ip),
      )
      const actorHash = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('')
      const { error } = await save({
        p_submission_id: review.submission_id,
        p_coin_id: review.coin_id,
        p_display_name: review.display_name,
        p_rating: review.rating,
        p_review_text: review.review_text,
        p_actor_hash: actorHash,
      })
      if (error) {
        if (error.code === 'P0003') {
          headers['Retry-After'] = '3600'
          return reply(error.message, 429)
        }
        if (error.code === 'P0002') return reply('Coin not found', 404)
        if (error.code === 'P0001') return reply(error.message, 400)
        return reply('Review could not be saved. Please try again.', 503)
      }
      return new Response(JSON.stringify({ status: 'pending' }), {
        status: 201,
        headers,
      })
    } catch {
      return reply('Review could not be saved. Please try again.', 503)
    }
  }
}
