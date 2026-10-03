import { Globe2, ArrowRight } from 'lucide-react'
import CoinCard from './CoinCard'
import type { Coin } from '../types/coin'
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <Globe2 />
      <h2>The collection is temporarily unavailable</h2>
      <p>We could not reach the catalogue. Please try again in a moment.</p>
      <button className="button" onClick={retry}>
        Try again <ArrowRight size={16} />
      </button>
    </div>
  )
}
export function LoadingGrid() {
  return (
    <div className="coin-grid" role="status" aria-label="Loading coins">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton-card">
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}
export function Cards({ coins }: { coins: Coin[] }) {
  return (
    <div className="coin-grid">
      {coins.map((c) => (
        <CoinCard key={c.id} coin={c} />
      ))}
    </div>
  )
}
