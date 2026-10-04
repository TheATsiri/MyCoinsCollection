import { describe, expect, it, vi } from 'vitest'
import {
  lookupNumista,
  numistaPreview,
  numistaTypeId,
} from '../supabase/functions/import-coin/numista'
describe('Numista live lookup', () => {
  it('recognises catalogue URLs without matching lookalike hosts', () => {
    expect(
      numistaTypeId('https://en.numista.com/catalogue/pieces420.html'),
    ).toBe(420)
    expect(numistaTypeId('https://de.numista.com/420')).toBe(420)
    expect(numistaTypeId('https://en.numista.com.evil.test/420')).toBeNull()
    expect(() => numistaTypeId('https://en.numista.com/api')).toThrow(
      'catalogue URL',
    )
    expect(() => numistaTypeId('https://user:pass@en.numista.com/420')).toThrow(
      'catalogue URL',
    )
  })
  it('returns ephemeral data with no saveable catalogue suggestions or external photographs', () => {
    const preview = numistaPreview(
      {
        id: 420,
        title: 'Coin',
        issuer: { name: 'Issuer' },
        weight: 1.2,
        obverse: {
          picture: 'https://example.com/photo',
          description: 'Portrait',
        },
      },
      420,
    )
    expect(preview.fields).toEqual({})
    expect(preview.source_url).toBe('https://en.numista.com/420')
    expect(preview.numista.details).toContainEqual({
      label: 'Weight (g)',
      value: 1.2,
    })
    expect(JSON.stringify(preview)).not.toContain('example.com')
    expect(() => numistaPreview({ id: 421, title: 'Wrong type' }, 420)).toThrow(
      'invalid response',
    )
  })
  it('uses a fixed API endpoint and keeps the key in its request header', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 420, title: 'Coin' }), {
          headers: { 'content-type': 'application/json' },
        }),
      )
    const result = await lookupNumista(420, 'test-only-key', fetcher)
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.numista.com/v3/types/420?lang=en',
      expect.objectContaining({
        redirect: 'error',
        headers: {
          'Numista-API-Key': 'test-only-key',
          Accept: 'application/json',
        },
      }),
    )
    expect(JSON.stringify(result)).not.toContain('test-only-key')
  })
  it('does not request anything without a configured key', async () => {
    const fetcher = vi.fn()
    await expect(lookupNumista(420, undefined, fetcher)).rejects.toThrow(
      'NUMISTA_API_KEY',
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([
    [401, 'rejected'],
    [404, 'not found'],
    [429, 'quota'],
    [500, 'unavailable'],
  ])(
    'handles upstream %s without exposing the response',
    async (status, message) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(new Response('private upstream debug', { status }))
      await expect(lookupNumista(420, 'secret', fetcher)).rejects.toThrow(
        message,
      )
    },
  )
  it('sanitises transport failures and rejects oversized data', async () => {
    await expect(
      lookupNumista(
        420,
        'secret',
        vi.fn().mockRejectedValue(new Error('secret in transport log')),
      ),
    ).rejects.toThrow('could not be reached')
    await expect(
      lookupNumista(
        420,
        'secret',
        vi
          .fn()
          .mockResolvedValue(
            new Response(' '.repeat(1024 * 1024 + 1), {
              headers: { 'content-type': 'application/json' },
            }),
          ),
      ),
    ).rejects.toThrow('oversized')
  })
})
