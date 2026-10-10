export type ReviewStatus = 'pending' | 'approved' | 'rejected'
export type ReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest'
export type PublicReview = {
  id: string
  display_name: string
  rating: number
  review_text: string | null
  created_at: string
}
export type AdminReview = PublicReview & {
  coin_id: string
  status: ReviewStatus
  updated_at: string
  coins?: { name: string }
}
export type ReviewPage = {
  items: PublicReview[]
  total: number
  written_count: number
  average: number | null
  distribution: Record<string, number>
}
export type ReviewSubmission = {
  submission_id: string
  coin_id: string
  display_name: string
  rating: number
  review_text: string
  website: string
  token: string
}
