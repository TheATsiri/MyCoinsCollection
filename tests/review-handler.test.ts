import { webcrypto } from 'node:crypto'
import { beforeEach, expect, it, vi } from 'vitest'
import { createReviewHandler } from '../supabase/functions/submit-review/handler'
const origin = 'https://coins.example.com'
const body = {
  coin_id: '10000000-0000-0000-0000-000000000001',
  submission_id: '20000000-0000-0000-0000-000000000001',
  rating: 5,
  display_name: 'Collector',
  review_text: '',
  website: '',
  token: 'verified',
}
const save = vi.fn(),
  verify = vi.fn()
const settings = {
  origins: [origin],
  secret: 'server-secret',
  salt: 'x'.repeat(32),
  ready: true,
  verify,
  save,
}
function request(
  payload: unknown = body,
  headers: Record<string, string> = {},
) {
  return new Request(origin + '/submit', {
    method: 'POST',
    headers: {
      origin,
      'x-forwarded-for': '192.0.2.1',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  })
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  save.mockReset().mockResolvedValue({ error: null })
  verify
    .mockReset()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: 'coins.example.com',
          action: 'coin-review',
        }),
      ),
    )
})
it('verifies the challenge and stores a hashed server identity, never a supplied actor', async () => {
  const response = await createReviewHandler(settings)(
    request({ ...body, p_actor_hash: 'attacker-chosen' }),
  )
  expect(response.status).toBe(201)
  expect(await response.json()).toEqual({ status: 'pending' })
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      p_coin_id: body.coin_id,
      p_actor_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }),
  )
  expect(save.mock.calls[0][0].p_actor_hash).not.toBe('attacker-chosen')
  expect(verify).toHaveBeenCalledWith(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ secret: 'server-secret', response: 'verified' }),
    }),
  )
})
it('denies unknown origins and supports only allowed preflights', async () => {
  const handler = createReviewHandler(settings)
  expect(
    (await handler(request(body, { origin: 'https://evil.example' }))).status,
  ).toBe(403)
  const response = await handler(
    new Request(origin, { method: 'OPTIONS', headers: { origin } }),
  )
  expect(response.status).toBe(204)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  expect(save).not.toHaveBeenCalled()
  expect(verify).not.toHaveBeenCalled()
})
it.each([
  { success: false, hostname: 'coins.example.com', action: 'coin-review' },
  { success: true, hostname: 'evil.example', action: 'coin-review' },
  { success: true, hostname: 'coins.example.com', action: 'other' },
])('denies invalid challenge responses %j', async (result) => {
  verify.mockResolvedValue(new Response(JSON.stringify(result)))
  expect((await createReviewHandler(settings)(request())).status).toBe(403)
  expect(save).not.toHaveBeenCalled()
})
it('fails closed without secrets or a gateway address', async () => {
  expect(
    (await createReviewHandler({ ...settings, secret: undefined })(request()))
      .status,
  ).toBe(503)
  expect(
    (
      await createReviewHandler(settings)(
        request(body, { 'x-forwarded-for': '' }),
      )
    ).status,
  ).toBe(503)
  expect(save).not.toHaveBeenCalled()
})
it.each([null, [], { ...body, rating: 6 }])(
  'rejects malformed input before challenge verification %j',
  async (input) => {
    expect((await createReviewHandler(settings)(request(input))).status).toBe(
      400,
    )
    expect(verify).not.toHaveBeenCalled()
  },
)
it('bounds streamed bodies and rejects unsupported methods', async () => {
  const handler = createReviewHandler(settings)
  expect(
    (await handler(request({ ...body, review_text: 'x'.repeat(17000) })))
      .status,
  ).toBe(413)
  expect(
    (await handler(new Request(origin, { headers: { origin } }))).status,
  ).toBe(405)
})
it.each([
  ['P0003', 429],
  ['P0002', 404],
  ['P0001', 400],
  ['XX000', 503],
])('maps database error %s to HTTP %s', async (code, status) => {
  save.mockResolvedValue({
    error: { code, message: 'Controlled validation error' },
  })
  const response = await createReviewHandler(settings)(request())
  expect(response.status).toBe(status)
  if (status === 429) expect(response.headers.get('Retry-After')).toBe('3600')
  if (status === 503)
    expect((await response.json()).error).not.toContain('Controlled')
})
it('reports a safe upstream failure without writing', async () => {
  verify.mockRejectedValue(new Error('Secret provider detail'))
  const response = await createReviewHandler(settings)(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('Secret provider detail')
  expect(save).not.toHaveBeenCalled()
})
