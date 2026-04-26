'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient, type Item, type Category } from '@/lib/supabase'
import Link from 'next/link'

export default function Home() {
  const [items, setItems] = useState<Item[]>([])
  const [category, setCategory] = useState<Category>('食料品')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStock, setEditStock] = useState<number>(0)
  const [checkedBy, setCheckedBy] = useState('スタッフ')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const sb = getSupabaseClient()
    const { data, error } = await sb
      .from('items')
      .select('*')
      .order('category')
      .order('name')
    console.log('data:', data, 'error:', error)
    if (data) setItems(data)
    setLoading(false)
  }

  const filtered = items.filter((i) => i.category === category)
  const lowStock = items.filter((i) => i.stock <= i.min_stock)

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditStock(item.stock)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveStock(item: Item) {
    setSaving(true)
    const sb = getSupabaseClient()
    const { error } = await sb
      .from('items')
      .update({ stock: editStock })
      .eq('id', item.id)

    if (!error) {
      await sb.from('stock_logs').insert({
        item_id: item.id,
        checked_by: checkedBy,
        stock_before: item.stock,
        stock_after: editStock,
      })
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, stock: editStock } : i))
      )
      showToast(`${item.name} を更新しました`)
    }
    setEditingId(null)
    setSaving(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function stockColor(item: Item) {
    if (item.stock === 0) return 'bg-red-100 text-red-700'
    if (item.stock <= item.min_stock) return 'bg-orange-100 text-orange-700'
    return 'bg-green-100 text-green-700'
  }

  function stockLabel(item: Item) {
    if (item.stock === 0) return '在庫なし'
    if (item.stock <= item.min_stock) return '要発注'
    return '在庫あり'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-700 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-wide">在庫管理</h1>
          <Link
            href="/admin"
            className="text-sm bg-white text-teal-700 px-3 py-1.5 rounded-full font-medium"
          >
            管理
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* 担当者 */}
        <div className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
          <span className="text-sm text-gray-500 shrink-0">担当者</span>
          <input
            type="text"
            value={checkedBy}
            onChange={(e) => setCheckedBy(e.target.value)}
            className="flex-1 text-base border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="名前を入力"
          />
        </div>

        {/* 要発注アラート */}
        {lowStock.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-bold text-red-700 mb-2">
              要発注 {lowStock.length}件
            </p>
            <ul className="space-y-1">
              {lowStock.map((i) => (
                <li
                  key={i.id}
                  className="text-sm text-red-600 flex justify-between"
                >
                  <span>{i.name}</span>
                  <span className="font-mono">
                    {i.stock} {i.unit} / 発注点 {i.min_stock}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* カテゴリタブ */}
        <div className="flex bg-white rounded-xl shadow-sm overflow-hidden">
          {(['食料品', '備品'] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-1 py-3 text-base font-medium transition-colors ${
                category === cat
                  ? 'bg-teal-700 text-white'
                  : 'text-gray-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 在庫リスト */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {editingId === item.id ? (
                  <div className="p-4 space-y-3">
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">在庫数</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setEditStock(Math.max(0, editStock - 1))
                          }
                          className="w-10 h-10 bg-gray-100 rounded-lg text-xl font-bold text-gray-700 flex items-center justify-center"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={editStock}
                          onChange={(e) =>
                            setEditStock(Math.max(0, Number(e.target.value)))
                          }
                          className="w-20 text-center text-xl font-bold border border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          inputMode="numeric"
                        />
                        <button
                          onClick={() => setEditStock(editStock + 1)}
                          className="w-10 h-10 bg-gray-100 rounded-lg text-xl font-bold text-gray-700 flex items-center justify-center"
                        >
                          ＋
                        </button>
                        <span className="text-sm text-gray-400">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveStock(item)}
                        disabled={saving}
                        className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-medium text-base disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-medium text-base"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(item)}
                    className="w-full p-4 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <p className="font-medium text-gray-800 text-base">
                        {item.name}
                      </p>
                      {item.supplier && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.supplier}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${stockColor(item)}`}
                      >
                        {stockLabel(item)}
                      </span>
                      <span className="text-lg font-bold text-gray-800 font-mono">
                        {item.stock}
                        <span className="text-sm font-normal text-gray-400 ml-1">
                          {item.unit}
                        </span>
                      </span>
                      <span className="text-gray-300 text-lg">›</span>
                    </div>
                  </button>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <p className="text-center text-gray-400 py-8">
                商品がありません
              </p>
            )}
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
