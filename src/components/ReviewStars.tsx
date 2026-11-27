import { useId } from 'react'
import { Star } from 'lucide-react'
import { useLanguage } from '../i18n/useLanguage'
export default function ReviewStars({ rating }: { rating: number }) {
  const { t } = useLanguage()
  const starId = useId().replace(/:/g, '')
  return (
    <span
      className="review-stars"
      role="img"
      aria-label={t('{rating} out of 5 stars', { rating })}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span className="review-star" key={n} aria-hidden="true">
          <Star size={20} />
          <svg width="20" height="20" viewBox="0 0 24 24">
            <defs>
              <clipPath id={`star-${starId}-${n}`}>
                <rect
                  width={24 * Math.max(0, Math.min(1, rating - n + 1))}
                  height="24"
                />
              </clipPath>
            </defs>
            <path
              clipPath={`url(#star-${starId}-${n})`}
              fill="currentColor"
              d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z"
            />
          </svg>
        </span>
      ))}
    </span>
  )
}
