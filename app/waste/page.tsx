'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseClient, type DonutType } from '@/lib/supabase'
import Link from 'next/link'

function getLocalDateStr(date: Date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return getLocalDateStr(d)
}

function formatDateLabel(dateStr: string) {
  const today = getLocalDateStr()
  if (dateStr === today) return '今日'
  if (dateStr === addDays(today, -1)) return '昨日'
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function WastePage() {
  const [types, setTypes] = useState<DonutType[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [date, setDate] = useState(getLocalDateStr())
  const [recordedBy, setRecordedBy] = useState('スタッフ')
  const [showManage, setShowManage] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchTypes = useCallback(async () => {
    const sb = getSupabaseClient()
    const { data } = await sb
      .from('donut_types')
      .select('*')
      .order('sort_order', { nullsFirst: false })
      .order('created_at')
    if (data) setTypes(data)
  }, [])

  const fetchCounts = useCallback(async () => {
    const sb = getSupabaseClient()
    const { data } = await sb
      .from('waste_logs')
      .select('donut_type_id, quantity')
      .gte('wasted_at', `${date}T00:00:00`)
      .lte('wasted_at', `${date}T23:59:59`)
    const c: Record<string, number> = {}
    data?.forEach((log) => {
      c[log.donut_type_id] = (c[log.donut_type_id] || 0) + log.quantity
    })
    Object.keys(c).forEach((k) => { if (c[k] < 0) c[k] = 0 })
    setCounts(c)
  }, [date])

  useEffect(() => { fetchTypes() }, [fetchTypes])
  useEffect(() => { fetchCounts() }, [fetchCounts])

  const isToday = date === getLocalDateStr()

  async function increment(type: DonutType) {
    setCounts((prev) => ({ ...prev, [type.id]: (prev[type.id] || 0) + 1 }))
    const sb = getSupabaseClient()
    await sb.from('waste_logs').insert({
      donut_type_id: type.id,
      donut_type_name: type.name,
      quantity: 1,
      recorded_by: recordedBy,
    })
  }

  async function decrement(type: DonutType) {
    if ((counts[type.id] || 0) <= 0) return
    setCounts((prev) => ({ ...prev, [type.id]: (prev[type.id] || 0) - 1 }))
    const sb = getSupabaseClient()
    await sb.from('waste_logs').insert({
      donut_type_id: type.id,
      donut_type_name: type.name,
      quantity: -1,
      recorded_by: recordedBy,
    })
  }

  async function addType() {
    if (!newTypeName.trim()) return
    setAdding(true)
    const sb = getSupabaseClient()
    const maxOrder = types.reduce((max, t) => Math.max(max, t.sort_order ?? 0), 0)
    await sb.from('donut_types').insert({ name: newTypeName.trim(), sort_order: maxOrder + 1 })
    setNewTypeName('')
    await fetchTypes()
    setAdding(false)
  }

  async function deleteType(id: string) {
    if (!confirm('この種類を削除しますか？')) return
    const sb = getSupabaseClient()
    await sb.from('donut_types').delete().eq('id', id)
    setTypes((prev) => prev.filter((t) => t.id !== id))
  }

  const total = Object.values(counts).reduce((n, c) => n + c, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-700 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white opacity-80 text-sm">← 戻る</Link>
            <h1 className="text-xl font-bold">廃棄カウント</h1>
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

        {/* 日付ナビ */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-2 py-2">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="px-4 py-2 text-2xl text-gray-400"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-800">{formatDateLabel(date)}</p>
            <p className="text-xs text-gray-400">{date}</p>
          </div>
          <button
            onClick={() => setDate(addDays(date, 1))}
            disabled={isToday}
            className="px-4 py-2 text-2xl text-gray-400 disabled:opacity-20"
          >
            ›
          </button>
        </div>

        {/* カウンター */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {types.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm space-y-2">
              <p>ドーナツの種類が未登録です</p>
              <button
                onClick={() => setShowManage(true)}
                className="text-teal-600 underline"
              >
                種類を追加する
              </button>
            </div>
          ) : (
            <>
              {types.map((type) => {
                const count = counts[type.id] || 0
                return (
                  <div
                    key={type.id}
                    className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0"
                  >
                    <span className="flex-1 font-medium text-gray-800">{type.name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => decrement(type)}
                        disabled={count <= 0 || !isToday}
                        className="w-11 h-11 rounded-xl bg-gray-100 text-xl font-bold text-gray-500 flex items-center justify-center disabled:opacity-25"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-2xl font-bold text-gray-800 font-mono">
                        {count}
                      </span>
                      <button
                        onClick={() => increment(type)}
                        disabled={!isToday}
                        className="w-11 h-11 rounded-xl bg-teal-500 text-white text-xl font-bold flex items-center justify-center disabled:opacity-25 active:bg-teal-600"
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                )
              })}
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <span className="text-sm text-gray-500">合計廃棄数</span>
                <span className="text-xl font-bold text-teal-700 font-mono">
                  {total}
                  <span className="text-sm font-normal text-gray-400 ml-1">個</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* 種類を管理 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowManage(!showManage)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-500"
          >
            <span>ドーナツの種類を管理</span>
            <span className="text-xs">{showManage ? '▲' : '▼'}</span>
          </button>

          {showManage && (
            <div className="px-4 pb-4 border-t border-gray-100 space-y-1 pt-3">
              {types.map((type) => (
                <div key={type.id} className="flex items-center justify-between py-1.5">
                  <span className="text-gray-800">{type.name}</span>
                  <button
                    onClick={() => deleteType(type.id)}
                    className="text-sm text-red-400 px-2 py-1"
                  >
                    削除
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-3">
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addType()}
                  placeholder="新しい種類名"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <button
                  onClick={addType}
                  disabled={adding || !newTypeName.trim()}
                  className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  追加
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
