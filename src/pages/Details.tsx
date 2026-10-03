import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Check, Coins, ZoomIn } from 'lucide-react'
import { useTitle } from '../hooks/useTitle'
import { getCoin } from '../lib/api'
import { imageUrl, isDemo } from '../lib/supabase'
import type { CoinImage } from '../types/coin'
import Lightbox from '../components/Lightbox'
import { ErrorState, LoadingGrid } from '../components/States'
import NotFound from './NotFound'
function Photograph({
  image,
  onOpen,
}: {
  image: CoinImage
  onOpen: () => void
}) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="detail-photo">
      <button
        onClick={(e) => {
          e.currentTarget.focus()
          onOpen()
        }}
        disabled={failed}
        aria-label={'Enlarge ' + image.side + ' photograph'}
      >
        {failed ? (
          <span>Photograph unavailable</span>
        ) : (
          <img
            src={imageUrl(image.image_path)}
            alt={image.alt_text}
            onError={() => setFailed(true)}
          />
        )}
        <span className="photo-zoom">
          <ZoomIn size={18} />
        </span>
      </button>
      <div className="photo-caption">
        <span>{image.side}</span>
        <small>{image.credit}</small>
      </div>
    </div>
  )
}
export default function Details() {
  const { slug = '' } = useParams(),
    query = useQuery({
      queryKey: ['coin', slug],
      queryFn: () => getCoin(slug),
    }),
    [lightbox, setLightbox] = useState<number | null>(null),
    c = query.data
  useTitle(c?.name ?? 'Coin details')
  if (query.isPending)
    return (
      <div className="container section">
        <LoadingGrid />
      </div>
    )
  if (query.isError)
    return (
      <div className="container section">
        <ErrorState retry={() => void query.refetch()} />
      </div>
    )
  if (!c) return <NotFound />
  const images = [...c.coin_images].sort(
    (a, b) => a.display_order - b.display_order,
  )
  const attributes: [string, string | number | null][] = [
    ['Country / issuing authority', c.issuing_authority],
    ['Minting year', c.year],
    ['Denomination', c.denomination],
    ['Metal', c.metal],
    ['Weight', c.weight_g !== null ? c.weight_g + ' g' : null],
    ['Diameter', c.diameter_mm !== null ? c.diameter_mm + ' mm' : null],
    ['Measurement source', c.measurement_source],
    ['Mint', c.mint],
    ['Mint mark', c.mint_mark],
    ['Ruler', c.ruler],
    ['Historical period', c.historical_period],
    ['Grade', c.grade],
    ['Grading system', c.grading_system],
  ]
  return (
    <section className="container detail-section">
      <Link to="/collection" className="text-link back-link">
        <ArrowLeft size={17} />
        Back to the collection
      </Link>
      <div className="detail-title">
        <div>
          <p className="eyebrow">
            {c.issuing_authority} · {c.year ?? 'UNDATED'}
          </p>
          <h1>{c.name}</h1>
          <p>
            {c.denomination ?? 'Denomination not recorded'}
            {c.metal && ' · ' + c.metal}
          </p>
        </div>
        <span className="specimen-label">
          <Check size={16} />
          Catalogue specimen
        </span>
      </div>
      {isDemo && (
        <div className="detail-demo">
          Demonstration record. The artwork is illustrative and does not
          identify or grade a real coin.
        </div>
      )}
      <div className="detail-images">
        {images.length ? (
          images.map((im, i) => (
            <Photograph key={im.id} image={im} onOpen={() => setLightbox(i)} />
          ))
        ) : (
          <div className="empty-state">
            <Coins />
            <p>Photographs have not been added yet.</p>
          </div>
        )}
      </div>
      <div className="detail-body">
        <section>
          <p className="eyebrow">A CLOSER LOOK</p>
          <h2>The details</h2>
          <dl className="specifications">
            {attributes.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? 'Not recorded'}</dd>
              </div>
            ))}
          </dl>
          {Object.keys(c.extra_attributes).length > 0 && (
            <>
              <h3>Additional specifications</h3>
              <dl className="specifications">
                {Object.entries(c.extra_attributes).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll('_', ' ')}</dt>
                    <dd>
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value ?? 'Not recorded')}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
        <section className="detail-notes">
          <p className="eyebrow">DESIGN & HISTORY</p>
          <h2>Behind the surface</h2>
          <h3>Obverse</h3>
          <p>{c.obverse_description ?? 'Description not yet recorded.'}</p>
          <h3>Reverse</h3>
          <p>{c.reverse_description ?? 'Description not yet recorded.'}</p>
          <h3>Historical notes</h3>
          <p>{c.historical_notes ?? 'Historical notes have not been added.'}</p>
          <h3>Catalogue references</h3>
          {c.coin_references.length ? (
            <ul>
              {c.coin_references.map((r) => (
                <li key={r.id}>
                  {r.catalogue} · {r.reference_number}
                  {r.edition && ' (' + r.edition + ')'}
                  {r.source_url && /^https?:\/\//.test(r.source_url) && (
                    <a href={r.source_url} target="_blank" rel="noreferrer">
                      Source
                      <ArrowUpRight size={13} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No verified references recorded.</p>
          )}
          <p className="catalogued-note">
            Added to the catalogue:{' '}
            {new Intl.DateTimeFormat('en', {
              dateStyle: 'long',
              timeZone: 'UTC',
            }).format(new Date(c.catalogued_at))}
          </p>
        </section>
      </div>
      {lightbox !== null && (
        <Lightbox
          images={images}
          start={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  )
}
