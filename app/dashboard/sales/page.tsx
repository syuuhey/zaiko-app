import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStores, currentMonth } from '@/lib/stores-server'
import { monthRange } from '@/lib/pnl'
import MonthStoreNav from '@/app/dashboard/components/MonthStoreNav'
import { addSales, importSalesCsv } from '@/app/dashboard/actions'

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
  const { start, end } = monthRange(month)
  const { data: sales } = await supabase
    .from('sales_daily')
    .select('*')
    .eq('store_id', store.id)
    .gte('sales_date', start)
    .lt('sales_date', end)
    .order('sales_date', { ascending: false })

  return (
    <div className="space-y-4">
      <MonthStoreNav stores={stores} storeSlug={store.slug} month={month} />

      <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700">AirレジのCSVを取り込む</h2>
        <p className="text-xs text-gray-400">
          Airレジ バックオフィスの「売上」からダウンロードした売上集計CSVをそのままアップロードしてください。同じ日付は上書きされます。
        </p>
        <form action={importSalesCsv} className="space-y-3">
          <input type="hidden" name="store_id" value={store.id} />
          <input
            type="file"
            name="file"
            accept=".csv"
            required
            className="w-full text-sm text-gray-600 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-sm file:font-medium"
          />
          <label className="block text-xs text-gray-500">
            消費税率（税抜き売上の計算に使用）
            <select name="tax_rate" defaultValue="0.08" className="mt-1 w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
              <option value="0.08">8%（テイクアウト・軽減税率）</option>
              <option value="0.1">10%（イートイン等）</option>
            </select>
          </label>
          <button className="w-full bg-neutral-900 text-white py-2.5 rounded-lg text-sm font-medium">
            アップロードして取り込む
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700">売上を手入力で追加</h2>
        <form action={addSales} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="store_id" value={store.id} />
          <label className="col-span-2 text-xs text-gray-500">
            日付
            <input type="date" name="sales_date" defaultValue={`${month}-01`} required className="mt-1 w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            総売上（円）
            <input type="number" name="gross_sales" required min={0} className="mt-1 w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            税抜き売上（円）
            <input type="number" name="net_sales" required min={0} className="mt-1 w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <button className="col-span-2 bg-neutral-900 text-white py-2.5 rounded-lg text-sm font-medium">
            保存する（同じ日付は上書き）
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {(sales ?? []).length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">この月の売上はまだありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-neutral-400">
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
