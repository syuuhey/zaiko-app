import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type Category = '食料品' | '備品'

export type Item = {
  id: string
  name: string
  category: Category
  unit: string
  stock: number
  min_stock: number
  ideal_stock: number
  unit_price: number
  supplier: string
  note: string
  created_at: string
  updated_at: string
}

export type StockLog = {
  id: string
  item_id: string
  checked_by: string
  stock_before: number
  stock_after: number
  note: string
  checked_at: string
}

let _instance: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _instance
}
