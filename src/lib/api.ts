import { demoCoins } from '../features/coins/demo'
import { isDemo, configurationError, supabase } from './supabase'
import { filterDemo, yearValue } from './filters'
import type {
  Coin,
  CoinFilters,
  CoinPage,
  FilterOptions,
  Sort,
} from '../types/coin'
function client() {
  if (!supabase)
    throw new Error(configurationError ?? 'Database is not configured.')
  return supabase
}
export async function listCoins(
  filters: CoinFilters,
  sort: Sort,
  page: number,
): Promise<CoinPage> {
  if (isDemo) return filterDemo(demoCoins, filters, sort, page)
  const { data, error } = await client().rpc('search_coins', {
    p_query: filters.q.trim(),
    p_country: filters.country,
    p_year_from: yearValue(filters.yearFrom),
    p_year_to: yearValue(filters.yearTo),
    p_period: filters.period,
    p_denomination: filters.denomination,
    p_metal: filters.metal,
    p_grade: filters.grade,
    p_sort: sort,
    p_page: page,
  })
  if (error) throw error
  return data as unknown as CoinPage
}
export async function getCoin(slug: string): Promise<Coin | null> {
  if (isDemo) return demoCoins.find((c) => c.slug === slug) ?? null
  // Private ownership data is deliberately never selected.
  const { data, error } = await client()
    .from('coins')
    .select('*,coin_images(*),coin_references(*)')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  if (error) throw error
  return data as unknown as Coin | null
}
export async function getFilterOptions(): Promise<FilterOptions> {
  if (isDemo) {
    const distinct = (key: keyof Coin) =>
      [
        ...new Set(
          demoCoins
            .filter((c) => c.is_published)
            .map((c) => c[key])
            .filter((v): v is string => typeof v === 'string' && !!v),
        ),
      ].sort()
    return {
      countries: distinct('issuing_authority'),
      periods: distinct('historical_period'),
      denominations: distinct('denomination'),
      metals: distinct('metal'),
      grades: distinct('grade'),
    }
  }
  const { data, error } = await client().rpc('get_filter_options', {})
  if (error) throw error
  return data as unknown as FilterOptions
}
