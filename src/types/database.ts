import type { Json, Coin, CoinImage, CoinReference } from './coin'
import type { AdminReview } from './review'
// Schema contract for migrations 001–003. After connecting a project, regenerate with the Supabase CLI (README).
type Table<T> = {
  Row: T
  Insert: Partial<T>
  Update: Partial<T>
  Relationships: []
}
export type Database = {
  public: {
    Tables: {
      coin_reviews: Table<Omit<AdminReview, 'coins'>>
      coins: Table<Omit<Coin, 'coin_images' | 'coin_references'>>
      coin_images: Table<CoinImage>
      coin_references: Table<CoinReference>
      photo_cleanup: Table<{
        path: string
        retry_after: string
        last_error: string | null
        created_at: string
      }>
    }
    Views: Record<string, never>
    Functions: {
      search_admin_reviews: {
        Args: {
          p_coin_id: string | null
          p_rating: number | null
          p_status: string
          p_query: string
          p_page: number
        }
        Returns: Json
      }
      get_coin_reviews: {
        Args: { p_coin_id: string; p_sort?: string; p_page?: number }
        Returns: Json
      }
      is_collection_owner: { Args: Record<string, never>; Returns: boolean }
      save_coin: {
        Args: {
          p_submission_id: string
          p_coin: Json
          p_images: Json
          p_references: Json
        }
        Returns: string
      }
      search_coins: {
        Args: {
          p_query?: string
          p_country?: string
          p_year_from?: number | null
          p_year_to?: number | null
          p_period?: string
          p_denomination?: string
          p_metal?: string
          p_grade?: string
          p_sort?: string
          p_page?: number
        }
        Returns: Json
      }
      get_filter_options: { Args: Record<string, never>; Returns: Json }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
