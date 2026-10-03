import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LanguageContext, LANGUAGE_STORAGE_KEY } from './useLanguage'
import { translate } from './translations'
import type { Language } from './translations'
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === 'en' || saved === 'de' || saved === 'el') return saved
  } catch {
    /* Preferences remain usable when browser storage is disabled. */
  }
  return 'en'
}
export default function LanguageProvider({
  children,
}: {
  children: ReactNode
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  useEffect(() => {
    document.documentElement.lang = language
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      /* Keep the current session preference. */
    }
  }, [language])
  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: (key, values) => translate(language, key, values),
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}
