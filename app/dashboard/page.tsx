import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStores, currentMonth } from '@/lib/stores-server'
import { computePnl } from '@/lib/pnl'

export default async function DashboardHome() {
  const stores = await getStores()
  const month = currentMonth()
  const supabase = await getSupabaseServerClient()

  const summaries = await Promise.all(
    stores.map(async (store) => {
      const rows = await computePnl(supabase, store.id, month)
      const netSales = rows.find((r) => r.label === '税抜き売上(1)')?.amount ?? 0
      const operatingProfit = rows.find((r) => r.label.startsWith('営業利益'))?.amount ?? 0
      return { store, netSales, operatingProfit }
    })
  )

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-gray-500">{month} の店舗別サマリー</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {summaries.map(({ store, netSales, operatingProfit }) => (
          <Link
            key={store.id}
            href={`/dashboard/pnl?store=${store.slug}&month=${month}`}
            className="bg-white rounded-2xl border border-neutral-200 p-4 block hover:border-neutral-400 transition-colors"
          >
            <p className="font-bold text-gray-800">{store.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-400 text-xs">税抜き売上</p>
                <p className="font-mono font-bold">{netSales.toLocaleString('ja-JP')}円</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">営業利益</p>
                <p className="font-mono font-bold">{operatingProfit.toLocaleString('ja-JP')}円</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {stores.length === 0 && <p className="text-gray-400">店舗が登録されていません</p>}
    </div>
  )
}
