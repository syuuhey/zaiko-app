'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function addExpense(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  await supabase.from('expenses').insert({
    store_id: String(formData.get('store_id')),
    category_id: String(formData.get('category_id')),
    vendor: String(formData.get('vendor') ?? ''),
    amount: Number(formData.get('amount')) || 0,
    expense_date: String(formData.get('expense_date')),
    note: String(formData.get('note') ?? ''),
    source: 'manual',
  })
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/pnl')
}

export async function updateExpense(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  await supabase
    .from('expenses')
    .update({
      category_id: String(formData.get('category_id')),
      vendor: String(formData.get('vendor') ?? ''),
      amount: Number(formData.get('amount')) || 0,
      expense_date: String(formData.get('expense_date')),
      note: String(formData.get('note') ?? ''),
    })
    .eq('id', String(formData.get('id')))
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/pnl')
  revalidatePath('/dashboard')
}

export async function deleteExpense(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  await supabase.from('expenses').delete().eq('id', String(formData.get('id')))
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/pnl')
  revalidatePath('/dashboard')
}

export async function addSales(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  await supabase.from('sales_daily').upsert(
    {
      store_id: String(formData.get('store_id')),
      sales_date: String(formData.get('sales_date')),
      gross_sales: Number(formData.get('gross_sales')) || 0,
      net_sales: Number(formData.get('net_sales')) || 0,
      source: 'manual',
    },
    { onConflict: 'store_id,sales_date,source' }
  )
  revalidatePath('/dashboard/sales')
  revalidatePath('/dashboard/pnl')
}

// AirレジからダウンロードしたCSV（売上集計、Shift_JIS）を取り込む。
// 税抜き売上はCSVに含まれないため、指定された税率から逆算する。
export async function importSalesCsv(formData: FormData) {
  const file = formData.get('file')
  const storeId = String(formData.get('store_id'))
  const taxRate = Number(formData.get('tax_rate')) || 0.08
  if (!(file instanceof File) || !storeId) return

  const buffer = Buffer.from(await file.arrayBuffer())
  let text = new TextDecoder('shift_jis').decode(buffer)
  if (!text.includes('集計期間')) {
    text = new TextDecoder('utf-8').decode(buffer)
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const header = lines[0]?.split(',') ?? []
  const dateIdx = header.findIndex((h) => h.includes('集計期間'))
  const salesIdx = header.findIndex((h) => h.trim() === '売上')
  if (dateIdx === -1 || salesIdx === -1) return

  const rows = lines
    .slice(1)
    .map((line) => {
      const cols = line.split(',')
      const raw = cols[dateIdx]?.trim() ?? ''
      const gross = Number(cols[salesIdx]) || 0
      if (!/^\d{8}$/.test(raw)) return null
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
      return {
        store_id: storeId,
        sales_date: date,
        gross_sales: gross,
        net_sales: Math.round(gross / (1 + taxRate)),
        source: 'airregi' as const,
      }
    })
    .filter((r) => r !== null)

  if (rows.length === 0) return

  const supabase = await getSupabaseServerClient()
  await supabase.from('sales_daily').upsert(rows, { onConflict: 'store_id,sales_date,source' })
  revalidatePath('/dashboard/sales')
  revalidatePath('/dashboard/pnl')
  revalidatePath('/dashboard')
}

export async function addRegisterClosing(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  await supabase.from('register_closings').insert({
    store_id: String(formData.get('store_id')),
    closing_date: String(formData.get('closing_date')),
    opening_change: Number(formData.get('opening_change')) || 0,
    adjustment: Number(formData.get('adjustment')) || 0,
    over_short: Number(formData.get('over_short')) || 0,
    deposit: Number(formData.get('deposit')) || 0,
    carried_over: Number(formData.get('carried_over')) || 0,
    staff_name: String(formData.get('staff_name') ?? ''),
    source_row_id: `manual-${Date.now()}`,
  })
  revalidatePath('/dashboard/register-closings')
}

export async function snapshotInventory(formData: FormData) {
  const storeId = String(formData.get('store_id'))
  const supabase = await getSupabaseServerClient()

  const { data: items } = await supabase
    .from('items')
    .select('id, stock, unit_price')
    .eq('store_id', storeId)

  if (!items || items.length === 0) return

  const snapshotDate = new Date().toISOString().slice(0, 10)
  const rows = items.map((i) => ({
    store_id: storeId,
    item_id: i.id,
    snapshot_date: snapshotDate,
    stock: i.stock,
    unit_price: i.unit_price,
    amount: i.stock * i.unit_price,
  }))

  await supabase.from('inventory_snapshots').upsert(rows, { onConflict: 'store_id,item_id,snapshot_date' })
  revalidatePath('/dashboard/pnl')
}
