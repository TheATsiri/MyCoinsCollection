import { useLayoutEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useLanguage } from '../i18n/useLanguage'

// Tangent panels close the rim so the coin remains solid even edge-on.
export default function CinematicCoin() {
  const [paused, setPaused] = useState(false)
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
      const width = hero.clientWidth
      const height = hero.clientHeight
      const scale = Math.max(
        width / photo.naturalWidth,
        height / photo.naturalHeight,
      )
      const imageWidth = photo.naturalWidth * scale
      const imageHeight = photo.naturalHeight * scale
      const x = imageWidth * 0.47 + (width - imageWidth) * 0.5
      const y = imageHeight * 0.61 + (height - imageHeight) * 0.55
      const size = imageWidth * (105 / 2048)
      scene.style.setProperty('--coin-size', `${size}px`)
      scene.style.left = `${x - (size + 100) / 2}px`
      scene.style.top = `${y - size - 54}px`
      scene.style.visibility = 'visible'
    }
    const observer = new ResizeObserver(placeCoin)
    observer.observe(hero)
    photo.addEventListener('load', placeCoin)
    placeCoin()
    return () => {
      observer.disconnect()
      photo.removeEventListener('load', placeCoin)
    }
  }, [])

  return (
    <div
      ref={sceneRef}
      className={`cinematic-coin-scene${paused ? ' is-paused' : ''}`}
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
      <button
        type="button"
        className="cinematic-coin-control"
        aria-label={t(paused ? 'Play coin animation' : 'Pause coin animation')}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </div>
  )
}
