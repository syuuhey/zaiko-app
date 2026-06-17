'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'

type Log = {
  id: string
  checked_by: string
  stock_before: number
  stock_after: number
  note: string
  checked_at: string
  items: { name: string; unit: string }
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStaff, setFilterStaff] = useState('すべて')

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    setLoading(true)
    const sb = getSupabaseClient()
    const { data } = await sb
      .from('stock_logs')
      .select('*, items(name, unit)')
      .order('checked_at', { ascending: false })
      .limit(200)
    if (data) setLogs(data as Log[])
    setLoading(false)
  }

  const staffList = ['すべて', ...Array.from(new Set(logs.map((l) => l.checked_by))).sort()]
  const filtered = filterStaff === 'すべて' ? logs : logs.filter((l) => l.checked_by === filterStaff)

  function formatDate(str: string) {
    const d = new Date(str)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function diffColor(before: number, after: number) {
    if (after > before) return 'text-green-600'
    if (after < before) return 'text-red-500'
    return 'text-gray-400'
  }

  function diffLabel(before: number, after: number) {
    const diff = after - before
    if (diff > 0) return `+${diff}`
    if (diff < 0) return `${diff}`
    return '±0'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-700 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-white opacity-80 text-sm">← 戻る</Link>
          <h1 className="text-xl font-bold">チェック履歴</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* 担当者フィルター */}
        {!loading && staffList.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-xs text-gray-400 mb-2">担当者で絞り込み</p>
            <div className="flex flex-wrap gap-2">
              {staffList.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStaff(s)}
                  className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                    filterStaff === s ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">履歴がありません</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((log) => (
              <div key={log.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-base">
                      {log.items?.name ?? '不明'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(log.checked_at)} · {log.checked_by}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className={`text-lg font-bold ${diffColor(log.stock_before, log.stock_after)}`}>
                      {diffLabel(log.stock_before, log.stock_after)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {log.stock_before} → {log.stock_after} {log.items?.unit}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
