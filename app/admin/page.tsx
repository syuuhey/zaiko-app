'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient, type Item, type Category } from '@/lib/supabase'
import Link from 'next/link'

const EMPTY_FORM = {
  name: '',
  category: '食料品' as Category,
  unit: '個',
  stock: 0,
  min_stock: 0,
  ideal_stock: 0,
  unit_price: 0,
  supplier: '',
  note: '',
}

export default function AdminPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<Category>('食料品')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const sb = getSupabaseClient()
    const { data } = await sb
      .from('items')
      .select('*')
      .order('category')
      .order('name')
    if (data) setItems(data)
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(item: Item) {
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      stock: item.stock,
      min_stock: item.min_stock,
      ideal_stock: item.ideal_stock,
      unit_price: item.unit_price,
      supplier: item.supplier,
      note: item.note,
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  async function saveItem() {
    if (!form.name.trim()) return
    setSaving(true)
    const sb = getSupabaseClient()
    if (editingId) {
      const { error } = await sb.from('items').update(form).eq('id', editingId)
      if (!error) showToast('更新しました')
    } else {
      const { error } = await sb.from('items').insert(form)
      if (!error) showToast('追加しました')
    }
    setShowForm(false)
    setSaving(false)
    fetchItems()
  }

  async function deleteItem(item: Item) {
    if (!confirm(`「${item.name}」を削除しますか？`)) return
    const sb = getSupabaseClient()
    await sb.from('items').delete().eq('id', item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    showToast('削除しました')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const filtered = items.filter((i) => i.category === tab)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-700 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white opacity-80 text-sm">
              ← 戻る
            </Link>
            <h1 className="text-xl font-bold">商品管理</h1>
          </div>
          <button
            onClick={openNew}
            className="bg-white text-teal-700 px-3 py-1.5 rounded-full text-sm font-medium"
          >
            ＋ 追加
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* カテゴリタブ */}
        <div className="flex bg-white rounded-xl shadow-sm overflow-hidden">
          {(['食料品', '備品'] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setTab(cat)}
              className={`flex-1 py-3 text-base font-medium transition-colors ${
                tab === cat ? 'bg-teal-700 text-white' : 'text-gray-500'
              }`}
            >
              {cat} ({items.filter((i) => i.category === cat).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    在庫 {item.stock}{item.unit} / 発注点 {item.min_stock}
                    {item.unit} / 適正 {item.ideal_stock}
                    {item.unit}
                    {item.supplier ? ` / ${item.supplier}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => openEdit(item)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => deleteItem(item)}
                    className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-sm font-medium"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 py-8">商品がありません</p>
            )}
          </div>
        )}
      </div>

      {/* モーダル */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? '商品を編集' : '商品を追加'}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <Field label="商品名 *">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  placeholder="例: バニラアイスクリーム"
                />
              </Field>
              <Field label="カテゴリ">
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as Category })
                  }
                  className={inputClass}
                >
                  <option value="食料品">食料品</option>
                  <option value="備品">備品</option>
                </select>
              </Field>
              <Field label="単位">
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className={inputClass}
                  placeholder="例: 個, kg, 袋"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="現在庫">
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: Number(e.target.value) })
                    }
                    className={inputClass}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="発注点">
                  <input
                    type="number"
                    value={form.min_stock}
                    onChange={(e) =>
                      setForm({ ...form, min_stock: Number(e.target.value) })
                    }
                    className={inputClass}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="適正在庫">
                  <input
                    type="number"
                    value={form.ideal_stock}
                    onChange={(e) =>
                      setForm({ ...form, ideal_stock: Number(e.target.value) })
                    }
                    className={inputClass}
                    inputMode="numeric"
                  />
                </Field>
              </div>
              <Field label="単価（円）">
                <input
                  type="number"
                  value={form.unit_price}
                  onChange={(e) =>
                    setForm({ ...form, unit_price: Number(e.target.value) })
                  }
                  className={inputClass}
                  inputMode="numeric"
                />
              </Field>
              <Field label="仕入先">
                <input
                  type="text"
                  value={form.supplier}
                  onChange={(e) =>
                    setForm({ ...form, supplier: e.target.value })
                  }
                  className={inputClass}
                  placeholder="例: 〇〇冷凍食品"
                />
              </Field>
              <Field label="備考">
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className={inputClass}
                  placeholder="例: 要冷蔵, 季節限定"
                />
              </Field>
            </div>
            <div className="p-5 flex gap-3 border-t border-gray-100">
              <button
                onClick={saveItem}
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-medium"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-xl text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

const inputClass =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-400'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-500">{label}</label>
      {children}
    </div>
  )
}
