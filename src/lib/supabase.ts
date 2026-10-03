import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const isDemo =
  import.meta.env.VITE_DEMO_MODE === 'true' || (!url && !key)
export const configurationError =
  !isDemo && (!url || !key || !/^https:\/\//.test(url))
    ? 'Supabase settings are incomplete. Set the project HTTPS URL and publishable key.'
    : null
export const supabase =
  !isDemo && !configurationError
    ? createClient<Database>(url!, key!, { auth: { persistSession: false } })
    : null
export function imageUrl(path: string) {
  if (isDemo) return path.startsWith('/demo/') ? path : '/demo/euro-obverse.svg'
  return (
    supabase?.storage.from('coin-photos').getPublicUrl(path).data.publicUrl ??
    ''
  )
}
