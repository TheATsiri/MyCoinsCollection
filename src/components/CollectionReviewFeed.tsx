import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { getCollectionReviews } from '../lib/reviews'
import { isDemo } from '../lib/supabase'
import ReviewStars from './ReviewStars'

export default function CollectionReviewFeed({ lastWeek = false }) {
  const { language, t } = useLanguage()
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['reviews', 'collection', lastWeek, page],
    queryFn: () => getCollectionReviews(lastWeek, page),
    refetchInterval: isDemo ? false : 30_000,
  })
  const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: 'medium' })
  const numberFormat = new Intl.NumberFormat(language)
  const heading = lastWeek ? (
    <h2 id="weekly-reviews-title">{t('Ratings & Reviews – Last Week')}</h2>
  ) : (
    <h1>{t('All Reviews')}</h1>
  )
  const data = query.data
  const pageCount = Math.min(10_000, Math.ceil((data?.total ?? 0) / 10))

  return (
    <>
      {heading}
      {lastWeek && <p className="review-feed-period">{t('Last 7 days')}</p>}
      {query.isPending && <p role="status">{t('Please wait…')}</p>}
      {query.isError && (
        <div role="alert">
          <p>{t('Reviews could not be loaded.')}</p>
          <button type="button" onClick={() => void query.refetch()}>
            {t('Retry')}
          </button>
        </div>
      )}
      {data && (
        <>
          <div className="review-feed-summary">
            {lastWeek && data.average !== null && (
              <p className="review-average">
                <Star size={22} fill="currentColor" aria-hidden="true" />
                {data.average.toLocaleString(language, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                <small>/ 5</small>
              </p>
            )}
            <p role="status">
              {t(data.total === 1 ? '{count} review' : '{count} reviews', {
                count: numberFormat.format(data.total),
              })}
            </p>
          </div>
          {data.total === 0 && (
            <p>
              {t(
                lastWeek ? 'No reviews in the last 7 days' : 'No reviews yet.',
              )}
            </p>
          )}
          {data.items.length > 0 && (
            <ul className="review-feed-list">
              {data.items.map((review) => (
                <li key={review.id}>
                  <ReviewStars rating={review.rating} />
                  <p className="review-feed-comment">
                    {review.review_text ?? t('Rating only')}
                  </p>
                  <div className="review-feed-details">
                    <time dateTime={review.created_at}>
                      {dateFormat.format(new Date(review.created_at))}
                    </time>
                    <Link to={`/coins/${review.coin_slug}`}>
                      {review.coin_name}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!lastWeek && (pageCount > 1 || page > 1) && (
            <nav className="review-pagination" aria-label={t('Review pages')}>
              <button
                type="button"
                disabled={page === 1}
                onClick={() =>
                  setPage(page > pageCount ? Math.max(1, pageCount) : page - 1)
                }
              >
                {t('Previous')}
              </button>
              {page <= pageCount && (
                <span>
                  {t('Page')} {page} {t('of')} {pageCount}
                </span>
              )}
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}
              >
                {t('Next')}
              </button>
            </nav>
          )}
        </>
      )}
      {lastWeek && (
        <Link className="button review-feed-button" to="/reviews">
          {t('View All Reviews')} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </>
  )
}
