import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStores, currentMonth } from '@/lib/stores-server'
import { monthRange } from '@/lib/pnl'
import MonthStoreNav from '@/app/dashboard/components/MonthStoreNav'
import { addRegisterClosing } from '@/app/dashboard/actions'

export default async function RegisterClosingsPage({
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
  const { data: closings } = await supabase
    .from('register_closings')
    .select('*')
    .eq('store_id', store.id)
    .gte('closing_date', start)
    .lt('closing_date', end)
    .order('closing_date', { ascending: false })

  return (
    <div className="space-y-4">
      <MonthStoreNav stores={stores} storeSlug={store.slug} month={month} />
      <p className="text-xs text-gray-400">
        現状は既存のレジ締め報告フォームと並行しての手入力です。Googleスプレッドシート連携が整うと自動反映に切り替わります。
      </p>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700">レジ締め報告を追加</h2>
        <form action={addRegisterClosing} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="store_id" value={store.id} />
          <label className="col-span-2 text-xs text-gray-500">
            日付
            <input type="date" name="closing_date" defaultValue={`${month}-01`} required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            オープン時釣り銭
            <input type="number" name="opening_change" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            修正
            <input type="number" name="adjustment" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            過不足
            <input type="number" name="over_short" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            預入
            <input type="number" name="deposit" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            繰越
            <input type="number" name="carried_over" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            担当者
            <input name="staff_name" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <button className="col-span-2 bg-gray-800 text-white py-2.5 rounded-lg text-sm font-medium">
            追加する
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {(closings ?? []).length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">この月のレジ締め報告はまだありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-500">
                <th className="text-left px-4 py-2 font-medium">日付</th>
                <th className="text-right px-4 py-2 font-medium">過不足</th>
                <th className="text-right px-4 py-2 font-medium">預入</th>
                <th className="text-right px-4 py-2 font-medium">繰越</th>
                <th className="text-left px-4 py-2 font-medium">担当者</th>
              </tr>
            </thead>
            <tbody>
              {(closings ?? []).map((c) => (
                <tr key={c.id} className="border-t border-gray-50">
                  <td className="px-4 py-2">{c.closing_date}</td>
                  <td className={`px-4 py-2 text-right font-mono ${c.over_short && c.over_short !== 0 ? 'text-red-500' : ''}`}>
                    {c.over_short?.toLocaleString('ja-JP') ?? '-'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{c.deposit?.toLocaleString('ja-JP') ?? '-'}</td>
                  <td className="px-4 py-2 text-right font-mono">{c.carried_over?.toLocaleString('ja-JP') ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{c.staff_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
