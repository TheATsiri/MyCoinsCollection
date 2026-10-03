import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Coins,
  Globe2,
  Layers3,
} from 'lucide-react'
import { useTitle } from '../hooks/useTitle'
import { listCoins } from '../lib/api'
import { isDemo } from '../lib/supabase'
import { EMPTY_FILTERS } from '../types/coin'
import { Cards, ErrorState, LoadingGrid } from '../components/States'
export default function Home() {
  useTitle('A small museum of stories')
  const query = useQuery({
    queryKey: ['coins', 'featured'],
    queryFn: () => listCoins(EMPTY_FILTERS, 'year_desc', 1),
  })
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="small-line" />
            HISTORY, HELD IN YOUR HAND
          </p>
          <h1>
            Small objects.
            <br />
            Extraordinary <em>stories.</em>
          </h1>
          <p className="hero-description">
            A personal collection of coins, and the places, people and moments
            they carry. Take a closer look. There’s a world on every side.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/collection">
              Explore the collection <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link" to="/about">
              The story behind it <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-caption">
            <span className="caption-line" />
            <p>
              A little history. A little artistry.
              <br />A lifetime of curiosity.
            </p>
          </div>
        </div>
        <div className="hero-art">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="art-number">01 / 02</span>
          <img
            className="hero-coin hero-coin-back"
            src="/demo/silver-reverse.svg"
            alt="Original illustrative silver coin artwork"
            width="400"
            height="400"
          />
          <img
            className="hero-coin hero-coin-front"
            src="/demo/euro-obverse.svg"
            alt="Original illustrative bimetallic coin artwork"
            width="400"
            height="400"
          />
          <div className="art-label">
            <span className="small-line" />
            <p>
              Two sides.
              <br />
              <strong>One remarkable story.</strong>
            </p>
          </div>
          <span className="art-footnote">ILLUSTRATIVE ARTWORK</span>
        </div>
      </section>
      <div className="values-strip">
        <div className="container">
          <span>
            <Globe2 size={18} />A world of discoveries
          </span>
          <span>
            <Layers3 size={18} />
            Details worth preserving
          </span>
          <span>
            <BookOpen size={18} />
            Stories through time
          </span>
        </div>
      </div>
      <section className="container section">
        <div className="section-header">
          <div>
            <p className="eyebrow">THE CABINET</p>
            <h2>A few discoveries to begin with</h2>
          </div>
          <Link className="text-link" to="/collection">
            View the collection <ArrowRight size={18} />
          </Link>
        </div>
        {query.isPending ? (
          <LoadingGrid />
        ) : query.isError ? (
          <ErrorState retry={() => void query.refetch()} />
        ) : query.data.items.length ? (
          <Cards coins={query.data.items.slice(0, 4)} />
        ) : (
          <div className="empty-state">
            <Coins />
            <h3>The first chapter is still being catalogued</h3>
            <p>Published specimens will appear here.</p>
          </div>
        )}
        {isDemo && (
          <p className="sample-note">
            Preview catalogue · The example records and illustrations are not
            the owner’s collection.
          </p>
        )}
      </section>
      <section className="story-section">
        <div className="container story-inner">
          <span className="story-mark">
            <Coins size={52} strokeWidth={1} />
          </span>
          <div>
            <p className="eyebrow">MORE THAN METAL</p>
            <h2>
              Every coin is a tiny
              <br />
              <em>time capsule.</em>
            </h2>
          </div>
          <div>
            <p>
              A portrait, a symbol, a date. The smallest details connect us to
              something much larger. This collection gives each specimen room to
              tell its story.
            </p>
            <Link className="text-link" to="/about">
              About the collection <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <div className="container closing-line">
        <span>LOOK CLOSELY. STAY CURIOUS.</span>
        <ArrowDown size={18} />
      </div>
    </>
  )
}
