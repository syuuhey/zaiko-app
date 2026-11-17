'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { getSupabaseClient, type Category, type Item } from '@/lib/supabase'
import { useStaff } from '../../staff-layout'
import { buttonClass, panelClass, readQuantity } from '../../ui'
import { supplierChoices } from '../supplier-choices'

type SettingField = 'min_stock' | 'ideal_stock' | 'supplier'
type Draft = Partial<Record<SettingField, string>>
const fields = [
  { key: 'min_stock', label: '発注点' },
  { key: 'ideal_stock', label: '適正在庫' },
  { key: 'supplier', label: '仕入先' },
] as const
const categories: Category[] = ['食料品', '備品']
const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-2 text-base'
const unsavedMessage = '保存していない設定があります。移動しますか？'

function SetupList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems)
  const { storeId, reloadItems, setStoreGuard } = useStaff()
  const [category, setCategory] = useState<Category>(initialItems.some((item) => item.category === '食料品') ? '食料品' : '備品')
  const [missingOnly, setMissingOnly] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const inputs = useRef(new Map<string, HTMLInputElement>())

  const draftCount = Object.keys(drafts).length
  const visible = items.filter((item) => item.category === category && (!missingOnly || item.min_stock <= 0 || !!drafts[item.id]))

  useEffect(() => {
    if (!draftCount) return
    setStoreGuard(() => !saving && window.confirm(unsavedMessage))
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      setStoreGuard(null)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [draftCount, saving, setStoreGuard])

  function edit(item: Item, field: SettingField, value: string) {
    const previous = String(item[field] ?? '')
    setDrafts((drafts) => {
      const row = { ...drafts[item.id] }
      if (value === previous || (field !== 'supplier' && readQuantity(value) === item[field])) delete row[field]
      else row[field] = value
      const next = { ...drafts }
      if (Object.keys(row).length) next[item.id] = row
      else delete next[item.id]
      return next
    })
    setErrors((errors) => {
      if (!errors[item.id]) return errors
      const next = { ...errors }
      delete next[item.id]
      return next
    })
  }

  function nextRow(event: KeyboardEvent<HTMLInputElement>, index: number, field: SettingField) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    const nextItem = visible[index + 1]
    if (nextItem) inputs.current.get(`${nextItem.id}-${field}`)?.focus()
  }

  async function save() {
    if (!draftCount || saving) return
    setSaving(true)
    setMessage('')
    const updates = new Map<string, Partial<Pick<Item, SettingField>>>()
    const failed: Record<string, string> = {}
    const supabase = getSupabaseClient()
    for (const item of items) {
      const draft = drafts[item.id]
      if (!draft) continue

      const updatesForItem: Partial<Pick<Item, SettingField>> = {}
      for (const field of ['min_stock', 'ideal_stock'] as const) {
        if (draft[field] === undefined) continue
        const value = readQuantity(draft[field])
        if (value === null) {
          failed[item.id] = '発注点と適正在庫は0以上の整数で入力してください。'
          break
        }
        updatesForItem[field] = value
      }
      if (failed[item.id]) continue
      if (draft.supplier !== undefined) updatesForItem.supplier = draft.supplier

      let query = supabase.from('items').update(updatesForItem).eq('id', item.id).eq('store_id', storeId)
      for (const { key } of fields) {
        if (draft[key] === undefined) continue
        const original = item[key]
        query = original === null ? query.is(key, null) : query.eq(key, original)
      }
      const { data, error } = await query.select('id').maybeSingle()
      if (error || !data) {
        failed[item.id] = error ? '設定を保存できませんでした。' : '設定が別の場所で変更されました。再読み込みして確認してください。'
        continue
      }
      updates.set(item.id, updatesForItem)
    }

    setItems((current) => current.map((item) => ({ ...item, ...updates.get(item.id) })))
    setDrafts(Object.fromEntries(Object.entries(drafts).filter(([id]) => !updates.has(id))))
    setErrors(failed)
    const remaining = Object.keys(failed).length
    setMessage(`${updates.size}件を保存しました${remaining ? `。未完了 ${remaining}件` : ''}。`)
    if (updates.size && remaining === 0) reloadItems()
    setSaving(false)
  }

  return (
    <>
      <div className="grid grid-cols-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        {categories.map((value) => (
          <button type="button" key={value} aria-pressed={category === value}
            onClick={() => setCategory(value)}
            className={`min-h-11 rounded-lg text-sm font-bold ${category === value ? 'bg-neutral-900 text-white' : 'text-neutral-700'}`}>{value}</button>
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="h-5 w-5 accent-neutral-900" checked={missingOnly}
          onChange={(event) => setMissingOnly(event.target.checked)} />
        未設定だけ表示
      </label>
      <datalist id="setup-suppliers">
        {supplierChoices(items).map((name) => <option key={name} value={name} />)}
      </datalist>
      {visible.length === 0 && <p className="text-sm text-neutral-600">表示する商品はありません。</p>}
      <ul className="space-y-2">
        {visible.map((item, index) => (
          <li key={item.id} className={panelClass + (drafts[item.id] ? ' bg-blue-50!' : '')}>
            <p className="break-words font-bold">{item.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {fields.map(({ key, label }) => (
                <label key={key} className={`min-w-0 text-sm text-neutral-700 ${key === 'supplier' ? 'col-span-2' : ''}`}>
                  {label}
                  <input type="text" name={key} aria-label={`${item.name}の${label}`} className={inputClass}
                    ref={(node) => {
                      const inputKey = `${item.id}-${key}`
                      if (node) inputs.current.set(inputKey, node)
                      else inputs.current.delete(inputKey)
                    }}
                    value={drafts[item.id]?.[key] ?? String(item[key] ?? '')} disabled={saving}
                    inputMode={key === 'supplier' ? undefined : 'numeric'} enterKeyHint="next"
                    list={key === 'supplier' ? 'setup-suppliers' : undefined}
                    onFocus={(event) => { if (key !== 'supplier') event.currentTarget.select() }}
                    onKeyDown={(event) => nextRow(event, index, key)}
                    onChange={(event) => edit(item, key, event.target.value)} />
                </label>
              ))}
            </div>
            {errors[item.id] && <p role="alert" className="mt-2 text-sm text-orange-800">{errors[item.id]}</p>}
          </li>
        ))}
      </ul>
      {(draftCount > 0 || message) && (
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 space-y-2 border-t border-neutral-200 bg-white py-3">
          {message && <p role="status" className="text-sm">{message}</p>}
          {draftCount > 0 && <button type="button" className={buttonClass + ' w-full'} disabled={saving} onClick={() => void save()}>
            {saving ? '保存中…' : `変更した ${draftCount} 件をまとめて保存`}
          </button>}
        </div>
      )}
    </>
  )
}

export default function SetupPage() {
  const { items } = useStaff()
  return (
    <main className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-bold">一括設定</h1>
      {items && items.length > 0 && <SetupList initialItems={items} />}
    </main>
  )
}
