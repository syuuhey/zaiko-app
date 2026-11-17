'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { getSupabaseClient, type Item } from '@/lib/supabase'
import { loadOpenOrders, orderCandidates, useOpenOrders, type OpenOrder } from '../order-data'
import { useStaff } from '../staff-layout'
import { buttonClass, panelClass, QuantityInput, readQuantity } from '../ui'

type Feedback = { text: string; error?: boolean }
type ClosedOrder = OpenOrder & { status: '入荷済' | '取消'; received_quantity: number | null }
const dateTime = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Tokyo' })
const secondaryButton = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 px-3 text-sm font-bold disabled:opacity-50'

function initialQuantity(item: Item) {
  return Math.max(item.ideal_stock - item.stock, 1)
}

export default function OrdersPage() {
  const { storeId, staffName, items, reloadItems } = useStaff()
  const { result, setResult } = useOpenOrders(storeId)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [excluded, setExcluded] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [receiptQuantity, setReceiptQuantity] = useState('')
  const [manualId, setManualId] = useState('')
  const [manualQuantity, setManualQuantity] = useState('1')
  const [history, setHistory] = useState<ClosedOrder[] | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [historyRevision, setHistoryRevision] = useState(0)

  useEffect(() => {
    if (!storeId) return
    const controller = new AbortController()
    async function load() {
      const { data, error } = await getSupabaseClient().from('purchase_orders')
        .select('id, item_id, supplier, quantity, ordered_by, ordered_at, status, received_quantity')
        .eq('store_id', storeId).neq('status', '発注済').order('ordered_at', { ascending: false })
        .abortSignal(controller.signal).returns<ClosedOrder[]>()
      if (!controller.signal.aborted) {
        setHistory(data)
        setHistoryError(!!error)
      }
    }
    void load()
    return () => controller.abort()
  }, [storeId, historyRevision])

  const openOrders = result?.orders ?? []
  const openIds = new Set(openOrders.map((order) => order.item_id))
  const orderable = items?.filter((item) => !openIds.has(item.id)) ?? []
  const itemById = new Map(items?.map((item) => [item.id, item]))
  const groups = orderCandidates(items ?? [], openIds)

  function checkStaffName() {
    if (staffName) return true
    setFeedback({ text: '画面上部で担当者名を保存してください。', error: true })
    return false
  }

  async function refreshOrders() {
    const { data, error } = await loadOpenOrders(storeId)
    setResult({ orders: data ?? [], error: !!error })
  }

  async function record(entries: { item: Item; quantity: string }[]) {
    if (busy || !entries.length || !checkStaffName()) return false
    const rows = []
    for (const { item, quantity } of entries) {
      const parsed = readQuantity(quantity)
      if (!parsed) {
        setFeedback({ text: `${item.name}の発注数に1以上の整数を入力してください。`, error: true })
        return false
      }
      rows.push({ item_id: item.id, store_id: storeId, supplier: item.supplier ?? '', quantity: parsed, ordered_by: staffName })
    }

    setBusy(true)
    const { error } = await getSupabaseClient().from('purchase_orders').insert(rows)
    setFeedback(error ? {
      text: error.code === '23505' ? 'すでに未入荷の発注がある商品が含まれています。入荷待ちを確認してください。' : '発注を記録できませんでした。',
      error: true,
    } : { text: `${rows.length}件の発注を記録しました。` })
    await refreshOrders()
    setBusy(false)
    return !error
  }

  function placeGroup(group: Item[]) {
    return record(group.filter((item) => !excluded[item.id])
      .map((item) => ({ item, quantity: quantities[item.id] ?? String(initialQuantity(item)) })))
  }

  async function placeManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const item = orderable.find((entry) => entry.id === manualId)
    if (item && await record([{ item, quantity: manualQuantity }])) {
      setManualId('')
      setManualQuantity('1')
    }
  }

  async function receive(order: OpenOrder) {
    if (busy || !checkStaffName()) return
    const quantity = readQuantity(receiptQuantity)
    if (quantity === null) {
      setFeedback({ text: '入荷数には0以上の整数を入力してください。', error: true })
      return
    }

    setBusy(true)
    const { error } = await getSupabaseClient().rpc('receive_purchase_order', {
      p_order_id: order.id, p_received_quantity: quantity, p_checked_by: staffName,
    })
    setFeedback(error
      ? { text: '入荷を記録できませんでした。発注の状態と入荷数を確認してください。', error: true }
      : { text: '入荷を記録しました。' })
    if (!error) {
      setReceiptId(null)
      reloadItems()
      setHistoryRevision((revision) => revision + 1)
    }
    await refreshOrders()
    setBusy(false)
  }

  async function cancel(order: OpenOrder) {
    if (busy || !window.confirm('この発注を取り消しますか？')) return
    setBusy(true)
    const { data, error } = await getSupabaseClient().from('purchase_orders')
      .update({ status: '取消' }).eq('id', order.id).eq('store_id', storeId).eq('status', '発注済')
      .select('id').maybeSingle()
    setFeedback(error || !data
      ? { text: '発注を取り消せませんでした。発注の状態を確認してください。', error: true }
      : { text: '発注を取り消しました。' })
    if (!error && data) setHistoryRevision((revision) => revision + 1)
    await refreshOrders()
    setBusy(false)
  }

  return (
    <main className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-bold">発注</h1>
      {feedback && <p role={feedback.error ? 'alert' : 'status'}
        className={`rounded-lg px-3 py-2 text-sm ${feedback.error ? 'bg-orange-50 text-orange-900' : 'bg-green-50 text-green-900'}`}>
        {feedback.text}
      </p>}
      {result?.error && <p role="alert" className="text-sm text-orange-800">発注を読み込めませんでした。ページを再読み込みしてください。</p>}
      {items && result && !result.error && (
        <>
          <section aria-labelledby="candidates" className="space-y-3">
            <h2 id="candidates" className="text-lg font-bold">発注候補 <span className="text-sm font-medium text-neutral-600">{[...groups.values()].reduce((sum, group) => sum + group.length, 0)}件</span></h2>
            {!groups.size && <p className="text-sm text-neutral-600">発注候補はありません。</p>}
            {!groups.size && items.some((item) => item.min_stock <= 0) && (
              <Link href="/items/setup" className={secondaryButton}>発注点の一括設定を見る</Link>
            )}
            {Array.from(groups, ([supplier, group]) => {
              const count = group.filter((item) => !excluded[item.id]).length
              return (
                <div key={supplier} className={panelClass + ' space-y-2'}>
                  <h3 className="break-words font-bold">{supplier || '仕入先未設定'}</h3>
                  <ul className="divide-y divide-neutral-200">
                    {group.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <label className="flex min-h-11 min-w-0 flex-[1_1_8rem] items-center gap-2">
                          <input type="checkbox" checked={!excluded[item.id]} disabled={busy}
                            className="h-5 w-5 shrink-0 accent-neutral-900"
                            onChange={(event) => setExcluded({ ...excluded, [item.id]: !event.target.checked })} />
                          <span className="min-w-0 break-words text-sm font-medium">{item.name}
                            <span className="block text-xs font-normal text-neutral-600">在庫 {item.stock} {item.unit}</span>
                          </span>
                        </label>
                        <QuantityInput label={`${item.name}の発注数`} value={quantities[item.id] ?? String(initialQuantity(item))}
                          disabled={busy} onChange={(value) => setQuantities({ ...quantities, [item.id]: value })} />
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={buttonClass + ' w-full'} disabled={busy || !count} onClick={() => void placeGroup(group)}>
                    {count} 件を発注済にする
                  </button>
                </div>
              )
            })}
          </section>

          <section aria-labelledby="waiting" className="space-y-3">
            <h2 id="waiting" className="text-lg font-bold">入荷待ち <span className="text-sm font-medium text-neutral-600">{openOrders.length}件</span></h2>
            {!openOrders.length && <p className="text-sm text-neutral-600">入荷待ちはありません。</p>}
            {openOrders.map((order) => {
              const item = itemById.get(order.item_id)
              const name = item?.name ?? '商品名不明'
              return (
                <article key={order.id} className={panelClass + ' space-y-2'}>
                  <p className="break-words font-bold">{name} <span className="text-xs text-blue-800">発注済</span></p>
                  <p className="break-words text-sm text-neutral-600">
                    {order.supplier.trim() || '仕入先未設定'} ／ 発注 {order.quantity} {item?.unit}
                    <br />{dateTime.format(new Date(order.ordered_at))} ／ {order.ordered_by}
                  </p>
                  {receiptId === order.id ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1"><p className="text-sm font-medium">入荷数</p>
                        <QuantityInput label={`${name}の入荷数`} value={receiptQuantity} onChange={setReceiptQuantity} disabled={busy} />
                      </div>
                      <button type="button" className={buttonClass} disabled={busy} onClick={() => void receive(order)}>入荷を確定</button>
                      <button type="button" className={secondaryButton} disabled={busy} onClick={() => setReceiptId(null)}>閉じる</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" className={buttonClass} disabled={busy} onClick={() => {
                        setReceiptQuantity(String(order.quantity))
                        setReceiptId(order.id)
                      }}>入荷</button>
                      <button type="button" className={secondaryButton} disabled={busy} onClick={() => void cancel(order)}>取消</button>
                    </div>
                  )}
                </article>
              )
            })}
          </section>

          {orderable.length > 0 && (
            <section className={panelClass + ' space-y-2'}>
              <h2 className="font-bold">手動で追加</h2>
              <form className="space-y-2" onSubmit={(event) => void placeManual(event)}>
                <label className="block text-sm font-medium">商品
                  <select required value={manualId} onChange={(event) => setManualId(event.target.value)}
                    disabled={busy} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-2">
                    <option value="" disabled>商品を選択</option>
                    {orderable.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1"><p className="text-sm font-medium">発注数</p>
                    <QuantityInput label="手動追加の発注数" value={manualQuantity} onChange={setManualQuantity} disabled={busy} />
                  </div>
                  <button className={buttonClass} disabled={busy}>発注済にする</button>
                </div>
              </form>
            </section>
          )}
        </>
      )}
      {items && (
        <details className={panelClass}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-bold">
            発注履歴 <span aria-hidden className="text-neutral-500">⌄</span>
          </summary>
          {historyError && <p role="alert" className="text-sm text-orange-800">発注履歴を読み込めませんでした。</p>}
          {!historyError && history === null && <p className="text-sm text-neutral-600">読み込み中…</p>}
          {history?.length === 0 && <p className="text-sm text-neutral-600">入荷済・取消の発注はありません。</p>}
          <ul className="divide-y divide-neutral-200">
            {history?.map((order) => {
              const item = itemById.get(order.item_id)
              return (
                <li key={order.id} className="break-words py-3">
                  <p className="font-bold">{item?.name ?? '商品名不明'} <span className={`text-xs ${order.status === '入荷済' ? 'text-green-800' : 'text-neutral-600'}`}>{order.status}</span></p>
                  <p className="text-sm text-neutral-600">
                    {order.supplier.trim() || '仕入先未設定'} ／ 発注 {order.quantity} {item?.unit}
                    {order.received_quantity !== null && ` ／ 入荷 ${order.received_quantity} ${item?.unit ?? ''}`}
                    <br />{dateTime.format(new Date(order.ordered_at))} ／ {order.ordered_by}
                  </p>
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </main>
  )
}
