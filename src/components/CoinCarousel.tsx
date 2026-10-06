import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'
import CoinCard from './CoinCard'
import { useLanguage } from '../i18n/useLanguage'
import type { Coin } from '../types/coin'

const motionQuery = '(prefers-reduced-motion: reduce)'
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

export default function CoinCarousel({ coins }: { coins: Coin[] }) {
  const { t } = useLanguage()
  const track = useRef<HTMLDivElement>(null)
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => true,
  )
  const [playing, setPlaying] = useState(true)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const [position, setPosition] = useState(1)
  const travelDirection = useRef(1)

  function move(direction: number) {
    const viewport = track.current
    if (!viewport) return
    setPlaying(false)
    const first = viewport.children[0] as HTMLElement | undefined
    const second = viewport.children[1] as HTMLElement | undefined
    const step =
      first && second
        ? second.offsetLeft - first.offsetLeft
        : viewport.clientWidth
    const end = viewport.scrollWidth - viewport.clientWidth
    const next = viewport.scrollLeft + direction * step
    viewport.scrollTo({
      left:
        next > end + 2 ? 0 : next < -2 ? end : Math.max(0, Math.min(end, next)),
      behavior: reducedMotion ? 'instant' : 'smooth',
    })
  }

  useEffect(() => {
    if (!playing || hovering || focused || reducedMotion || coins.length < 2)
      return
    const viewport = track.current
    if (!viewport) return
    let offset = viewport.scrollLeft
    let previousTime: number | undefined
    let frame: number
    const animate = (time: number) => {
      // Keep fractional pixels between frames and discard time spent in hidden tabs.
      const elapsed =
        previousTime === undefined ? 0 : Math.min(time - previousTime, 50)
      previousTime = time
      const end = viewport.scrollWidth - viewport.clientWidth
      if (!document.hidden && end > 0) {
        offset += (travelDirection.current * 32 * elapsed) / 1000
        if (offset >= end) {
          offset = end
          travelDirection.current = -1
        } else if (offset <= 0) {
          offset = 0
          travelDirection.current = 1
        }
        viewport.scrollLeft = offset
      }
      frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [playing, hovering, focused, reducedMotion, coins.length])

  return (
    <div
      className="coin-carousel"
      role="region"
      aria-roledescription={t('carousel')}
      aria-label={t('Featured coins')}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        className="coin-carousel-track"
        ref={track}
        tabIndex={0}
        aria-label={t('Browse coins with the arrow keys')}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false)
        }}
        onPointerDown={() => setPlaying(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            move(event.key === 'ArrowLeft' ? -1 : 1)
          }
        }}
        onScroll={() => {
          const viewport = track.current
          const first = viewport?.children[0] as HTMLElement | undefined
          const second = viewport?.children[1] as HTMLElement | undefined
          if (viewport && first && second)
            setPosition(
              Math.round(
                viewport.scrollLeft / (second.offsetLeft - first.offsetLeft),
              ) + 1,
            )
        }}
      >
        {coins.map((coin, index) => (
          <div
            className="coin-carousel-slide"
            key={coin.id}
            role="group"
            aria-roledescription={t('slide')}
            aria-label={t('Coin {number} of {total}', {
              number: index + 1,
              total: coins.length,
            })}
          >
            <CoinCard coin={coin} />
          </div>
        ))}
      </div>
      {coins.length > 1 && (
        <div className="coin-carousel-controls">
          <span className="coin-carousel-count">
            {String(position).padStart(2, '0')}{' '}
            <span>/ {String(coins.length).padStart(2, '0')}</span>
          </span>
          <div className="coin-carousel-progress" aria-hidden="true">
            <span style={{ width: `${(position / coins.length) * 100}%` }} />
          </div>
          <div className="coin-carousel-buttons">
            {!reducedMotion && (
              <button
                type="button"
                onClick={() => setPlaying(!playing)}
                aria-label={t(playing ? 'Pause slideshow' : 'Play slideshow')}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={t('Previous coin')}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={t('Next coin')}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
