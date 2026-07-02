import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStores, currentMonth } from '@/lib/stores-server'
import { monthRange } from '@/lib/pnl'
import MonthStoreNav from '@/app/dashboard/components/MonthStoreNav'
import { addExpense } from '@/app/dashboard/actions'

export default async function ExpensesPage({
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
  const [{ data: categories }, { data: expenses }] = await Promise.all([
    supabase.from('expense_categories').select('*').order('sort_order'),
    supabase
      .from('expenses')
      .select('*, expense_categories(name)')
      .eq('store_id', store.id)
      .gte('expense_date', start)
      .lt('expense_date', end)
      .order('expense_date', { ascending: false }),
  ])

  return (
    <div className="space-y-4">
      <MonthStoreNav stores={stores} storeSlug={store.slug} month={month} />

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700">経費を手入力で追加</h2>
        <form action={addExpense} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="store_id" value={store.id} />
          <label className="col-span-2 text-xs text-gray-500">
            日付
            <input
              type="date"
              name="expense_date"
              defaultValue={`${month}-01`}
              required
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="col-span-2 text-xs text-gray-500">
            科目
            <select name="category_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            取引先
            <input name="vendor" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            金額（円）
            <input type="number" name="amount" required min={0} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="col-span-2 text-xs text-gray-500">
            メモ
            <input name="note" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <button className="col-span-2 bg-gray-800 text-white py-2.5 rounded-lg text-sm font-medium">
            追加する
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {(expenses ?? []).length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">この月の経費はまだありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-500">
                <th className="text-left px-4 py-2 font-medium">日付</th>
                <th className="text-left px-4 py-2 font-medium">科目</th>
                <th className="text-left px-4 py-2 font-medium">取引先</th>
                <th className="text-right px-4 py-2 font-medium">金額</th>
                <th className="text-left px-4 py-2 font-medium">記録元</th>
              </tr>
            </thead>
            <tbody>
              {(expenses ?? []).map((e) => (
                <tr key={e.id} className="border-t border-gray-50">
                  <td className="px-4 py-2">{e.expense_date}</td>
                  <td className="px-4 py-2">{e.expense_categories?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{e.vendor}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.amount.toLocaleString('ja-JP')}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {e.source === 'line_ocr' ? 'LINE OCR' : '手入力'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
