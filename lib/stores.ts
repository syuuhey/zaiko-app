'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient, type Store } from '@/lib/supabase'

const STORAGE_KEY = 'zaiko-app:selected-store-id'

// スタッフ向け画面（在庫・廃棄・履歴）共通の店舗切り替えロジック。
// 選択中の店舗IDはlocalStorageに保持し、タブ間・再訪問時も維持する。
export function useStoreSelection() {
  const [stores, setStores] = useState<Store[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStores()
  }, [])

  async function fetchStores() {
    setLoading(true)
    const sb = getSupabaseClient()
    const { data } = await sb
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (data) {
      setStores(data)
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const initial = data.find((s) => s.id === saved)?.id ?? data[0]?.id ?? ''
      setStoreId(initial)
    }
    setLoading(false)
  }

  function selectStore(id: string) {
    setStoreId(id)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, id)
  }

  return { stores, storeId, selectStore, loading }
}
