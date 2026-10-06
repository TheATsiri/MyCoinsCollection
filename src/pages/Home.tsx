import CoinCarousel from '../components/CoinCarousel'
import { useLanguage } from '../i18n/useLanguage'
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
import { ErrorState, LoadingGrid } from '../components/States'
export default function Home() {
  const { t } = useLanguage()

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
            {t('HISTORY, HELD IN YOUR HAND')}
          </p>
          <h1>
            {t('Small objects.')}
            <br />
            {t('Extraordinary')} <em>{t('stories.')}</em>
          </h1>
          <p className="hero-description">
            {t(
              'A personal collection of coins, and the places, people and moments they carry. Take a closer look. There’s a world on every side.',
            )}
          </p>
          <div className="hero-actions">
            <Link className="button" to="/collection">
              {t('Explore the collection')} <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link" to="/about">
              {t('The story behind it')} <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-caption">
            <span className="caption-line" />
            <p>
              {t('A little history. A little artistry.')}
              <br />
              {t('A lifetime of curiosity.')}
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
            alt={t('Original illustrative silver coin artwork')}
            width="400"
            height="400"
          />
          <img
            className="hero-coin hero-coin-front"
            src="/demo/euro-obverse.svg"
            alt={t('Original illustrative bimetallic coin artwork')}
            width="400"
            height="400"
          />
          <div className="art-label">
            <span className="small-line" />
            <p>
              {t('Two sides.')}
              <br />
              <strong>{t('One remarkable story.')}</strong>
            </p>
          </div>
          <span className="art-footnote">{t('ILLUSTRATIVE ARTWORK')}</span>
        </div>
      </section>
      <div className="values-strip">
        <div className="container">
          <span>
            <Globe2 size={18} />
            {t('A world of discoveries')}
          </span>
          <span>
            <Layers3 size={18} />
            {t('Details worth preserving')}
          </span>
          <span>
            <BookOpen size={18} />
            {t('Stories through time')}
          </span>
        </div>
      </div>
      <section className="container section">
        <div className="section-header">
          <div>
            <p className="eyebrow">{t('THE CABINET')}</p>
            <h2>{t('A few discoveries to begin with')}</h2>
          </div>
          <Link className="text-link" to="/collection">
            {t('View the collection')} <ArrowRight size={18} />
          </Link>
        </div>
        {query.isPending ? (
          <LoadingGrid />
        ) : query.isError ? (
          <ErrorState retry={() => void query.refetch()} />
        ) : query.data.items.length ? (
          <CoinCarousel coins={query.data.items} />
        ) : (
          <div className="empty-state">
            <Coins />
            <h3>{t('The first chapter is still being catalogued')}</h3>
            <p>{t('Published specimens will appear here.')}</p>
          </div>
        )}
        {isDemo && (
          <p className="sample-note">
            {t(
              'Preview catalogue · The example records and illustrations are not the owner’s collection.',
            )}
          </p>
        )}
      </section>
      <section className="story-section">
        <div className="container story-inner">
          <span className="story-mark">
            <Coins size={52} strokeWidth={1} />
          </span>
          <div>
            <p className="eyebrow">{t('MORE THAN METAL')}</p>
            <h2>
              {t('Every coin is a tiny')}
              <br />
              <em>{t('time capsule.')}</em>
            </h2>
          </div>
          <div>
            <p>
              {t(
                'A portrait, a symbol, a date. The smallest details connect us to something much larger. This collection gives each specimen room to tell its story.',
              )}
            </p>
            <Link className="text-link" to="/about">
              {t('About the collection')} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <div className="container closing-line">
        <span>{t('LOOK CLOSELY. STAY CURIOUS.')}</span>
        <ArrowDown size={18} />
      </div>
    </>
  )
}
