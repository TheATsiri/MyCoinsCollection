import { useState } from 'react'
import { ArrowUpRight, Repeat2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Coin } from '../types/coin'
import { imageUrl } from '../lib/supabase'
export default function CoinCard({ coin }: { coin: Coin }) {
  const [failedPath, setFailedPath] = useState<string | null>(null)
  const [side, setSide] = useState<'obverse' | 'reverse'>('obverse')
  const image =
    coin.coin_images.find((i) => i.side === side) ?? coin.coin_images[0]
  return (
    <article className="coin-card">
      <div className="coin-stage">
        <Link to={'/coins/' + coin.slug} tabIndex={-1} aria-hidden="true">
          {image && failedPath !== image.image_path ? (
            <img
              loading="lazy"
              width="300"
              height="300"
              src={imageUrl(image.thumbnail_path ?? image.image_path)}
              alt=""
              onError={() => setFailedPath(image.image_path)}
            />
          ) : (
            <span className="photo-placeholder">
              {image ? 'Photograph unavailable' : 'Photograph to come'}
            </span>
          )}
        </Link>
        <span className="side-label">{image?.side ?? 'No image'}</span>
        {coin.coin_images.some((i) => i.side === 'reverse') &&
          coin.coin_images.some((i) => i.side === 'obverse') && (
            <button
              className="flip-button"
              onClick={() =>
                setSide(side === 'obverse' ? 'reverse' : 'obverse')
              }
              aria-label={
                'Show ' +
                (side === 'obverse' ? 'reverse' : 'obverse') +
                ' of ' +
                coin.name
              }
            >
              <Repeat2 size={16} />
            </button>
          )}
      </div>
      <div className="coin-card-copy">
        <div className="coin-eyebrow">
          {coin.issuing_authority}
          <span>{coin.year ?? 'Undated'}</span>
        </div>
        <h3>
          <Link to={'/coins/' + coin.slug}>
            {coin.name}
            <ArrowUpRight size={17} />
          </Link>
        </h3>
        <p>
          {coin.denomination ?? 'Denomination unknown'}
          <span>·</span>
          {coin.metal ?? 'Metal unknown'}
        </p>
      </div>
    </article>
  )
}
