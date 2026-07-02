import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Category = '食料品' | '備品'

export type Store = {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
  created_at: string
}

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
  sort_order: number | null
  store_id: string
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
  store_id: string
  checked_at: string
}

export type DonutType = {
  id: string
  name: string
  sort_order: number | null
  store_id: string
  created_at: string
}

export type WasteLog = {
  id: string
  donut_type_id: string
  donut_type_name: string
  quantity: number
  recorded_by: string
  store_id: string
  wasted_at: string
}

export type ExpenseGroup = '売上原価' | '販管費'

export type ExpenseCategory = {
  id: string
  name: string
  group_name: ExpenseGroup
  sort_order: number
}

export type ExpenseSource = 'manual' | 'line_ocr'

export type Expense = {
  id: string
  store_id: string
  category_id: string
  vendor: string
  amount: number
  expense_date: string
  note: string
  receipt_image_url: string | null
  source: ExpenseSource
  ocr_raw_json: unknown
  created_by: string
  created_at: string
}

export type SalesDaily = {
  id: string
  store_id: string
  sales_date: string
  gross_sales: number
  net_sales: number
  source: 'manual' | 'airregi'
  raw_json: unknown
  synced_at: string
}

export type RegisterClosing = {
  id: string
  store_id: string
  closing_date: string
  opening_change: number | null
  adjustment: number | null
  over_short: number | null
  deposit: number | null
  carried_over: number | null
  receipt_photo_url: string | null
  staff_name: string
  source_row_id: string | null
  synced_at: string
}

export type InventorySnapshot = {
  id: string
  store_id: string
  item_id: string
  snapshot_date: string
  stock: number
  unit_price: number
  amount: number
  created_at: string
}

export type StoreManager = {
  user_id: string
  store_id: string | null
  display_name: string
  created_at: string
}

let _instance: SupabaseClient | null = null

// Cookieベースのブラウザクライアント。店長が/loginでログインしていれば
// このクライアント経由の操作もauthenticatedロールになり、削除など店長限定の操作が通る。
// 未ログインのスタッフは従来通りanonロールとして動く。
export function getSupabaseClient(): SupabaseClient {
  if (!_instance) {
    _instance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _instance
}
