'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient, type Item } from '@/lib/supabase'

export type OpenOrder = {
  id: string
  item_id: string
  supplier: string
  quantity: number
  ordered_by: string
  ordered_at: string
}

export async function loadOpenOrders(storeId: string, signal?: AbortSignal) {
  const query = getSupabaseClient().from('purchase_orders')
    .select('id, item_id, supplier, quantity, ordered_by, ordered_at')
    .eq('store_id', storeId).eq('status', '発注済')
    .order('ordered_at', { ascending: false }).returns<OpenOrder[]>()
  return signal ? query.abortSignal(signal) : query
}

export function useOpenOrders(storeId: string) {
  const [result, setResult] = useState<{ orders: OpenOrder[]; error: boolean } | null>(null)

  useEffect(() => {
    if (!storeId) return
    const controller = new AbortController()
    async function load() {
      const { data, error } = await loadOpenOrders(storeId, controller.signal)
      if (!controller.signal.aborted) setResult({ orders: data ?? [], error: !!error })
    }
    void load()
    return () => controller.abort()
  }, [storeId])

  return { result, setResult }
}

export function orderCandidates(items: Item[], openIds: Set<string>) {
  const groups = new Map<string, Item[]>()
  for (const item of items) {
    if (item.min_stock <= 0 || item.stock > item.min_stock || openIds.has(item.id)) continue
    const supplier = item.supplier?.trim() ? item.supplier : ''
    const group = groups.get(supplier) ?? []
    group.push(item)
    groups.set(supplier, group)
  }
  return groups
}
