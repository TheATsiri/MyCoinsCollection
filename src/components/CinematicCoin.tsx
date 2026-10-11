import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Pause, Play } from 'lucide-react'
import { useLanguage } from '../i18n/useLanguage'

const motionQuery = '(prefers-reduced-motion: reduce)'
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

// Tangent panels close the rim so the coin remains solid even edge-on.
export default function CinematicCoin() {
  const [paused, setPaused] = useState(false)
  const [motionEnabled, setMotionEnabled] = useState(false)
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => true,
  )
  const playing = !paused && (!reducedMotion || motionEnabled)
  const sceneRef = useRef<HTMLDivElement>(null)
  const { t } = useLanguage()

  useLayoutEffect(() => {
    const scene = sceneRef.current
    const hero = scene?.closest<HTMLElement>('.cinematic-hero')
    const photo = hero?.querySelector<HTMLImageElement>(
      '.cinematic-backdrop img',
    )
    if (!scene || !hero || !photo) return

    // Use a fixed point in the source photograph, including its cover crop.
    // This is the left tabletop corner selected in the reference screenshot.
    const placeCoin = () => {
      if (!photo.naturalWidth || !photo.naturalHeight) return
      const heroBounds = hero.getBoundingClientRect()
      const photoBounds = photo.getBoundingClientRect()
      const width = photoBounds.width
      const height = photoBounds.height
      const scale = Math.max(
        width / photo.naturalWidth,
        height / photo.naturalHeight,
      )
      const imageWidth = photo.naturalWidth * scale
      const imageHeight = photo.naturalHeight * scale
      const x =
        photoBounds.left -
        heroBounds.left +
        imageWidth * 0.47 +
        (width - imageWidth) * 0.5
      const y =
        photoBounds.top -
        heroBounds.top +
        imageHeight * 0.61 +
        (height - imageHeight) * 0.55
      const size = Math.max(32, imageWidth * (105 / 2048))
      scene.style.setProperty('--coin-size', `${size}px`)
      scene.style.left = `${x - (size + 100) / 2}px`
      scene.style.top = `${y - size - 54}px`
      scene.style.visibility = 'visible'
    }
    const observer = new ResizeObserver(placeCoin)
    observer.observe(hero)
    observer.observe(photo)
    photo.addEventListener('load', placeCoin)
    placeCoin()
    return () => {
      observer.disconnect()
      photo.removeEventListener('load', placeCoin)
    }
  }, [])

  return (
    <>
      <div
        ref={sceneRef}
        className={`cinematic-coin-scene${playing ? '' : ' is-paused'}${motionEnabled ? ' user-motion-enabled' : ''}`}
      >
        <div className="cinematic-coin-stage" aria-hidden="true">
          <div className="cinematic-coin-shadow" />
          <div className="cinematic-coin-position">
            <div className="cinematic-coin-rotation">
              {Array.from({ length: 48 }, (_, index) => (
                <span
                  key={`edge-${index}`}
                  className={`cinematic-coin-edge edge-${index}`}
                />
              ))}
              <div className="cinematic-coin-face coin-obverse">
                <img
                  src="/images/hero-coin-obverse.webp"
                  alt=""
                  width="700"
                  height="700"
                />
              </div>
              <div className="cinematic-coin-face coin-reverse">
                <img
                  src="/images/hero-coin-reverse.webp"
                  alt=""
                  width="700"
                  height="700"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="cinematic-coin-control"
        aria-label={t(playing ? 'Pause coin animation' : 'Play coin animation')}
        onClick={() => {
          if (playing) setPaused(true)
          else {
            setMotionEnabled(true)
            setPaused(false)
          }
        }}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
    </>
  )
}
