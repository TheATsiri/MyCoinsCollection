import { describe, expect, it } from 'vitest'
import { extractCoin } from '../supabase/functions/import-coin/extract'
import {
  publicAddress,
  validateUrl,
} from '../supabase/functions/import-coin/safe-fetch'
describe('reference extraction', () => {
  it('extracts explicit labels and measurement provenance', () => {
    const result = extractCoin(
      '<h1>Silver coin</h1><table><tr><th>Country</th><td>Greece</td></tr><tr><td>Year</td><td>1964</td></tr><tr><td>Weight</td><td>18,0 g</td></tr></table>',
      'https://example.com/coin',
    )
    expect(result.fields).toMatchObject({
      name: 'Silver coin',
      issuing_authority: 'Greece',
      year: 1964,
      weight_g: 18,
    })
    expect(result.fields.measurement_source).toContain('specimen not measured')
  })
  it('reads metadata without guessing years or converting unknown measurements', () => {
    const result = extractCoin(
      `<script type="application/ld+json">{"@type":"Product","name":"Coin","additionalProperty":[{"name":"Year","value":"1963–1964"},{"name":"Weight","value":"1 oz"}]}</script>`,
      'https://example.com',
    )
    expect(result.fields).toEqual({ name: 'Coin' })
    expect(result.warnings.length).toBeGreaterThan(0)
  })
  it('ignores scripts and malformed metadata', () => {
    expect(
      extractCoin(
        '<script><h1>Fake</h1></script><script type="application/ld+json">invalid</script>',
        'https://example.com',
      ).fields,
    ).toEqual({})
  })
})
describe('public URL validation', () => {
  it.each([
    'http://localhost/a',
    'http://127.0.0.1',
    'http://2130706433',
    'http://10.0.0.1',
    'http://169.254.169.254',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'file:///tmp/a',
    'https://user:pass@example.com',
    'https://example.com:8443',
    'http://host.internal',
  ])('rejects %s', (url) => expect(() => validateUrl(url)).toThrow())
  it.each([
    '0.0.0.0',
    '100.64.0.1',
    '172.16.0.1',
    '192.168.0.1',
    '198.18.0.1',
    '224.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::',
  ])('rejects non-public address %s', (address) =>
    expect(publicAddress(address)).toBe(false),
  )
  it('accepts public destinations', () => {
    expect(
      validateUrl('https://en.numista.com/catalogue/pieces1493.html').protocol,
    ).toBe('https:')
    expect(publicAddress('8.8.8.8')).toBe(true)
    expect(publicAddress('2606:4700::1111')).toBe(true)
  })
})
