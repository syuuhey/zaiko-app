import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// レジ締め報告Googleフォームの送信時に、スプレッドシートのApps Scriptから呼ばれる受け口。
// 認証は REGISTER_SYNC_SECRET の共有シークレット（x-sync-secretヘッダ）で行う。

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null
  // 「なし」「無し」「ナシ」は0円の意味で入力される運用
  if (/^(なし|無し|ナシ|無)$/.test(String(value).trim())) return 0
  let s = String(value)
    // 全角数字・全角記号を半角に変換
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[＋]/g, '+')
    .replace(/[−ー－]/g, '-')
    // ▲500 / △500 はマイナス表記
    .replace(/^[▲△]\s*/, '-')
    .replace(/[¥￥,，円\s]/g, '')
  if (s === '' || s === '-' || s === '+') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}

function parseDate(value: unknown): string | null {
  const s = String(value ?? '').trim()
  // "2026/07/02", "2026-07-02", "2026/7/2" などを YYYY-MM-DD に正規化
  const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  // スプレッドシートのセルをそのまま読むと "Tue Jun 30 2026 00:00:00 GMT+0900 ..." 形式で来る。
  // JST基準の日付に変換する（UTC変換すると前日にズレるため+9時間して切り出す）
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }
  return null
}

export async function POST(request: NextRequest) {
  const secret = process.env.REGISTER_SYNC_SECRET
  if (!secret || request.headers.get('x-sync-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const closingDate = parseDate(body.date)
  const storeName = String(body.store ?? '').trim()
  const rowId = String(body.row_id ?? '').trim()
  if (!closingDate || !storeName || !rowId) {
    return NextResponse.json(
      { error: 'date, store, row_id は必須です', received: { date: body.date, store: body.store, row_id: body.row_id } },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServiceClient()

  // フォームの店舗選択肢とstoresテーブルを名前で突き合わせる（前方一致も許容）
  const { data: stores } = await supabase.from('stores').select('*')
  const store = (stores ?? []).find(
    (s) => s.name === storeName || storeName.startsWith(s.name) || s.name.startsWith(storeName)
  )
  if (!store) {
    return NextResponse.json({ error: `店舗が見つかりません: ${storeName}` }, { status: 400 })
  }

  const { error } = await supabase.from('register_closings').upsert(
    {
      store_id: store.id,
      closing_date: closingDate,
      opening_change: parseAmount(body.opening_change),
      adjustment: parseAmount(body.adjustment),
      over_short: parseAmount(body.over_short),
      deposit: parseAmount(body.deposit),
      carried_over: parseAmount(body.carried_over),
      receipt_photo_url: body.receipt_photo_url ? String(body.receipt_photo_url) : null,
      staff_name: String(body.staff_name ?? ''),
      source_row_id: rowId,
    },
    { onConflict: 'store_id,closing_date,source_row_id' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, store: store.name, date: closingDate })
}
