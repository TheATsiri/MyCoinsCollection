import { useLanguage } from '../i18n/useLanguage'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { CoinImage } from '../types/coin'
import { imageUrl } from '../lib/supabase'
export default function Lightbox({
  images,
  start,
  onClose,
}: {
  images: CoinImage[]
  start: number
  onClose: () => void
}) {
  const { t } = useLanguage()

  const [index, setIndex] = useState(start),
    ref = useRef<HTMLDialogElement>(null)
  const image = images[index]
  useEffect(() => {
    const previous = document.activeElement,
      dialog = ref.current!,
      overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  const move = (delta: number) =>
    setIndex((i) => (i + delta + images.length) % images.length)
  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={t('Enlarged coin photograph')}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          move(-1)
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          move(1)
        }
        if (e.key === 'Tab') {
          const buttons = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button:not(:disabled)',
            ),
          )
          const first = buttons[0],
            last = buttons.at(-1)
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }}
    >
      <button
        className="lightbox-close icon-button"
        onClick={onClose}
        aria-label={t('Close image viewer')}
      >
        <X />
      </button>
      <div className="lightbox-content">
        <img src={imageUrl(image.image_path)} alt={image.alt_text} />
        <p>
          {t(image.side)} · {index + 1} / {images.length}
        </p>
        {image.credit && <small>{image.credit}</small>}
      </div>
      {images.length > 1 && (
        <>
          <button
            className="lightbox-prev icon-button"
            aria-label={t('Previous image')}
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </button>
          <button
            className="lightbox-next icon-button"
            aria-label={t('Next image')}
            onClick={() => move(1)}
          >
            <ChevronRight />
          </button>
        </>
      )}
    </dialog>
  )
}
