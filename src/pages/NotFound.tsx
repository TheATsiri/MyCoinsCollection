import { Link } from 'react-router-dom'
import { ArrowRight, Coins } from 'lucide-react'
import { useTitle } from '../hooks/useTitle'
export default function NotFound() {
  useTitle('Page not found')
  return (
    <div className="container empty-state">
      <Coins />
      <p className="eyebrow">NOT IN THIS CABINET</p>
      <h1>This page could not be found.</h1>
      <p>The specimen may not be published, or the address may have changed.</p>
      <Link className="button" to="/collection">
        Explore the collection
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}
