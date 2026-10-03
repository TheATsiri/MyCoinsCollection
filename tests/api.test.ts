import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_FILTERS } from '../src/types/coin'
const mock = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mock.createClient }))
beforeEach(() => {
  vi.resetModules()
  mock.rpc.mockReset()
  mock.createClient.mockReset()
  vi.stubEnv('VITE_DEMO_MODE', 'false')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fixture.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fixture_only')
  mock.createClient.mockReturnValue({ rpc: mock.rpc })
})
afterEach(() => vi.unstubAllEnvs())
describe('live data adapter', () => {
  it('uses the server search function with typed filters and page', async () => {
    mock.rpc.mockResolvedValue({ data: { items: [], total: 0 }, error: null })
    const { listCoins } = await import('../src/lib/api')
    await listCoins(
      { ...EMPTY_FILTERS, q: ' Silver ', country: 'Germany', yearFrom: '2000' },
      'year_asc',
      2,
    )
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_coins',
      expect.objectContaining({
        p_query: 'Silver',
        p_country: 'Germany',
        p_year_from: 2000,
        p_year_to: null,
        p_sort: 'year_asc',
        p_page: 2,
      }),
    )
  })
  it('propagates a service outage instead of substituting demo coins', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: new Error('Unavailable') })
    const { listCoins } = await import('../src/lib/api')
    await expect(listCoins(EMPTY_FILTERS, 'added', 1)).rejects.toThrow(
      'Unavailable',
    )
  })
  it('rejects incomplete configuration rather than switching to demo', async () => {
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    const { listCoins } = await import('../src/lib/api')
    await expect(listCoins(EMPTY_FILTERS, 'added', 1)).rejects.toThrow(
      'settings are incomplete',
    )
    expect(mock.createClient).not.toHaveBeenCalled()
  })
})
