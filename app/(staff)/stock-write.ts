'use client'

import { getSupabaseClient, type Item } from '@/lib/supabase'

export type StockLogInput = {
  id: string
  item_id: string
  store_id: string
  checked_by: string
  stock_before: number
  stock_after: number
}

export async function updateStock(
  item: Pick<Item, 'id' | 'store_id' | 'stock'>,
  stock: number,
  staffName: string,
  details?: Partial<Omit<Item, 'stock'>>,
): Promise<{ log: StockLogInput; error?: never } | { error: string; log?: never }> {
  const log = {
    id: crypto.randomUUID(),
    item_id: item.id,
    store_id: item.store_id,
    checked_by: staffName,
    stock_before: item.stock,
    stock_after: stock,
  }
  const { data, error } = await getSupabaseClient().from('items').update({ ...details, stock })
    .eq('id', item.id).eq('store_id', item.store_id).eq('stock', item.stock).select('id').maybeSingle()
  if (error) return { error: '在庫を更新できませんでした。' }
  if (!data) return { error: '在庫が別の場所で変更されました。再読み込みして確認してください。' }
  return { log }
}

export async function writeStockLog(log: StockLogInput) {
  const { error } = await getSupabaseClient().from('stock_logs').insert(log)
  return !error || error.code === '23505'
}
