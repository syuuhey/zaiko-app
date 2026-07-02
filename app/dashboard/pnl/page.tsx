import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStores, currentMonth } from '@/lib/stores-server'
import { computePnl } from '@/lib/pnl'
import MonthStoreNav from '@/app/dashboard/components/MonthStoreNav'
import { snapshotInventory } from '@/app/dashboard/actions'

function fmtAmount(n: number | null) {
  if (n === null) return ''
  return n.toLocaleString('ja-JP')
}

function fmtRatio(r: number | null) {
  if (r === null) return ''
  return `${(r * 100).toFixed(2)}%`
}

export default async function PnlPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; month?: string }>
}) {
  const params = await searchParams
  const stores = await getStores()
  const store = stores.find((s) => s.slug === params.store) ?? stores[0]
  const month = params.month ?? currentMonth()

  if (!store) {
    return <p className="text-gray-400">店舗が登録されていません</p>
  }

  const supabase = await getSupabaseServerClient()
  const rows = await computePnl(supabase, store.id, month)

  return (
    <div className="space-y-4">
      <MonthStoreNav stores={stores} storeSlug={store.slug} month={month} />

      <div className="flex gap-2">
        <a
          href={`/api/pnl/export?store=${store.slug}&month=${month}`}
          className="text-sm bg-gray-800 text-white px-4 py-2 rounded-lg font-medium"
        >
          Excelエクスポート
        </a>
        <form action={snapshotInventory}>
          <input type="hidden" name="store_id" value={store.id} />
          <button className="text-sm bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium">
            棚卸を今すぐ確定（本日時点）
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-500">
              <th className="text-left px-4 py-2 font-medium">区分</th>
              <th className="text-left px-4 py-2 font-medium">項目</th>
              <th className="text-right px-4 py-2 font-medium">金額</th>
              <th className="text-right px-4 py-2 font-medium">比率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-t border-gray-50 ${row.bold ? 'bg-gray-50 font-bold' : ''}`}>
                <td className="px-4 py-2 text-gray-400 text-xs">{row.section}</td>
                <td className="px-4 py-2 text-gray-800">{row.label}</td>
                <td className="px-4 py-2 text-right font-mono">{fmtAmount(row.amount)}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-500">{fmtRatio(row.ratio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        棚卸金額には、その月内で最後に押した「棚卸確定」時点の在庫額が使われます。月末の営業終了後に押すのがおすすめです。
      </p>
    </div>
  )
}
