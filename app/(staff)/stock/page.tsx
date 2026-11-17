'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient, type Category, type Item } from '@/lib/supabase'
import { useStaff } from '../staff-layout'
import { buttonClass, QuantityInput, readQuantity } from '../ui'

type PendingLog = {
  id: string
  item_id: string
  store_id: string
  checked_by: string
  stock_before: number
  stock_after: number
}
type Change = { value: string; pendingLog?: PendingLog; error?: string }

const categories: Category[] = ['備品', '食料品']
const leaveMessage = '保存が完了していない変更があります。移動しますか？'

function StockList({ initialItems }: { initialItems: Item[] }) {
  const { storeId, staffName, setStoreGuard } = useStaff()
  const [items, setItems] = useState(initialItems)
  const [category, setCategory] = useState<Category>(initialItems.some((item) => item.category === '食料品') ? '食料品' : '備品')
  const [changes, setChanges] = useState<Record<string, Change>>({})
  const [openOrders, setOpenOrders] = useState<Set<string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const count = Object.keys(changes).length

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      const { data } = await getSupabaseClient().rpc('open_order_item_ids', { p_store_id: storeId }).abortSignal(controller.signal)
      if (!controller.signal.aborted && Array.isArray(data)) setOpenOrders(new Set(data))
    }
    void load()
    return () => controller.abort()
  }, [storeId])

  useEffect(() => {
    if (!count) return
    setStoreGuard(() => !saving && window.confirm(leaveMessage))
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      setStoreGuard(null)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [count, saving, setStoreGuard])

  function change(item: Item, value: string) {
    setChanges((previous) => {
      const next = { ...previous }
      if (readQuantity(value) === item.stock) delete next[item.id]
      else next[item.id] = { value }
      return next
    })
  }

  async function save() {
    if (saving || !count) return
    if (!staffName) {
      setMessage('画面上部で担当者名を保存してください。')
      return
    }

    setSaving(true)
    setMessage('')
    const supabase = getSupabaseClient()
    const next = { ...changes }
    let saved = 0
    const stocks = new Map<string, number>()

    for (const item of items) {
      const draft = changes[item.id]
      if (!draft) continue
      let log = draft.pendingLog
      if (!log) {
        const quantity = readQuantity(draft.value)
        if (quantity === null) {
          next[item.id] = { ...draft, error: '0以上の整数を入力してください。' }
          continue
        }

        const updated = await supabase.from('items').update({ stock: quantity })
          .eq('id', item.id).eq('store_id', storeId).eq('stock', item.stock).select('id').maybeSingle()
        if (updated.error || !updated.data) {
          next[item.id] = { ...draft, error: updated.error ? '在庫を更新できませんでした。' : '在庫が別の場所で変更されました。再読み込みして確認してください。' }
          continue
        }
        log = {
          id: crypto.randomUUID(), item_id: item.id, store_id: storeId, checked_by: staffName,
          stock_before: item.stock, stock_after: quantity,
        }
      }

      const { error } = await supabase.from('stock_logs').insert(log)
      if (error && error.code !== '23505') {
        next[item.id] = { ...draft, pendingLog: log, error: '在庫は更新済み・履歴は未記録。もう一度保存すると履歴を再試行します。' }
        continue
      }

      stocks.set(item.id, log.stock_after)
      delete next[item.id]
      saved++
    }

    setItems((previous) => previous.map((item) => stocks.has(item.id) ? { ...item, stock: stocks.get(item.id)! } : item))
    setChanges(next)
    setMessage(`${saved}件を保存しました${Object.keys(next).length ? `。未完了 ${Object.keys(next).length}件` : ''}。`)
    setSaving(false)
  }

  return (
    <>
      <div className="grid grid-cols-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        {categories.map((name) => (
          <button key={name} type="button" aria-pressed={name === category} onClick={() => setCategory(name)}
            className={`min-h-11 rounded-lg text-sm font-bold ${name === category ? 'bg-neutral-900 text-white' : 'text-neutral-700'}`}>
            {name} ({items.filter((item) => item.category === name).length})
          </button>
        ))}
      </div>
      <ul className="divide-y divide-neutral-200">
        {items.filter((item) => item.category === category).map((item) => {
          const draft = changes[item.id]
          return (
            <li key={item.id} className={`space-y-2 px-2 py-3 ${draft ? 'bg-blue-50' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-[1_1_8rem]">
                  <p className="break-words font-bold">{item.name}</p>
                  <p className="text-xs text-neutral-600">{item.unit} ／ 発注点 {item.min_stock > 0 ? item.min_stock : '未設定'}</p>
                </div>
                <QuantityInput label={`${item.name}の在庫数`} value={draft?.value ?? String(item.stock)}
                  disabled={saving || !!draft?.pendingLog} onChange={(value) => change(item, value)} />
              </div>
              <div className="flex flex-wrap gap-1">
                {item.min_stock > 0 && (draft?.pendingLog?.stock_after ?? item.stock) <= item.min_stock && (
                  <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-800">要発注</span>
                )}
                {openOrders?.has(item.id) && <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">発注済</span>}
              </div>
              {draft?.error && <p role="alert" className="text-sm text-orange-800">{draft.error}</p>}
            </li>
          )
        })}
      </ul>
      {!items.some((item) => item.category === category) && <p className="text-sm text-neutral-600">このカテゴリの商品はありません。</p>}
      {(count > 0 || message) && (
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 space-y-2 border-t border-neutral-200 bg-white py-3">
          {message && <p role="status" className="text-sm">{message}</p>}
          {count > 0 && <button className={buttonClass + ' w-full'} disabled={saving} onClick={() => void save()}>
            {saving ? '保存中…' : `変更した ${count} 件をまとめて保存`}
          </button>}
        </div>
      )}
    </>
  )
}

export default function StockPage() {
  const { items } = useStaff()
  return (
    <main className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-bold">在庫チェック</h1>
      {items && items.length > 0 && <StockList initialItems={items} />}
    </main>
  )
}
