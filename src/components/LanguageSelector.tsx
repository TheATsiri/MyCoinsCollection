import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useLanguage } from '../i18n/useLanguage'
const languages = [
  { code: 'en', name: 'English', flag: '/flags/gb.svg' },
  { code: 'de', name: 'Deutsch', flag: '/flags/de.svg' },
  { code: 'el', name: 'Ελληνικά', flag: '/flags/gr.svg' },
] as const
export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = languages.find((item) => item.code === language)!
  useEffect(() => {
    if (!open) return
    ref.current
      ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target))
        setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])
  return (
    <div
      className="language-selector"
      ref={ref}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setOpen(false)
          trigger.current?.focus()
        }
        if (
          open &&
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
        ) {
          event.preventDefault()
          const buttons = Array.from(
            ref.current!.querySelectorAll<HTMLButtonElement>(
              '.language-option',
            ),
          )
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          )
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (index +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    buttons.length) %
                  buttons.length
          buttons[next]?.focus()
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="language-trigger"
        aria-label={`${t('Change language')}: ${selected.name}`}
        aria-expanded={open}
        aria-controls="language-options"
        onClick={() => setOpen(!open)}
      >
        <img src={selected.flag} alt="" width="26" height="18" />
        <span className="language-code">{selected.code.toUpperCase()}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="language-options"
          id="language-options"
          role="group"
          aria-label={t('Language')}
        >
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              className="language-option"
              lang={item.code}
              aria-pressed={language === item.code}
              onClick={() => {
                setLanguage(item.code)
                setOpen(false)
                trigger.current?.focus()
              }}
            >
              <img src={item.flag} alt="" width="26" height="18" />
              <span>{item.name}</span>
              {language === item.code && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
