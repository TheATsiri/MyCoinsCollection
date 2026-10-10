import { isDemo, supabase } from './supabase'
import { admin } from '../admin/client'
import type {
  AdminReview,
  ReviewPage,
  ReviewSort,
  ReviewStatus,
  ReviewSubmission,
} from '../types/review'
export async function getReviews(
  coinId: string,
  sort: ReviewSort,
  page: number,
): Promise<ReviewPage> {
  if (isDemo)
    return {
      items: [],
      total: 0,
      written_count: 0,
      average: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
  if (!supabase) throw new Error('Reviews are temporarily unavailable')
  const { data, error } = await supabase.rpc('get_coin_reviews', {
    p_coin_id: coinId,
    p_sort: sort,
    p_page: page,
  })
  if (error) throw error
  return data as unknown as ReviewPage
}
export async function submitReview(body: ReviewSubmission) {
  if (!supabase || isDemo)
    throw new Error('Reviews are unavailable in the demonstration.')
  const { data, error } = await supabase.functions.invoke('submit-review', {
    body,
  })
  if (error) {
    const context = 'context' in error ? error.context : null
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null)
      if (typeof payload?.error === 'string') throw new Error(payload.error)
    }
    throw new Error('Review could not be saved. Please try again.')
  }
  if (data?.status !== 'pending')
    throw new Error('Review could not be saved. Please try again.')
}
export async function listReviews(
  filters: { coin: string; rating: string; status: string; search: string },
  page: number,
) {
  // Search is a server-side parameterized RPC to avoid raw PostgREST filter expressions.
  const { data, error } = await admin().rpc('search_admin_reviews', {
    p_coin_id: filters.coin || null,
    p_rating: filters.rating ? Number(filters.rating) : null,
    p_status: filters.status,
    p_query: filters.search.trim(),
    p_page: page,
  })
  if (error) throw error
  return data as unknown as { items: AdminReview[]; total: number }
}
export async function moderateReview(
  id: string,
  status: ReviewStatus | 'delete',
) {
  const query =
    status === 'delete'
      ? admin().from('coin_reviews').delete()
      : admin().from('coin_reviews').update({ status })
  const { data, error } = await query.eq('id', id).select('id')
  if (error) throw error
  if (!data?.length)
    throw new Error('Review no longer exists or access was denied.')
}
