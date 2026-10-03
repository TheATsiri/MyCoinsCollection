import { useLanguage } from '../i18n/useLanguage'
import { useEffect } from 'react'
export function useTitle(title: string) {
  const { t, language } = useLanguage()
  useEffect(() => {
    document.title = t(title) + ' · ' + t('My Coin Collection')
  }, [title, language, t])
}
