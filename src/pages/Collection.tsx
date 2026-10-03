import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useTitle } from '../hooks/useTitle'
import { useDebounce } from '../hooks/useDebounce'
import { listCoins, getFilterOptions } from '../lib/api'
import { readSearch, sortOptions, validateYears } from '../lib/filters'
import { isDemo } from '../lib/supabase'
import { PAGE_SIZE } from '../types/coin'
import type { CoinFilters } from '../types/coin'
import { Cards, ErrorState, LoadingGrid } from '../components/States'
export default function Collection() {
  useTitle('The collection')
  const [params, setParams] = useSearchParams(),
    { filters, sort, page } = readSearch(params),
    debouncedQ = useDebounce(filters.q, 300)
  const effective = { ...filters, q: debouncedQ },
    yearError = validateYears(filters)
  const options = useQuery({
    queryKey: ['filter-options'],
    queryFn: getFilterOptions,
  })
  const query = useQuery({
    queryKey: ['coins', effective, sort, page],
    queryFn: () => listCoins(effective, sort, page),
    enabled: !yearError,
  })
  const [showFilters, setShowFilters] = useState(false)
  const change = (key: keyof CoinFilters | 'sort' | 'page', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }
  const clear = () => {
    const next = new URLSearchParams()
    if (sort !== 'year_desc') next.set('sort', sort)
    setParams(next)
  }
  const active = (Object.keys(filters) as (keyof CoinFilters)[]).filter(
    (k) => !!filters[k],
  )
  const select = (key: keyof CoinFilters, label: string, values: string[]) => (
    <label className="filter-field" key={key}>
      {label}
      <select
        value={filters[key]}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">All {label.toLowerCase()}</option>
        {[...new Set([...values, ...(filters[key] ? [filters[key]] : [])])].map(
          (v) => (
            <option key={v}>{v}</option>
          ),
        )}
      </select>
    </label>
  )
  const choices = options.data ?? {
      countries: [],
      periods: [],
      denominations: [],
      metals: [],
      grades: [],
    },
    totalPages = Math.ceil((query.data?.total ?? 0) / PAGE_SIZE)
  return (
    <section className="container collection-section">
      <div className="page-intro">
        <p className="eyebrow">THE COLLECTION</p>
        <h1>A world, one coin at a time.</h1>
        <p>
          Browse the cabinet. Follow a country, a year, or simply your
          curiosity.
        </p>
      </div>
      <div className="catalogue-toolbar">
        <label className="search-field">
          <Search size={20} />
          <span className="sr-only">Search the collection</span>
          <input
            value={filters.q}
            onChange={(e) => change('q', e.target.value)}
            placeholder="Search coins, countries, stories…"
            type="search"
          />
        </label>
        <button
          className={'filter-toggle ' + (showFilters ? 'selected' : '')}
          aria-expanded={showFilters}
          aria-controls="catalogue-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
          Filters {active.length > 0 && <span>{active.length}</span>}
        </button>
      </div>
      <div className="catalogue-layout">
        <aside
          id="catalogue-filters"
          className={'filters ' + (showFilters ? 'filters-open' : '')}
        >
          <div className="filter-heading">
            <h2>Refine your discoveries</h2>
            <button className="text-link" onClick={clear}>
              Reset
            </button>
          </div>
          {options.isError && (
            <p className="inline-error">
              Filter choices could not load.{' '}
              <button onClick={() => void options.refetch()}>Retry</button>
            </p>
          )}
          {select('country', 'Countries / authorities', choices.countries)}
          <fieldset className="year-fields">
            <legend>Minting year</legend>
            <label>
              <span className="sr-only">From year</span>
              <input
                aria-invalid={!!yearError}
                aria-describedby={yearError ? 'year-error' : undefined}
                inputMode="numeric"
                placeholder="From"
                value={filters.yearFrom}
                onChange={(e) => change('yearFrom', e.target.value)}
                maxLength={4}
              />
            </label>
            <span>–</span>
            <label>
              <span className="sr-only">To year</span>
              <input
                aria-invalid={!!yearError}
                aria-describedby={yearError ? 'year-error' : undefined}
                inputMode="numeric"
                placeholder="To"
                value={filters.yearTo}
                onChange={(e) => change('yearTo', e.target.value)}
                maxLength={4}
              />
            </label>
          </fieldset>
          {select('period', 'Periods', choices.periods)}
          {select('denomination', 'Denominations', choices.denominations)}
          {select('metal', 'Metals', choices.metals)}
          {select('grade', 'Grades', choices.grades)}
          <div className="filter-note">
            <BookOpen size={18} />
            <p>
              A catalogue of individual specimens. Unknown details are left
              open, never guessed.
            </p>
          </div>
        </aside>
        <div className="catalogue-results">
          <div className="results-topline">
            <p aria-live="polite">
              {query.isPending ? (
                'Discovering…'
              ) : query.isError ? (
                'Catalogue unavailable'
              ) : (
                <>
                  <strong>{query.data?.total ?? 0}</strong>{' '}
                  {(query.data?.total ?? 0) === 1 ? 'coin' : 'coins'} to explore
                </>
              )}
            </p>
            <label>
              Sort by{' '}
              <select
                aria-label="Sort coins"
                value={sort}
                onChange={(e) => change('sort', e.target.value)}
              >
                {sortOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!!active.length && (
            <div className="filter-chips">
              {active.map((key) => (
                <button
                  key={key}
                  onClick={() => change(key, '')}
                  aria-label={'Remove ' + key + ' filter'}
                >
                  {filters[key]}
                  <X size={13} />
                </button>
              ))}
            </div>
          )}
          {yearError ? (
            <p id="year-error" className="inline-error" role="alert">
              {yearError}
            </p>
          ) : query.isPending ? (
            <LoadingGrid />
          ) : query.isError ? (
            <ErrorState retry={() => void query.refetch()} />
          ) : query.data.items.length ? (
            <Cards coins={query.data.items} />
          ) : (
            <div className="empty-state">
              <Search />
              <h2>
                {page > 1 ? 'No coins on this page' : 'No discoveries just yet'}
              </h2>
              <p>Try a different keyword or broaden your filters.</p>
              <button
                className="button"
                onClick={() => (page > 1 ? change('page', '1') : clear())}
              >
                {page > 1 ? 'Return to page one' : 'Clear filters'}
              </button>
            </div>
          )}
          {totalPages > 1 && (
            <nav className="pagination" aria-label="Catalogue pages">
              <button
                disabled={page <= 1}
                onClick={() => change('page', String(page - 1))}
              >
                <ChevronLeft size={17} />
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => change('page', String(page + 1))}
              >
                Next
                <ChevronRight size={17} />
              </button>
            </nav>
          )}
          {isDemo && (
            <p className="sample-note">
              Illustrative preview records · Replace with your verified
              specimens through Supabase.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
