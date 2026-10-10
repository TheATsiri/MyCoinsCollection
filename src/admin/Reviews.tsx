import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../i18n/useLanguage'
import { useDebounce } from '../hooks/useDebounce'
import { listAdminCoins, errorMessage } from './api'
import { listReviews, moderateReview } from '../lib/reviews'
import type { AdminReview, ReviewStatus } from '../types/review'
export default function Reviews() {
  const { t, language } = useLanguage(),
    client = useQueryClient()
  const [coin, setCoin] = useState(''),
    [rating, setRating] = useState(''),
    [status, setStatus] = useState('pending'),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [deleting, setDeleting] = useState<AdminReview | null>(null),
    locked = useRef(false)
  const debounced = useDebounce(search, 300)
  const coins = useQuery({ queryKey: ['admin-coins'], queryFn: listAdminCoins })
  const reviews = useQuery({
    queryKey: ['admin-reviews', coin, rating, status, debounced, page],
    queryFn: () =>
      listReviews({ coin, rating, status, search: debounced }, page),
  })
  async function perform(id: string, next: ReviewStatus | 'delete') {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setMessage('')
    try {
      await moderateReview(id, next)
      setDeleting(null)
      setMessage('Changes saved.')
      await client.invalidateQueries({ queryKey: ['admin-reviews'] })
      await client.invalidateQueries({ queryKey: ['reviews'] })
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return (
    <section className="container admin-page">
      <Link to="/admin" className="text-link">
        {t('Administration')}
      </Link>
      <h1>{t('Review moderation')}</h1>
      <div className="review-admin-filters">
        <label>
          {t('Search reviews')}
          <input
            type="search"
            maxLength={200}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </label>
        <label>
          {t('Coin')}
          <select
            value={coin}
            onChange={(e) => {
              setCoin(e.target.value)
              setPage(1)
            }}
          >
            <option value="">{t('All coins')}</option>
            {coins.data?.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Rating')}
          <select
            value={rating}
            onChange={(e) => {
              setRating(e.target.value)
              setPage(1)
            }}
          >
            <option value="">{t('All ratings')}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Status')}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            {['', 'pending', 'approved', 'rejected'].map((s) => (
              <option key={s} value={s}>
                {t(
                  {
                    pending: 'Pending',
                    approved: 'Approved',
                    rejected: 'Rejected',
                    '': 'All statuses',
                  }[s]!,
                )}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message && <p role="status">{t(message)}</p>}
      {(reviews.isPending || coins.isPending) && (
        <p role="status">{t('Please wait…')}</p>
      )}
      {(reviews.isError || coins.isError) && (
        <div role="alert">
          {t('Reviews could not be loaded.')}
          <button
            onClick={() => {
              void reviews.refetch()
              void coins.refetch()
            }}
          >
            {t('Retry')}
          </button>
        </div>
      )}
      {reviews.data?.total === 0 && (
        <p>{t('No reviews match these filters.')}</p>
      )}
      <div className="review-list">
        {reviews.data?.items.map((r) => (
          <article className="review-card" key={r.id}>
            <h2>{r.coins?.name}</h2>
            <p>
              <strong>{r.display_name}</strong> · {r.rating}/5 ·{' '}
              {t(
                {
                  pending: 'Pending',
                  approved: 'Approved',
                  rejected: 'Rejected',
                }[r.status],
              )}{' '}
              ·{' '}
              <time dateTime={r.created_at}>
                {new Intl.DateTimeFormat(language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(r.created_at))}
              </time>
            </p>
            {r.review_text && <p className="review-text">{r.review_text}</p>}
            <div className="admin-actions">
              <button
                disabled={busy || r.status === 'approved'}
                onClick={() => void perform(r.id, 'approved')}
              >
                {t('Approve')}
              </button>
              <button
                disabled={busy || r.status === 'rejected'}
                onClick={() => void perform(r.id, 'rejected')}
              >
                {t('Reject')}
              </button>
              <button disabled={busy} onClick={() => setDeleting(r)}>
                {t('Delete')}
              </button>
            </div>
          </article>
        ))}
      </div>
      {reviews.data && (
        <nav className="review-pagination" aria-label={t('Review pages')}>
          <button
            disabled={page === 1 || reviews.isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('Previous')}
          </button>
          <span>
            {t('Page')} {page} {t('of')}{' '}
            {Math.max(1, Math.ceil(reviews.data.total / 20))}
          </span>
          <button
            disabled={page * 20 >= reviews.data.total || reviews.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('Next')}
          </button>
        </nav>
      )}
      {deleting && (
        <div className="admin-confirm" role="alert">
          <p>{t('Permanently delete this review?')}</p>
          <button
            disabled={busy}
            onClick={() => void perform(deleting.id, 'delete')}
          >
            {t('Confirm deletion')}
          </button>
          <button disabled={busy} onClick={() => setDeleting(null)}>
            {t('Cancel')}
          </button>
        </div>
      )}
    </section>
  )
}
