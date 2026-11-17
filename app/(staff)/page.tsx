'use client'

import { useEffect, useState } from 'react'
import { addDays, getBusinessDateStr, getLocalDateStr } from '@/lib/business-date'
import { getSupabaseClient } from '@/lib/supabase'
import { orderCandidates, useOpenOrders } from './order-data'
import { useStaff } from './staff-layout'

type Activity = { lastStock: string | null; wasteRecorded: boolean; error: boolean }
type Card = { title: string; detail: string; caption?: string; href: string; tone?: string }

function daysSince(value: string) {
  const today = Date.parse(getLocalDateStr())
  const checked = Date.parse(getLocalDateStr(new Date(value)))
  return Math.max(0, (today - checked) / 86_400_000)
}

export default function HomePage() {
  const { storeId, items } = useStaff()
  const { result } = useOpenOrders(storeId)
  const [activity, setActivity] = useState<Activity | null>(null)

  useEffect(() => {
    if (!storeId) return
    const controller = new AbortController()
    const supabase = getSupabaseClient()
    const today = getBusinessDateStr()
    async function load() {
      const [stock, waste] = await Promise.all([
        supabase.from('stock_logs').select('checked_at').eq('store_id', storeId)
          .or('note.is.null,note.neq.入荷')
          .order('checked_at', { ascending: false }).limit(1).abortSignal(controller.signal),
        supabase.from('waste_logs').select('id').eq('store_id', storeId)
          .gte('wasted_at', `${today}T00:00:00`).lt('wasted_at', `${addDays(today, 1)}T00:00:00`)
          .limit(1).abortSignal(controller.signal),
      ])
      if (!controller.signal.aborted) {
        setActivity({ lastStock: stock.data?.[0]?.checked_at ?? null, wasteRecorded: !!waste.data?.length, error: !!(stock.error || waste.error) })
      }
    }
    void load()
    return () => controller.abort()
  }, [storeId])

  const groups = orderCandidates(items ?? [], new Set(result?.orders.map((order) => order.item_id)))
  const suppliers = [...groups].sort((a, b) => b[1].length - a[1].length)
  const candidates = suppliers.reduce((count, [, group]) => count + group.length, 0)
  const waiting = result?.orders.length ?? 0
  const missing = items?.filter((item) => item.min_stock <= 0).length ?? 0
  const days = activity?.lastStock ? daysSince(activity.lastStock) : null
  const cardList: Card[] = [
    { title: '発注が必要', href: '/orders', detail: candidates ? `${candidates}件` : 'なし',
      tone: candidates ? 'text-orange-800' : undefined,
      caption: suppliers.length ? suppliers.slice(0, 2).map(([supplier, group]) => `${supplier || '仕入先未設定'} ${group.length}件`).join(' ／ ') + (suppliers.length > 2 ? ' ほか' : '') : undefined },
    { title: '入荷待ち', href: '/orders', detail: waiting ? `${waiting}件` : 'なし', tone: waiting ? 'text-blue-800' : undefined },
    { title: '在庫チェック', href: '/stock', detail: days === null ? '記録なし' : days === 0 ? '今日 チェック済み' : `最後の記録から${days}日`,
      tone: days === 0 ? 'text-green-800' : days ? 'text-orange-800' : undefined },
    { title: '廃棄', href: '/waste', detail: activity?.wasteRecorded ? '記録あり' : '記録なし', tone: activity?.wasteRecorded ? 'text-green-800' : undefined },
  ]
  if (missing) cardList.push({ title: '設定が足りない商品', detail: `${missing}件`, href: '/items/setup', tone: 'text-orange-800' })

  return (
    <main className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-bold">今日やること</h1>
      {(result?.error || activity?.error) ? (
        <p role="alert" className="text-sm text-orange-800">今日の状況を読み込めませんでした。ページを再読み込みしてください。</p>
      ) : items && result && activity ? (
        <div className="space-y-2">
          {cardList.map(({ title, href, detail, caption, tone }) => (
            <a key={title} href={href} className="block rounded-xl border border-neutral-200 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <h2 className="font-bold">{title}</h2>
                <span className={`text-sm font-semibold ${tone ?? 'text-neutral-600'}`}>{detail} <span aria-hidden>›</span></span>
              </div>
              {caption && <p className="mt-1 break-words text-sm text-neutral-600">{caption}</p>}
            </a>
          ))}
        </div>
      ) : storeId && <p className="text-sm text-neutral-600">読み込み中…</p>}
    </main>
  )
}
