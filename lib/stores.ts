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

  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchStores() {
      const { data, error } = await getSupabaseClient()
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .abortSignal(controller.signal)

      if (controller.signal.aborted) return
      if (data) {
        setStores(data)
        const saved = localStorage.getItem(STORAGE_KEY)
        setStoreId(data.find((store) => store.id === saved)?.id ?? data[0]?.id ?? '')
      }
      setError(!!error)
      setLoading(false)
    }
    void fetchStores()
    return () => controller.abort()
  }, [])

  function selectStore(id: string) {
    setStoreId(id)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, id)
  }

  return { stores, storeId, selectStore, loading, error }
}
