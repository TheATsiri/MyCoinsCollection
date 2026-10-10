import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { useLanguage } from '../i18n/useLanguage'
import { getReviews, submitReview } from '../lib/reviews'
import { isDemo } from '../lib/supabase'
import type { ReviewSort, ReviewSubmission } from '../types/review'
import ReviewVerification from './ReviewVerification'
const interpretations = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
function Stars({ rating }: { rating: number }) {
  const { t } = useLanguage()
  return (
    <span
      className="review-stars"
      role="img"
      aria-label={t('{rating} out of 5 stars', { rating })}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={20}
          fill={n <= Math.round(rating) ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
export default function CoinReviews({ coinId }: { coinId: string }) {
  const { t, language } = useLanguage()
  const [sort, setSort] = useState<ReviewSort>('newest'),
    [page, setPage] = useState(1)
  const [rating, setRating] = useState(0),
    [hover, setHover] = useState(0),
    [name, setName] = useState(''),
    [text, setText] = useState(''),
    [website, setWebsite] = useState('')
  const [token, setToken] = useState(''),
    [verification, setVerification] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [sent, setSent] = useState(false)
  const locked = useRef(false),
    receipt = useRef<{ signature: string; id: string } | null>(null)
  const onToken = useCallback((value: string) => setToken(value), [])
  const query = useQuery({
    queryKey: ['reviews', coinId, sort, page],
    queryFn: () => getReviews(coinId, sort, page),
    refetchInterval: isDemo ? false : 30000,
  })
  const data = query.data,
    configured = !isDemo && !!import.meta.env.VITE_TURNSTILE_SITE_KEY
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (locked.current) return
    if (!rating) {
      setMessage('Choose a rating from 1 to 5')
      return
    }
    if (!name.trim()) {
      setMessage('Enter a display name (1–100 characters)')
      return
    }
    if (!token) {
      setMessage('Complete the verification and try again')
      return
    }
    locked.current = true
    setBusy(true)
    setMessage('')
    const signature = JSON.stringify([coinId, name.trim(), rating, text.trim()])
    if (receipt.current?.signature !== signature)
      receipt.current = { signature, id: crypto.randomUUID() }
    const body: ReviewSubmission = {
      submission_id: receipt.current.id,
      coin_id: coinId,
      display_name: name.trim(),
      rating,
      review_text: text.trim(),
      website,
      token,
    }
    try {
      await submitReview(body)
      setSent(true)
      setMessage('Thank you! Your review will appear after approval.')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Review could not be saved. Please try again.',
      )
    } finally {
      locked.current = false
      setBusy(false)
      setToken('')
      setVerification((n) => n + 1)
    }
  }
  return (
    <section className="coin-reviews" aria-labelledby={`reviews-${coinId}`}>
      <p className="eyebrow">{t('COLLECTOR FEEDBACK')}</p>
      <h2 id={`reviews-${coinId}`}>{t('Ratings & reviews')}</h2>
      {query.isPending && <p role="status">{t('Please wait…')}</p>}
      {query.isError && (
        <div role="alert">
          <p>{t('Reviews could not be loaded.')}</p>
          <button onClick={() => void query.refetch()}>{t('Retry')}</button>
        </div>
      )}
      {data && (
        <>
          <div className="review-summary">
            <div>
              {data.total ? (
                <>
                  <p className="review-average">
                    {Number(data.average).toFixed(1)} <small>/ 5</small>
                  </p>
                  <Stars rating={data.average!} />
                  <p>
                    {t('{count} ratings', { count: data.total })} ·{' '}
                    {t('{count} written reviews', {
                      count: data.written_count,
                    })}
                  </p>
                </>
              ) : (
                <p>{t('No ratings yet. Be the first to rate this coin!')}</p>
              )}
            </div>
            {data.total > 0 && (
              <div className="review-distribution">
                {[5, 4, 3, 2, 1].map((level) => {
                  const count = data.distribution[level] ?? 0,
                    percentage = Math.round((count / data.total) * 100)
                  return (
                    <div key={level}>
                      <span>
                        {level} <Star size={14} aria-hidden="true" />
                      </span>
                      <meter
                        min={0}
                        max={data.total}
                        value={count}
                        aria-label={t('{rating} out of 5 stars', {
                          rating: level,
                        })}
                      />
                      <span>
                        {percentage}% ({count})
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {data.total > 0 && (
            <>
              <label className="review-sort">
                {t('Sort reviews')}
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as ReviewSort)
                    setPage(1)
                  }}
                >
                  {(['newest', 'oldest', 'highest', 'lowest'] as const).map(
                    (s) => (
                      <option key={s} value={s}>
                        {t(
                          {
                            newest: 'Newest first',
                            oldest: 'Oldest first',
                            highest: 'Highest rating',
                            lowest: 'Lowest rating',
                          }[s],
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="review-list">
                {data.items.map((review) => (
                  <article className="review-card" key={review.id}>
                    <div className="review-card-heading">
                      <strong>{review.display_name}</strong>
                      <time dateTime={review.created_at}>
                        {new Intl.DateTimeFormat(language, {
                          dateStyle: 'medium',
                        }).format(new Date(review.created_at))}
                      </time>
                    </div>
                    <Stars rating={review.rating} />
                    {review.review_text && (
                      <p className="review-text">{review.review_text}</p>
                    )}
                  </article>
                ))}
              </div>
              <nav className="review-pagination" aria-label={t('Review pages')}>
                <button
                  disabled={page === 1 || query.isFetching}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('Previous')}
                </button>
                <span>
                  {t('Page')} {page} {t('of')}{' '}
                  {Math.max(1, Math.ceil(data.total / 10))}
                </span>
                <button
                  disabled={page * 10 >= data.total || query.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('Next')}
                </button>
              </nav>
            </>
          )}
        </>
      )}
      <div className="review-form-panel">
        <h3>{t('Rate this coin')}</h3>
        {!configured ? (
          <p>
            {t(
              isDemo
                ? 'Reviews are unavailable in the demonstration.'
                : 'Reviews are temporarily unavailable',
            )}
          </p>
        ) : (
          !sent && (
            <form
              className="review-form"
              onSubmit={(event) => void submit(event)}
            >
              <fieldset disabled={busy}>
                <legend>{t('Your rating (required)')}</legend>
                <div className="star-picker" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} onMouseEnter={() => setHover(n)}>
                      <input
                        type="radio"
                        name={`rating-${coinId}`}
                        value={n}
                        checked={rating === n}
                        required
                        onChange={() => setRating(n)}
                        aria-label={t('{rating} stars — {meaning}', {
                          rating: n,
                          meaning: t(interpretations[n - 1]),
                        })}
                      />
                      <Star
                        size={30}
                        aria-hidden="true"
                        fill={n <= (hover || rating) ? 'currentColor' : 'none'}
                      />
                    </label>
                  ))}
                </div>
                <p className="rating-meaning">
                  {rating
                    ? t(interpretations[rating - 1])
                    : t('Choose a rating from 1 to 5')}
                </p>
                <label>
                  {t('Display name')}
                  <input
                    required
                    maxLength={100}
                    autoComplete="nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  {t('Written review (optional)')}
                  <textarea
                    aria-describedby={`review-length-${coinId}`}
                    maxLength={2000}
                    rows={4}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </label>
                <small id={`review-length-${coinId}`}>
                  {text.length} / 2,000
                </small>
                <label className="review-honeypot" aria-hidden="true">
                  Website
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
                <p>
                  {t(
                    'Your display name and review will be public after approval. Do not include private information.',
                  )}
                </p>
                <ReviewVerification key={verification} onToken={onToken} />
                <button
                  className="button"
                  type="submit"
                  disabled={!token || busy}
                >
                  {t(busy ? 'Please wait…' : 'Submit review')}
                </button>
              </fieldset>
            </form>
          )
        )}
        {message && <p role={sent ? 'status' : 'alert'}>{t(message)}</p>}
      </div>
    </section>
  )
}
