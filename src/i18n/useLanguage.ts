import { createContext, useContext } from 'react'
import { translate } from './translations'
import type { Language } from './translations'
export const LANGUAGE_STORAGE_KEY = 'my-coin-collection-language'
export const LanguageContext = createContext({
  language: 'en' as Language,
  setLanguage: (language: Language) => {
    void language
  },
  t: (key: string, values?: Record<string, string | number>) =>
    translate('en', key, values),
})
export function useLanguage() {
  return useContext(LanguageContext)
}
