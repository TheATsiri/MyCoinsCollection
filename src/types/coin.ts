export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
export type CoinImage = {
  id: string
  coin_id: string
  side: 'obverse' | 'reverse' | 'edge' | 'other'
  image_path: string
  thumbnail_path: string | null
  alt_text: string
  credit: string | null
  display_order: number
}
export type CoinReference = {
  id: string
  coin_id: string
  catalogue: string
  reference_number: string
  edition: string | null
  source_url: string | null
}
export type Coin = {
  id: string
  slug: string
  name: string
  issuing_authority: string
  year: number | null
  denomination: string | null
  denomination_value: number | null
  denomination_unit: string | null
  metal: string | null
  weight_g: number | null
  diameter_mm: number | null
  mint: string | null
  mint_mark: string | null
  ruler: string | null
  historical_period: string | null
  obverse_description: string | null
  reverse_description: string | null
  historical_notes: string | null
  grade: string | null
  grading_system: string | null
  measurement_source: string | null
  is_published: boolean
  catalogued_at: string
  created_at: string
  updated_at: string
  extra_attributes: Record<string, Json>
  coin_images: CoinImage[]
  coin_references: CoinReference[]
}
export type CoinFilters = {
  q: string
  country: string
  yearFrom: string
  yearTo: string
  period: string
  denomination: string
  metal: string
  grade: string
}
export type Sort =
  'year_desc' | 'year_asc' | 'country' | 'denomination' | 'added'
export type CoinPage = { items: Coin[]; total: number }
export type FilterOptions = {
  countries: string[]
  periods: string[]
  denominations: string[]
  metals: string[]
  grades: string[]
}
export const PAGE_SIZE = 24
export const EMPTY_FILTERS: CoinFilters = {
  q: '',
  country: '',
  yearFrom: '',
  yearTo: '',
  period: '',
  denomination: '',
  metal: '',
  grade: '',
}
