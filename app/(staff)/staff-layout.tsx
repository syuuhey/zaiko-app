'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import StoreSwitcher from '@/app/components/StoreSwitcher'
import { getSupabaseClient, type Item } from '@/lib/supabase'
import { useStoreSelection } from '@/lib/stores'

const NAME_KEY = 'zaiko-app:staff-name'
const NAME_EVENT = 'zaiko-staff-name'
const tabs = [
  { href: '/', label: 'ホーム' },
  { href: '/stock', label: '在庫' },
  { href: '/orders', label: '発注' },
  { href: '/more', label: 'その他' },
]

type Catalog = { storeId: string; items: Item[] | null }
type StaffContextValue = {
  storeId: string
  staffName: string
  items: Item[] | null
  reloadItems: () => void
  setStoreGuard: (guard: (() => boolean) | null) => void
}

const StaffContext = createContext<StaffContextValue | null>(null)

export function useStaff() {
  const staff = useContext(StaffContext)
  if (!staff) throw new Error('Staff layout is required')
  return staff
}

function subscribeToStaffName(callback: () => void) {
  window.addEventListener(NAME_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(NAME_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function StaffNameForm({ currentName = '' }: { currentName?: string }) {
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get('name') ?? '').trim()
    if (!value) {
      setMessage('担当者名を入力してください。')
      return
    }
    localStorage.setItem(NAME_KEY, value)
    window.dispatchEvent(new Event(NAME_EVENT))
    setDraft(null)
    setMessage('担当者名を保存しました。')
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-sm font-medium">
          担当者名
          <input autoComplete="off" className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3" name="name" required
            value={draft ?? currentName} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <button className="min-h-11 rounded-lg bg-neutral-900 px-4 text-sm font-bold text-white">保存</button>
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  )
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  const path = usePathname()
  const { stores, storeId, selectStore, loading, error } = useStoreSelection()
  const staffName = useSyncExternalStore(subscribeToStaffName, () => localStorage.getItem(NAME_KEY) ?? '', () => '')
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [revision, setRevision] = useState(0)
  const guard = useRef<(() => boolean) | null>(null)
  const setStoreGuard = useCallback((callback: (() => boolean) | null) => { guard.current = callback }, [])
  const items = catalog?.storeId === storeId ? catalog.items : null

  useEffect(() => {
    if (!storeId) return
    const controller = new AbortController()
    async function load() {
      const result = await getSupabaseClient().from('items').select('*').eq('store_id', storeId)
        .order('sort_order', { nullsFirst: false }).order('name').abortSignal(controller.signal)
      if (!controller.signal.aborted) setCatalog({ storeId, items: result.data })
    }
    void load()
    return () => controller.abort()
  }, [storeId, revision])

  function changeStore(id: string) {
    if (id !== storeId && (!guard.current || guard.current())) selectStore(id)
  }

  return (
    <StaffContext.Provider value={{ storeId, items, staffName, reloadItems: () => setRevision((value) => value + 1), setStoreGuard }}>
      <div className="mx-auto min-h-screen w-full max-w-2xl bg-white pb-[calc(5rem+env(safe-area-inset-bottom))] text-neutral-900">
        <header className="space-y-3 border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-bold">在庫管理</p>
          <StoreSwitcher stores={stores} storeId={storeId} onSelect={changeStore} />
          {error && <p role="alert" className="text-sm text-orange-800">店舗を読み込めませんでした。</p>}
          {!loading && !error && !storeId && <p className="text-sm">店舗が登録されていません。</p>}
          {storeId && !staffName && path !== '/more' && path !== '/login' && <StaffNameForm />}
          {items?.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-100 px-3 py-2">
              <span className="text-sm">この店舗の商品は0件です</span>
              <Link href="/items" className="inline-flex min-h-11 items-center rounded-lg bg-neutral-900 px-3 text-sm font-bold text-white">商品を登録する</Link>
            </div>
          )}
        </header>
        {storeId && catalog?.storeId === storeId && items === null && (
          <p role="alert" className="px-4 py-3 text-sm text-orange-800">商品を読み込めませんでした。ページを再読み込みしてください。</p>
        )}
        <div key={storeId}>{children}</div>
      </div>
      <nav aria-label="メインメニュー" className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-2xl grid-cols-4 border-t border-neutral-200 bg-white px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label }) => {
          const current = path === href || (href === '/more' && ['/items', '/history', '/waste', '/login'].some((prefix) => path === prefix || path.startsWith(prefix + '/')))
          return (
            <a key={href} href={href} aria-current={current ? 'page' : undefined}
              className={`flex min-h-14 items-center justify-center border-t-2 text-sm ${current ? 'border-neutral-900 font-bold text-neutral-900' : 'border-transparent text-neutral-600'}`}>
              {label}
            </a>
          )
        })}
      </nav>
    </StaffContext.Provider>
  )
}
