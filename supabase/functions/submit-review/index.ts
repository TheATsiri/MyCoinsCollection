import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createReviewHandler } from './handler.ts'
const url = Deno.env.get('SUPABASE_URL'),
  key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
Deno.serve(
  createReviewHandler({
    origins: (Deno.env.get('REVIEW_ORIGINS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
    salt: Deno.env.get('REVIEW_RATE_SECRET'),
    ready: !!url && !!key,
    verify: fetch,
    save: (args) =>
      createClient(url!, key!, { auth: { persistSession: false } }).rpc(
        'submit_coin_review',
        args,
      ),
  }),
)
