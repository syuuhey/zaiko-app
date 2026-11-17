'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient, type DonutType } from '@/lib/supabase'
import { addDays, getBusinessDateStr, getLocalDateStr } from '@/lib/business-date'
import { useStaff } from '../staff-layout'

function formatDateLabel(dateStr: string) {
  const today = getLocalDateStr()
  if (dateStr === today) return '今日'
  if (dateStr === addDays(today, -1)) return '昨日'
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function WastePage() {
  const { storeId, staffName } = useStaff()
  const [types, setTypes] = useState<DonutType[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [date, setDate] = useState(getBusinessDateStr())
  const [saving, setSaving] = useState(false)
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const loading = date !== loadedDate
  const [toast, setToast] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [adding, setAdding] = useState(false)
  const [exportMonth, setExportMonth] = useState(getLocalDateStr().slice(0, 7))
  const [exporting, setExporting] = useState(false)

  // 営業日（深夜0時〜4時59分は前日）から今日までの日付は編集可能
  const isEditable = date >= getBusinessDateStr() && date <= getLocalDateStr()
  const isLatestDay = date >= getLocalDateStr()

  const [typesRevision, setTypesRevision] = useState(0)

  useEffect(() => {
    if (!storeId) return
    const controller = new AbortController()
    async function load() {
      const { data } = await getSupabaseClient()
        .from('donut_types')
        .select('*')
        .eq('store_id', storeId)
        .order('sort_order', { nullsFirst: false })
        .order('created_at')
        .abortSignal(controller.signal)
      if (!controller.signal.aborted && data) setTypes(data)
    }
    void load()
    return () => controller.abort()
  }, [storeId, typesRevision])

  useEffect(() => {
    if (!storeId) return
    const controller = new AbortController()
    async function load() {
      const { data } = await getSupabaseClient()
        .from('waste_logs')
        .select('donut_type_id, quantity')
        .eq('store_id', storeId)
        .gte('wasted_at', `${date}T00:00:00`)
        .lte('wasted_at', `${date}T23:59:59`)
        .abortSignal(controller.signal)
      if (controller.signal.aborted) return
      const counts: Record<string, number> = {}
      data?.forEach((log) => {
        counts[log.donut_type_id] = (counts[log.donut_type_id] || 0) + log.quantity
      })
      setCounts(counts)
      setLoadedDate(date)
    }
    void load()
    return () => controller.abort()
  }, [date, storeId])

  function setCount(id: string, value: number) {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, value) }))
  }

  async function save() {
    if (!staffName) {
      showToast('画面上部で担当者名を保存してください')
      return
    }
    setSaving(true)
    const sb = getSupabaseClient()

    const { error: deleteError } = await sb
      .from('waste_logs')
      .delete()
      .eq('store_id', storeId)
      .gte('wasted_at', `${date}T00:00:00`)
      .lte('wasted_at', `${date}T23:59:59`)

    if (deleteError) {
      showToast('廃棄を記録できませんでした')
      setSaving(false)
      return
    }

    // 深夜0時過ぎの保存でも選択中の営業日に記録が入るよう、日時を明示する
    const records = types
      .filter((t) => (counts[t.id] || 0) > 0)
      .map((t) => ({
        donut_type_id: t.id,
        donut_type_name: t.name,
        quantity: counts[t.id],
        recorded_by: staffName,
        store_id: storeId,
        wasted_at: `${date}T12:00:00`,
      }))

    if (records.length > 0) {
      const { error } = await sb.from('waste_logs').insert(records)
      if (error) {
        showToast('廃棄を記録できませんでした。入力した内容でもう一度保存してください')
        setSaving(false)
        return
      }
    }

    showToast('廃棄を記録しました')
    setSaving(false)
  }

  async function addType() {
    if (!storeId || !newTypeName.trim()) return
    setAdding(true)
    const sb = getSupabaseClient()
    const maxOrder = types.reduce((max, t) => Math.max(max, t.sort_order ?? 0), 0)
    const { error } = await sb
      .from('donut_types')
      .insert({ name: newTypeName.trim(), sort_order: maxOrder + 1, store_id: storeId })
    setAdding(false)
    if (error) {
      showToast('種類を追加できませんでした')
      return
    }
    setNewTypeName('')
    setTypesRevision((revision) => revision + 1)
    showToast('種類を追加しました')
  }

  async function deleteType(id: string) {
    if (!confirm('この種類を削除しますか？（過去の廃棄履歴も一緒に消えます）')) return
    const sb = getSupabaseClient()
    const { error, count } = await sb
      .from('donut_types')
      .delete({ count: 'exact' })
      .eq('id', id)
    if (error || !count) {
      showToast('削除できませんでした（種類の削除は店長ログインが必要です）')
      return
    }
    setTypes((prev) => prev.filter((t) => t.id !== id))
  }

  async function downloadCSV() {
    setExporting(true)
    const sb = getSupabaseClient()
    const [year, month] = exportMonth.split('-')
    const lastDay = new Date(Number(year), Number(month), 0).getDate()

    const [{ data: typeData }, { data: logData }] = await Promise.all([
      sb.from('donut_types').select('*').eq('store_id', storeId).order('sort_order', { nullsFirst: false }).order('created_at'),
      sb.from('waste_logs')
        .select('*')
        .eq('store_id', storeId)
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
    <main className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-bold">廃棄記録</h1>
      <div className="space-y-3">

        {/* 日付ナビ */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-neutral-200 px-2 py-2">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="min-h-11 min-w-11 px-4 py-2 text-2xl text-neutral-600"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-800">{formatDateLabel(date)}</p>
            <p className="text-xs text-gray-400">{date}</p>
          </div>
          <button
            onClick={() => setDate(addDays(date, 1))}
            disabled={isLatestDay}
            className="min-h-11 min-w-11 px-4 py-2 text-2xl text-neutral-600 disabled:opacity-20"
          >
            ›
          </button>
        </div>

        {/* 廃棄数入力リスト */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-gray-400 text-sm">読み込み中...</div>
          ) : types.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm space-y-2">
              <p>ドーナツの種類が未登録です</p>
              <button onClick={() => setShowManage(true)} className="min-h-11 px-3 text-neutral-900 underline">
                種類を追加する
              </button>
            </div>
          ) : (
            <>
              {!isEditable && (
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
                    {isEditable ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCount(type.id, count - 1)}
                          disabled={count <= 0}
                          className="w-11 h-11 rounded-xl bg-neutral-100 text-xl font-bold text-gray-500 flex items-center justify-center disabled:opacity-25"
                        >
                          −
                        </button>
                        <span className={`w-10 text-center text-2xl font-bold font-mono ${count > 0 ? 'text-neutral-900' : 'text-gray-300'}`}>
                          {count}
                        </span>
                        <button
                          onClick={() => setCount(type.id, count + 1)}
                          className="w-11 h-11 rounded-xl bg-neutral-100 text-xl font-bold text-gray-600 flex items-center justify-center"
                        >
                          ＋
                        </button>
                      </div>
                    ) : (
                      <span className={`text-2xl font-bold font-mono ${count > 0 ? 'text-neutral-900' : 'text-gray-200'}`}>
                        {count}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* 合計 */}
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <span className="text-sm text-gray-500">合計廃棄数</span>
                <span className="text-xl font-bold text-neutral-900 font-mono">
                  {total}
                  <span className="text-sm font-normal text-gray-400 ml-1">個</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* 記録ボタン */}
        {isEditable && types.length > 0 && (
          <button
            onClick={save}
            disabled={saving || loading}
            className="min-h-11 w-full bg-neutral-900 text-white py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {saving ? '記録中...' : '廃棄を記録する'}
          </button>
        )}

        {/* CSVダウンロード */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-700">CSVダウンロード</h2>
          <div className="flex gap-2 items-center">
            <input
              type="month"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              className="min-h-11 min-w-0 flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
            <button
              onClick={downloadCSV}
              disabled={exporting}
              className="min-h-11 bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
            >
              {exporting ? '準備中...' : 'ダウンロード'}
            </button>
          </div>
          <p className="text-xs text-gray-400">Excel・Googleスプレッドシートで開けます</p>
        </div>

        {/* 種類を管理 */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
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
                    className="min-h-11 px-3 text-sm text-neutral-700"
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
                  className="min-h-11 min-w-0 flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400"
                />
                <button
                  onClick={addType}
                  disabled={adding || !newTypeName.trim()}
                  className="min-h-11 bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  追加
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-lg rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  )
}
