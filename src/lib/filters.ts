import { EMPTY_FILTERS, PAGE_SIZE } from '../types/coin'
import type { Coin, CoinFilters, CoinPage, Sort } from '../types/coin'
export const sortOptions: { value: Sort; label: string }[] = [
  { value: 'year_desc', label: 'Year: newest first' },
  { value: 'year_asc', label: 'Year: oldest first' },
  { value: 'country', label: 'Country / authority' },
  { value: 'denomination', label: 'Denomination' },
  { value: 'added', label: 'Recently catalogued' },
]
export function readSearch(params: URLSearchParams) {
  const filters = { ...EMPTY_FILTERS }
  for (const key of Object.keys(filters) as (keyof CoinFilters)[])
    filters[key] = (params.get(key) ?? '').slice(0, 200)
  const value = params.get('sort')
  const sort: Sort = sortOptions.some((s) => s.value === value)
    ? (value as Sort)
    : 'year_desc'
  const raw = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 10000) : 1
  return { filters, sort, page }
}
export function yearValue(value: string): number | null {
  if (!/^\d{1,4}$/.test(value)) return null
  const year = Number(value)
  return year >= 1 && year <= 9999 ? year : null
}
export function validateYears(filters: CoinFilters): string | null {
  if (
    (filters.yearFrom && yearValue(filters.yearFrom) === null) ||
    (filters.yearTo && yearValue(filters.yearTo) === null)
  )
    return 'Enter a year between 1 and 9999.'
  const from = yearValue(filters.yearFrom),
    to = yearValue(filters.yearTo)
  return from !== null && to !== null && from > to
    ? 'The starting year must not exceed the ending year.'
    : null
}
export function filterDemo(
  coins: Coin[],
  filters: CoinFilters,
  sort: Sort,
  page: number,
): CoinPage {
  const from = yearValue(filters.yearFrom),
    to = yearValue(filters.yearTo)
  const query = filters.q.trim().toLocaleLowerCase()
  const items = coins.filter(
    (c) =>
      c.is_published &&
      (!query ||
        [
          c.name,
          c.issuing_authority,
          c.obverse_description,
          c.reverse_description,
          c.historical_notes,
          ...c.coin_references.map(
            (r) => r.catalogue + ' ' + r.reference_number,
          ),
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query)) &&
      (!filters.country || c.issuing_authority === filters.country) &&
      (!filters.period || c.historical_period === filters.period) &&
      (!filters.denomination || c.denomination === filters.denomination) &&
      (!filters.metal || c.metal === filters.metal) &&
      (!filters.grade || c.grade === filters.grade) &&
      (from === null || (c.year !== null && c.year >= from)) &&
      (to === null || (c.year !== null && c.year <= to)),
  )
  items.sort((a, b) => {
    let diff = 0
    if (sort.startsWith('year'))
      diff =
        a.year === null
          ? b.year === null
            ? 0
            : 1
          : b.year === null
            ? -1
            : sort === 'year_asc'
              ? a.year - b.year
              : b.year - a.year
    if (sort === 'country')
      diff = a.issuing_authority.localeCompare(b.issuing_authority)
    if (sort === 'denomination')
      diff =
        (a.denomination_unit ?? '').localeCompare(b.denomination_unit ?? '') ||
        (a.denomination_value ?? Infinity) - (b.denomination_value ?? Infinity)
    if (sort === 'added') diff = b.catalogued_at.localeCompare(a.catalogued_at)
    return diff || a.id.localeCompare(b.id)
  })
  return {
    items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: items.length,
  }
}
