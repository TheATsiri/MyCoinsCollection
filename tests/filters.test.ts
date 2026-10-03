import { describe, it, expect } from 'vitest'
import { filterDemo, readSearch, validateYears } from '../src/lib/filters'
import { EMPTY_FILTERS } from '../src/types/coin'
import { demoCoins } from '../src/features/coins/demo'
describe('collection queries', () => {
  it('combines keyword, authority and year range', () => {
    expect(
      filterDemo(
        demoCoins,
        {
          ...EMPTY_FILTERS,
          q: 'border',
          country: 'Italy',
          yearFrom: '2000',
          yearTo: '2003',
        },
        'year_desc',
        1,
      ).items.map((c) => c.issuing_authority),
    ).toEqual(['Italy'])
  })
  it('never includes drafts, even if they match a search', () => {
    const draft = {
      ...demoCoins[0],
      id: 'draft',
      name: 'Private draft',
      is_published: false,
    }
    expect(
      filterDemo(
        [...demoCoins, draft],
        { ...EMPTY_FILTERS, q: 'Private draft' },
        'added',
        1,
      ).total,
    ).toBe(0)
  })
  it('keeps unknown years last and excludes them from year ranges', () => {
    const all = filterDemo(demoCoins, EMPTY_FILTERS, 'year_asc', 1)
    expect(all.items.at(-1)?.year).toBeNull()
    expect(
      filterDemo(
        demoCoins,
        { ...EMPTY_FILTERS, yearFrom: '1900' },
        'year_desc',
        1,
      ).items.every((c) => c.year !== null),
    ).toBe(true)
  })
  it('searches references and treats wildcards as literal text', () => {
    const coin = {
      ...demoCoins[0],
      coin_references: [
        {
          id: 'ref',
          coin_id: demoCoins[0].id,
          catalogue: 'Sample catalogue',
          reference_number: 'ABC-123',
          edition: null,
          source_url: null,
        },
      ],
    }
    expect(
      filterDemo([coin], { ...EMPTY_FILTERS, q: 'abc-123' }, 'added', 1).total,
    ).toBe(1)
    expect(
      filterDemo(demoCoins, { ...EMPTY_FILTERS, q: '%' }, 'added', 1).total,
    ).toBe(0)
  })
  it('paginates across the complete result set with stable ties', () => {
    const records = Array.from({ length: 55 }, (_, i) => ({
      ...demoCoins[0],
      id: String(i).padStart(3, '0'),
    }))
    const page = filterDemo(records, EMPTY_FILTERS, 'year_desc', 2)
    expect(page.total).toBe(55)
    expect(page.items).toHaveLength(24)
    expect(page.items[0].id).toBe('024')
  })
  it('normalizes hostile query parameters and validates year ranges', () => {
    expect(
      readSearch(new URLSearchParams('page=-3&sort=drop-table')).page,
    ).toBe(1)
    expect(readSearch(new URLSearchParams('sort=bad')).sort).toBe('year_desc')
    expect(
      validateYears({ ...EMPTY_FILTERS, yearFrom: '2020', yearTo: '2000' }),
    ).toMatch(/starting year/)
    expect(validateYears({ ...EMPTY_FILTERS, yearFrom: '0' })).toMatch(
      /between/,
    )
  })
})
