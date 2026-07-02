import type { SupabaseClient } from '@supabase/supabase-js'

export type PnlRow = {
  section: string
  label: string
  amount: number | null
  ratio: number | null
  bold?: boolean
}

function monthRange(month: string) {
  // month: 'YYYY-MM'
  const start = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start, end: nextMonth }
}

// 既存Excelテンプレート（損益計算書_5月.xlsx）と同じ行構造で月次P&Lを計算する。
// 比率は原則「税抜き売上(1)」に対する割合、労働分配率のみ「売上総利益(3)」に対する割合。
export async function computePnl(
  supabase: SupabaseClient,
  storeId: string,
  month: string
): Promise<PnlRow[]> {
  const { start, end } = monthRange(month)

  const [salesRes, expensesRes, categoriesRes, snapshotRes] = await Promise.all([
    supabase
      .from('sales_daily')
      .select('sales_date, gross_sales, net_sales, source')
      .eq('store_id', storeId)
      .gte('sales_date', start)
      .lt('sales_date', end),
    supabase
      .from('expenses')
      .select('amount, category_id')
      .eq('store_id', storeId)
      .gte('expense_date', start)
      .lt('expense_date', end),
    supabase.from('expense_categories').select('*').order('sort_order'),
    supabase
      .from('inventory_snapshots')
      .select('amount, snapshot_date')
      .eq('store_id', storeId)
      .gte('snapshot_date', start)
      .lt('snapshot_date', end),
  ])

  // 同じ日付にAirREGI連携と手入力の両方があるときはAirREGIを優先し、二重計上を防ぐ
  const salesByDate = new Map<string, { gross_sales: number; net_sales: number; source: string }>()
  for (const r of salesRes.data ?? []) {
    const existing = salesByDate.get(r.sales_date)
    if (!existing || (r.source === 'airregi' && existing.source !== 'airregi')) {
      salesByDate.set(r.sales_date, r)
    }
  }
  const dailySales = Array.from(salesByDate.values())
  const grossSales = dailySales.reduce((sum, r) => sum + r.gross_sales, 0)
  const netSales = dailySales.reduce((sum, r) => sum + r.net_sales, 0)

  // 棚卸はその月内で最後に確定したスナップショットを使う（月末日ちょうどでなくてもよい）
  const snaps = snapshotRes.data ?? []
  const latestSnapshotDate = snaps.reduce(
    (max, r) => (r.snapshot_date > max ? r.snapshot_date : max),
    ''
  )
  const tanaoroshi = snaps
    .filter((r) => r.snapshot_date === latestSnapshotDate)
    .reduce((sum, r) => sum + r.amount, 0)

  const categories = categoriesRes.data ?? []
  const expenses = expensesRes.data ?? []
  const amountByCategory = new Map<string, number>()
  for (const e of expenses) {
    amountByCategory.set(e.category_id, (amountByCategory.get(e.category_id) ?? 0) + e.amount)
  }

  const shiire = categories
    .filter((c) => c.name === '仕入')
    .reduce((sum, c) => sum + (amountByCategory.get(c.id) ?? 0), 0)

  const totalGenka = shiire + tanaoroshi
  const grossProfit = netSales - totalGenka

  const sgaCategories = categories.filter((c) => c.group_name === '販管費')
  const sgaTotal = sgaCategories.reduce((sum, c) => sum + (amountByCategory.get(c.id) ?? 0), 0)
  const operatingProfit = grossProfit - sgaTotal

  const laborCategory = sgaCategories.find((c) => c.name === '人件費')
  const laborCost = laborCategory ? amountByCategory.get(laborCategory.id) ?? 0 : 0

  const ratio = (amount: number) => (netSales === 0 ? null : amount / netSales)

  const rows: PnlRow[] = [
    { section: '売上', label: '総売上', amount: grossSales, ratio: null },
    { section: '売上', label: '税抜き売上(1)', amount: netSales, ratio: netSales === 0 ? null : 1 },
    { section: '売上原価', label: '仕入', amount: shiire, ratio: ratio(shiire) },
    { section: '売上原価', label: '棚卸', amount: tanaoroshi, ratio: ratio(tanaoroshi) },
    { section: '売上原価', label: 'TOTAL原価(2)', amount: totalGenka, ratio: ratio(totalGenka), bold: true },
    { section: '売上総利益', label: '売上総利益(3)=(1)-(2)', amount: grossProfit, ratio: ratio(grossProfit), bold: true },
    ...sgaCategories.map((c) => ({
      section: '販売費・一般管理費',
      label: c.name,
      amount: amountByCategory.get(c.id) ?? 0,
      ratio: ratio(amountByCategory.get(c.id) ?? 0),
    })),
    {
      section: '販売費・一般管理費',
      label: '販売費・一般管理費合計(4)',
      amount: sgaTotal,
      ratio: ratio(sgaTotal),
      bold: true,
    },
    {
      section: '営業利益',
      label: '営業利益(5)=(3)-(4)',
      amount: operatingProfit,
      ratio: ratio(operatingProfit),
      bold: true,
    },
    {
      section: '労働分配率',
      label: '人件費÷売上総利益×100%',
      amount: null,
      ratio: grossProfit === 0 ? null : laborCost / grossProfit,
    },
  ]

  return rows
}
