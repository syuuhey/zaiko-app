import { NextRequest, NextResponse } from 'next/server'
import { getLineClient } from '@/lib/line'
import { getSupabaseServiceClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Vercel Cron（毎朝9時JST）から呼ばれる低在庫アラート。
// 店舗ごとに発注点を下回った商品をまとめ、notification_recipientsの全員にLINE push通知する。
export async function GET(request: NextRequest) {
  // Vercel CronはCRON_SECRET設定時にAuthorizationヘッダを付けてくる
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const supabase = getSupabaseServiceClient()

  const [{ data: stores }, { data: items }, { data: recipients }] = await Promise.all([
    supabase.from('stores').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('items').select('name, stock, min_stock, unit, store_id').gt('min_stock', 0),
    supabase.from('notification_recipients').select('line_user_id').eq('is_active', true),
  ])

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no recipients' })
  }

  const lines: string[] = []
  for (const store of stores ?? []) {
    const lowStock = (items ?? []).filter(
      (i) => i.store_id === store.id && i.stock <= i.min_stock
    )
    if (lowStock.length === 0) continue
    lines.push(`【${store.name}】`)
    for (const i of lowStock) {
      lines.push(`・${i.name}: 残${i.stock}${i.unit}（発注点 ${i.min_stock}${i.unit}）`)
    }
    lines.push('')
  }

  if (lines.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no low stock' })
  }

  const text = `🔔 発注が必要な在庫があります\n\n${lines.join('\n').trim()}`

  let sent = 0
  for (const r of recipients) {
    try {
      await getLineClient().pushMessage({
        to: r.line_user_id,
        messages: [{ type: 'text', text }],
      })
      sent++
    } catch (e) {
      console.error(`push failed for ${r.line_user_id}:`, e)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
