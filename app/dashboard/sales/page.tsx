import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStores, currentMonth } from '@/lib/stores-server'
import MonthStoreNav from '@/app/dashboard/components/MonthStoreNav'
import { addSales } from '@/app/dashboard/actions'

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; month?: string }>
}) {
  const params = await searchParams
  const stores = await getStores()
  const store = stores.find((s) => s.slug === params.store) ?? stores[0]
  const month = params.month ?? currentMonth()

  if (!store) return <p className="text-gray-400">店舗が登録されていません</p>

  const supabase = await getSupabaseServerClient()
  const { data: sales } = await supabase
    .from('sales_daily')
    .select('*')
    .eq('store_id', store.id)
    .gte('sales_date', `${month}-01`)
    .lt('sales_date', `${month}-32`)
    .order('sales_date', { ascending: false })

  return (
    <div className="space-y-4">
      <MonthStoreNav stores={stores} storeSlug={store.slug} month={month} />
      <p className="text-xs text-gray-400">
        AirREGI連携が整うまでは手入力です。連携が始まると自動反映（source: airregi）に切り替わります。
      </p>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700">売上を手入力で追加</h2>
        <form action={addSales} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="store_id" value={store.id} />
          <label className="col-span-2 text-xs text-gray-500">
            日付
            <input type="date" name="sales_date" defaultValue={`${month}-01`} required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            総売上（円）
            <input type="number" name="gross_sales" required min={0} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            税抜き売上（円）
            <input type="number" name="net_sales" required min={0} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <button className="col-span-2 bg-gray-800 text-white py-2.5 rounded-lg text-sm font-medium">
            保存する（同じ日付は上書き）
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {(sales ?? []).length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">この月の売上はまだありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-500">
                <th className="text-left px-4 py-2 font-medium">日付</th>
                <th className="text-right px-4 py-2 font-medium">総売上</th>
                <th className="text-right px-4 py-2 font-medium">税抜き売上</th>
                <th className="text-left px-4 py-2 font-medium">記録元</th>
              </tr>
            </thead>
            <tbody>
              {(sales ?? []).map((s) => (
                <tr key={s.id} className="border-t border-gray-50">
                  <td className="px-4 py-2">{s.sales_date}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.gross_sales.toLocaleString('ja-JP')}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.net_sales.toLocaleString('ja-JP')}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{s.source === 'airregi' ? 'AirREGI' : '手入力'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
