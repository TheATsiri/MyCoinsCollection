import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
export default function CollectionUpdates() {
  const client = useQueryClient()
  useEffect(() => {
    if (!supabase) return
    let connected = false,
      timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      if (timer) return
      timer = setTimeout(() => {
        timer = undefined
        void client.invalidateQueries({
          predicate: (query) =>
            ['coins', 'coin', 'filter-options'].includes(
              String(query.queryKey[0]),
            ),
        })
      }, 150)
    }
    const channel = supabase
      .channel('public-collection', { config: { private: false } })
      .on('broadcast', { event: 'refresh' }, refresh)
      .subscribe((status) => {
        connected = status === 'SUBSCRIBED'
        if (connected) refresh()
      })
    const interval = setInterval(() => {
      if (!connected && document.visibilityState === 'visible') refresh()
    }, 30_000)
    const visible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearInterval(interval)
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', visible)
      void supabase?.removeChannel(channel)
    }
  }, [client])
  return null
}
