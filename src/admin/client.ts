import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { supabase } from '../lib/supabase'
export const adminClient = supabase
  ? createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL.trim(),
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY.trim(),
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'coin-admin-session',
        },
      },
    )
  : null
export function admin() {
  if (!adminClient)
    throw new Error('Administration requires a connected Supabase project.')
  return adminClient
}
