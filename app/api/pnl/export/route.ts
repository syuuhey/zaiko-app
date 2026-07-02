import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getCurrentManager, getSupabaseServerClient } from '@/lib/supabase-server'
import { getStores } from '@/lib/stores-server'
import { computePnl } from '@/lib/pnl'

export async function GET(request: NextRequest) {
  const manager = await getCurrentManager()
  if (!manager) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const storeSlug = searchParams.get('store')
  const month = searchParams.get('month')
  if (!month) {
    return NextResponse.json({ error: 'month is required' }, { status: 400 })
  }

  const stores = await getStores()
  const store = stores.find((s) => s.slug === storeSlug) ?? stores[0]
  if (!store) {
    return NextResponse.json({ error: 'store not found' }, { status: 404 })
  }

  const supabase = await getSupabaseServerClient()
  const rows = await computePnl(supabase, store.id, month)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(`損益計算書_${month}`)

  sheet.columns = [
    { header: '区分', key: 'section', width: 20 },
    { header: '項目', key: 'label', width: 30 },
    { header: '金額', key: 'amount', width: 16 },
    { header: '比率', key: 'ratio', width: 12 },
  ]

  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
  })

  rows.forEach((row) => {
    const r = sheet.addRow({
      section: row.section,
      label: row.label,
      amount: row.amount,
      ratio: row.ratio,
    })
    r.getCell('amount').numFmt = '#,##0'
    r.getCell('ratio').numFmt = '0.00%'
    if (row.bold) {
      r.font = { bold: true }
      r.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
      })
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = encodeURIComponent(`損益計算書_${store.name}_${month}.xlsx`)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pnl.xlsx"; filename*=UTF-8''${filename}`,
    },
  })
}
