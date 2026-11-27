import CollectionReviewFeed from '../components/CollectionReviewFeed'
import { useTitle } from '../hooks/useTitle'

export default function PublicReviews() {
  useTitle('All Reviews')
  return (
    <section className="container section public-review-feed">
      <CollectionReviewFeed />
    </section>
  )
}
