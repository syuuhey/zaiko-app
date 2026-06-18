'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient, type Item, type WasteLog } from '@/lib/supabase'
import Link from 'next/link'

type WasteSummary = {
  item_id: string
  item_name: string
  total: number
}

function toDateStr(date: Date) {
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
}

export default function WastePage() {
  const [items, setItems] = useState<Item[]>([])
  const [logs, setLogs] = useState<WasteLog[]>([])
  const [selectedItemId, setSelectedItemId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [recordedBy, setRecordedBy] = useState('スタッフ')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [selectedDate])

  async function fetchItems() {
    const sb = getSupabaseClient()
    const { data } = await sb
      .from('items')
      .select('*')
      .order('sort_order', { nullsFirst: false })
      .order('name')
    if (data) {
      setItems(data)
      if (data.length > 0) setSelectedItemId(data[0].id)
    }
  }

  async function fetchLogs() {
    const sb = getSupabaseClient()
    const start = `${selectedDate}T00:00:00`
    const end = `${selectedDate}T23:59:59`
    const { data } = await sb
      .from('waste_logs')
      .select('*')
      .gte('wasted_at', start)
      .lte('wasted_at', end)
      .order('wasted_at', { ascending: false })
    if (data) setLogs(data)
  }

  async function recordWaste() {
    if (!selectedItemId || quantity <= 0) return
    setSaving(true)
    const item = items.find((i) => i.id === selectedItemId)
    if (!item) return
    const sb = getSupabaseClient()
    const { error } = await sb.from('waste_logs').insert({
      item_id: selectedItemId,
      item_name: item.name,
      quantity,
      recorded_by: recordedBy,
    })
    if (!error) {
      showToast(`${item.name} を ${quantity}${item.unit} 記録しました`)
      setQuantity(1)
      await fetchLogs()
    }
    setSaving(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const summary: WasteSummary[] = logs.reduce<WasteSummary[]>((acc, log) => {
    const existing = acc.find((s) => s.item_id === log.item_id)
    if (existing) {
      existing.total += log.quantity
    } else {
      acc.push({ item_id: log.item_id, item_name: log.item_name, total: log.quantity })
    }
    return acc
  }, [])

  const selectedItem = items.find((i) => i.id === selectedItemId)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-700 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white opacity-80 text-sm">← 戻る</Link>
            <h1 className="text-xl font-bold">廃棄記録</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* 担当者 */}
        <div className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
          <span className="text-sm text-gray-500 shrink-0">担当者</span>
          <input
            type="text"
            value={recordedBy}
            onChange={(e) => setRecordedBy(e.target.value)}
            className="flex-1 text-base border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="名前を入力"
          />
        </div>

        {/* 記録フォーム */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          <h2 className="font-bold text-gray-700">廃棄を記録</h2>

          {/* 商品選択 */}
          <div className="space-y-1">
            <label className="text-sm text-gray-500">商品</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          {/* 数量 */}
          <div className="space-y-1">
            <label className="text-sm text-gray-500">廃棄数</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-11 h-11 bg-gray-100 rounded-lg text-xl font-bold text-gray-700 flex items-center justify-center"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 text-center text-xl font-bold border border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-11 h-11 bg-gray-100 rounded-lg text-xl font-bold text-gray-700 flex items-center justify-center"
              >
                ＋
              </button>
              {selectedItem && (
                <span className="text-sm text-gray-400">{selectedItem.unit}</span>
              )}
            </div>
          </div>

          <button
            onClick={recordWaste}
            disabled={saving || !selectedItemId}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-medium text-base disabled:opacity-50"
          >
            {saving ? '記録中...' : '記録する'}
          </button>
        </div>

        {/* 集計 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-700">廃棄集計</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>

          {summary.length === 0 ? (
            <p className="text-center text-gray-400 py-4 text-sm">この日の廃棄記録はありません</p>
          ) : (
            <div className="space-y-2">
              {summary.map((s) => {
                const item = items.find((i) => i.id === s.item_id)
                return (
                  <div key={s.item_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-base text-gray-800">{s.item_name}</span>
                    <span className="font-bold text-lg text-teal-700 font-mono">
                      {s.total}
                      <span className="text-sm font-normal text-gray-400 ml-1">{item?.unit ?? ''}</span>
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
                <span>合計廃棄数</span>
                <span className="font-bold">{summary.reduce((n, s) => n + s.total, 0)}</span>
              </div>
            </div>
          )}
        </div>

        {/* 当日の記録一覧 */}
        {logs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <h2 className="font-bold text-gray-700 text-sm">記録一覧</h2>
            {logs.map((log) => {
              const item = items.find((i) => i.id === log.item_id)
              const time = new Date(log.wasted_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="text-gray-800">{log.item_name}</span>
                    <span className="text-gray-400 ml-2">{log.recorded_by} · {time}</span>
                  </div>
                  <span className="font-mono text-gray-700">
                    {log.quantity}{item?.unit ?? ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-xl text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
