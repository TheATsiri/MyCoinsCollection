import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'
type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}
let loading: Promise<void> | undefined
function load() {
  if (window.turnstile) return Promise.resolve()
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        loading = undefined
        script.remove()
        reject(new Error('Verification unavailable'))
      }
      document.head.append(script)
    })
  return loading
}
export default function ReviewVerification({
  onToken,
}: {
  onToken: (token: string) => void
}) {
  const node = useRef<HTMLDivElement>(null),
    { t, language } = useLanguage(),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true,
      id: string | undefined
    onToken('')
    load()
      .then(() => {
        if (!active || !node.current || !window.turnstile) return
        id = window.turnstile.render(node.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          action: 'coin-review',
          language,
          callback: (token: string) => {
            setFailed(false)
            onToken(token)
          },
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('')
            setFailed(true)
          },
        })
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (id) window.turnstile?.remove(id)
    }
  }, [onToken, language])
  return (
    <div className="review-verification">
      <div ref={node} />
      {failed && (
        <p role="alert">
          {t('Verification unavailable. Reload the page to try again.')}
        </p>
      )}
    </div>
  )
}
