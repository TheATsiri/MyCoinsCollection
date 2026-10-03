import { useEffect } from 'react'
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title + ' · My Coin Collection'
  }, [title])
}
