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
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [adding, setAdding] = useState(false)
  const [exportMonth, setExportMonth] = useState(getLocalDateStr().slice(0, 7))
  const [exporting, setExporting] = useState(false)

  const isToday = date === getLocalDateStr()

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
    setLoading(true)
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
    setCounts(c)
    setLoading(false)
  }, [date])

  useEffect(() => { fetchTypes() }, [fetchTypes])
  useEffect(() => { fetchCounts() }, [fetchCounts])

  function setCount(id: string, value: number) {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, value) }))
  }

  async function save() {
    setSaving(true)
    const sb = getSupabaseClient()

    await sb
      .from('waste_logs')
      .delete()
      .gte('wasted_at', `${date}T00:00:00`)
      .lte('wasted_at', `${date}T23:59:59`)

    const records = types
      .filter((t) => (counts[t.id] || 0) > 0)
      .map((t) => ({
        donut_type_id: t.id,
        donut_type_name: t.name,
        quantity: counts[t.id],
        recorded_by: recordedBy,
      }))

    if (records.length > 0) {
      await sb.from('waste_logs').insert(records)
    }

    showToast('廃棄を記録しました')
    setSaving(false)
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

  async function downloadCSV() {
    setExporting(true)
    const sb = getSupabaseClient()
    const [year, month] = exportMonth.split('-')
    const lastDay = new Date(Number(year), Number(month), 0).getDate()

    const [{ data: typeData }, { data: logData }] = await Promise.all([
      sb.from('donut_types').select('*').order('sort_order', { nullsFirst: false }).order('created_at'),
      sb.from('waste_logs')
        .select('*')
        .gte('wasted_at', `${exportMonth}-01T00:00:00`)
        .lte('wasted_at', `${exportMonth}-${String(lastDay).padStart(2, '0')}T23:59:59`)
        .order('wasted_at'),
    ])

    if (!logData || logData.length === 0) {
      showToast('この月のデータがありません')
      setExporting(false)
      return
    }

    // 日付ごとに集計
    const byDate: Record<string, { recorded_by: string; qty: Record<string, number> }> = {}
    logData.forEach((log) => {
      const d = log.wasted_at.slice(0, 10)
      if (!byDate[d]) byDate[d] = { recorded_by: log.recorded_by, qty: {} }
      byDate[d].recorded_by = log.recorded_by
      byDate[d].qty[log.donut_type_id] = (byDate[d].qty[log.donut_type_id] || 0) + log.quantity
    })

    const colTypes = typeData ?? []
    const header = ['日付', '担当者', ...colTypes.map((t) => t.name), '合計'].join(',')
    const rows = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, { recorded_by, qty }]) => {
        const qtys = colTypes.map((t) => qty[t.id] || 0)
        const total = qtys.reduce((n, q) => n + q, 0)
        return [d, recorded_by, ...qtys, total].join(',')
      })

    const csv = '﻿' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `廃棄記録_${exportMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const total = Object.values(counts).reduce((n, c) => n + c, 0)

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
        {isToday && (
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
        )}

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

        {/* 廃棄数入力リスト */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-gray-400 text-sm">読み込み中...</div>
          ) : types.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm space-y-2">
              <p>ドーナツの種類が未登録です</p>
              <button onClick={() => setShowManage(true)} className="text-teal-600 underline">
                種類を追加する
              </button>
            </div>
          ) : (
            <>
              {!isToday && (
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400 text-center">
                  過去の記録（編集不可）
                </div>
              )}
              {types.map((type) => {
                const count = counts[type.id] || 0
                return (
                  <div
                    key={type.id}
                    className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0"
                  >
                    <span className="flex-1 text-base text-gray-800">{type.name}</span>
                    {isToday ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCount(type.id, count - 1)}
                          disabled={count <= 0}
                          className="w-10 h-10 rounded-xl bg-gray-100 text-xl font-bold text-gray-500 flex items-center justify-center disabled:opacity-25"
                        >
                          −
                        </button>
                        <span className={`w-10 text-center text-2xl font-bold font-mono ${count > 0 ? 'text-teal-700' : 'text-gray-300'}`}>
                          {count}
                        </span>
                        <button
                          onClick={() => setCount(type.id, count + 1)}
                          className="w-10 h-10 rounded-xl bg-gray-100 text-xl font-bold text-gray-600 flex items-center justify-center"
                        >
                          ＋
                        </button>
                      </div>
                    ) : (
                      <span className={`text-2xl font-bold font-mono ${count > 0 ? 'text-teal-700' : 'text-gray-200'}`}>
                        {count}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* 合計 */}
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

        {/* 記録ボタン */}
        {isToday && types.length > 0 && (
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
          >
            {saving ? '記録中...' : '廃棄を記録する'}
          </button>
        )}

        {/* CSVダウンロード */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-700">CSVダウンロード</h2>
          <div className="flex gap-2 items-center">
            <input
              type="month"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button
              onClick={downloadCSV}
              disabled={exporting}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
            >
              {exporting ? '準備中...' : 'ダウンロード'}
            </button>
          </div>
          <p className="text-xs text-gray-400">Excel・Googleスプレッドシートで開けます</p>
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
            <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-1">
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

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-xl text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
