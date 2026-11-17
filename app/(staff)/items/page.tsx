'use client'

import { useState } from 'react'
import { getSupabaseClient, type Item, type Category } from '@/lib/supabase'
import { useStaff } from '../staff-layout'
import { updateStock, writeStockLog, type StockLogInput } from '../stock-write'
import { buttonClass, panelClass, readQuantity } from '../ui'
import { supplierChoices } from './supplier-choices'
import Link from 'next/link'

const EMPTY_FORM = {
  name: '',
  category: '食料品' as Category,
  unit: '個',
  stock: '0',
  min_stock: '0',
  ideal_stock: '0',
  unit_price: '0',
  supplier: '',
  note: '',
}

export default function AdminPage() {
  const { items: catalog, storeId, reloadItems, staffName } = useStaff()
  const items = catalog ?? []
  const loading = catalog === null
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<Item | null>(null)
  const [pendingLog, setPendingLog] = useState<StockLogInput | null>(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<Category>('食料品')
  const [reorderMode, setReorderMode] = useState(false)

  function openNew() {
    setForm(EMPTY_FORM)
    setEditing(null)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(item: Item) {
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      stock: String(item.stock ?? 0),
      min_stock: String(item.min_stock ?? 0),
      ideal_stock: String(item.ideal_stock ?? 0),
      unit_price: String(item.unit_price ?? 0),
      supplier: item.supplier ?? '',
      note: item.note ?? '',
    })
    setEditing(item)
    setFormError('')
    setShowForm(true)
  }

  async function moveItem(id: string, direction: 'up' | 'down') {
    const idx = filtered.findIndex((i) => i.id === id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= filtered.length) return

    const a = filtered[idx]
    const b = filtered[targetIdx]
    const aOrder = a.sort_order ?? idx
    const bOrder = b.sort_order ?? targetIdx

    const sb = getSupabaseClient()
    const results = await Promise.all([
      sb.from('items').update({ sort_order: bOrder }).eq('id', a.id),
      sb.from('items').update({ sort_order: aOrder }).eq('id', b.id),
    ])
    showToast(results.some((result) => result.error) ? '並び順を保存できない商品があります' : '並び順を保存しました')
    reloadItems()
  }

  async function saveItem() {
    if (!storeId || !form.name.trim() || saving) return
    setFormError('')
    if (pendingLog) {
      setSaving(true)
      await finishStockLog(pendingLog)
      setSaving(false)
      return
    }

    const stock = readQuantity(form.stock)
    const minStock = readQuantity(form.min_stock)
    const idealStock = readQuantity(form.ideal_stock)
    const unitPrice = readQuantity(form.unit_price)
    if (stock === null || minStock === null || idealStock === null || unitPrice === null) {
      setFormError('在庫・発注点・適正在庫・単価は0以上の整数で入力してください。')
      return
    }

    const values = {
      name: form.name,
      category: form.category,
      unit: form.unit,
      min_stock: minStock,
      ideal_stock: idealStock,
      unit_price: unitPrice,
      supplier: form.supplier,
      note: form.note,
    }
    const original = editing
    const details = original ? Object.fromEntries((Object.keys(values) as (keyof typeof values)[]).flatMap((key) => {
      const value = values[key]
      const previous = original[key] ?? (typeof value === 'number' ? 0 : '')
      return value === previous ? [] : [[key, value]]
    })) : values
    if (editing && stock !== editing.stock) {
      if (!staffName) {
        setFormError('在庫数を変更するには、画面上部で担当者名を保存してください。')
        return
      }
      setSaving(true)
      const result = await updateStock(editing, stock, staffName, details)
      if (result.error !== undefined) setFormError(result.error)
      else await finishStockLog(result.log)
      setSaving(false)
      return
    }

    if (editing && !Object.keys(details).length) {
      setShowForm(false)
      showToast('変更はありません')
      return
    }
    setSaving(true)
    const sb = getSupabaseClient()
    const maxOrder = items.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0)
    const { data, error } = editing
      ? await sb.from('items').update(details).eq('id', editing.id).eq('store_id', storeId).select('id').maybeSingle()
      : await sb.from('items').insert({ ...details, stock, sort_order: maxOrder + 1, store_id: storeId }).select('id').single()
    setSaving(false)
    if (error || !data) {
      setFormError('商品を保存できませんでした。')
      return
    }
    closeAfterSave(editing ? '更新しました' : '追加しました')
  }

  async function finishStockLog(log: StockLogInput) {
    if (!await writeStockLog(log)) {
      setPendingLog(log)
      setFormError('在庫は更新済み・履歴は未記録。もう一度保存すると履歴を再試行します。')
      reloadItems()
      return
    }
    setPendingLog(null)
    closeAfterSave('在庫と履歴を更新しました')
  }

  function closeAfterSave(message: string) {
    showToast(message)
    setShowForm(false)
    reloadItems()
  }

  function closeForm() {
    if (pendingLog && !window.confirm('在庫は更新済み・履歴は未記録です。画面を閉じますか？')) return
    setPendingLog(null)
    setShowForm(false)
  }

  async function deleteItem(item: Item) {
    if (!confirm(`「${item.name}」を削除しますか？`)) return
    const sb = getSupabaseClient()
    const { error, count } = await sb
      .from('items')
      .delete({ count: 'exact' })
      .eq('id', item.id)
      .eq('store_id', storeId)
    if (error || !count) {
      showToast(error?.code === '23503'
        ? '発注・棚卸の履歴があるため削除できません'
        : '削除できませんでした（商品の削除は店長ログインが必要です）')
      return
    }
    reloadItems()
    showToast('削除しました')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const filtered = items.filter((i) => i.category === tab)
  const title = editing ? '商品を編集' : '商品を追加'

  return (
    <main className="space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">商品管理</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => setReorderMode(!reorderMode)}
            className={`min-h-11 rounded-lg border border-neutral-300 px-3 text-sm font-medium ${reorderMode ? 'bg-blue-50' : ''}`}>
            {reorderMode ? '完了' : '並び替え'}
          </button>
          {!reorderMode && <button type="button" disabled={!storeId || loading} onClick={openNew} className={buttonClass}>＋ 追加</button>}
        </div>
      </div>
      <Link href="/items/setup" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 px-3 text-sm font-medium">一括設定</Link>
      <div className="space-y-3">
        {/* カテゴリタブ */}
        <div className="flex bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          {(['食料品', '備品'] as Category[]).map((cat) => (
            <button
              key={cat}
              aria-pressed={tab === cat}
              onClick={() => setTab(cat)}
              className={`min-h-11 flex-1 py-2 text-sm font-medium transition-colors ${
                tab === cat ? 'bg-neutral-900 text-white' : 'text-gray-500'
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
            {filtered.map((item, idx) => (
              <div
                key={item.id}
                className={panelClass + ' flex flex-wrap items-center justify-between gap-2'}
              >
                <div>
                  <p className="break-words font-bold">{item.name}</p>
                  <p className="mt-0.5 break-words text-xs text-neutral-600">
                    在庫 {item.stock}{item.unit} / 発注点 {item.min_stock}
                    {item.unit} / 適正 {item.ideal_stock}
                    {item.unit}
                    {item.supplier ? ` / ${item.supplier}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {reorderMode ? (
                    <>
                      <button
                        onClick={() => moveItem(item.id, 'up')}
                        disabled={idx === 0}
                        className="w-11 h-11 bg-neutral-100 text-gray-600 rounded-lg text-lg font-bold disabled:opacity-20"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveItem(item.id, 'down')}
                        disabled={idx === filtered.length - 1}
                        className="w-11 h-11 bg-neutral-100 text-gray-600 rounded-lg text-lg font-bold disabled:opacity-20"
                      >
                        ↓
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openEdit(item)}
                        className="min-h-11 px-3 bg-neutral-100 text-gray-600 rounded-lg text-sm font-medium"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteItem(item)}
                        className="min-h-11 px-3 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium"
                      >
                        削除
                      </button>
                    </>
                  )}
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
          <div role="dialog" aria-modal="true" aria-labelledby="item-form-title" className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl bg-white">
            <div className="p-5 border-b border-gray-100">
              <h2 id="item-form-title" className="text-lg font-bold">{title}</h2>
            </div>
            <fieldset disabled={saving || !!pendingLog} className="space-y-4 p-4">
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.stock}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="発注点">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.min_stock}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setForm({ ...form, min_stock: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="適正在庫">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.ideal_stock}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setForm({ ...form, ideal_stock: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="単価（円）">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.unit_price}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setForm({ ...form, unit_price: e.target.value })
                  }
                  className={inputClass}
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
                  list="item-suppliers"
                  placeholder="例: 〇〇冷凍食品"
                />
                <datalist id="item-suppliers">
                  {supplierChoices(items).map((name) => <option key={name} value={name} />)}
                </datalist>
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
            </fieldset>
            {formError && <p role="alert" className="mx-4 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">{formError}</p>}
            <div className="flex gap-3 border-t border-neutral-200 p-4">
              <button
                onClick={saveItem}
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-neutral-900 text-white py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {saving ? '保存中…' : pendingLog ? '履歴を再試行' : '保存'}
              </button>
              <button
                onClick={closeForm}
                disabled={saving}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-medium"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-lg rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  )
}

const inputClass =
  'min-h-11 w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-neutral-700">{label}</span>
      {children}
    </label>
  )
}
