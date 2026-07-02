import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { validateSignature, webhook } from '@line/bot-sdk'
import { getLineClient, getLineConfig } from '@/lib/line'
import { processReceiptImage } from '@/lib/receipts'
import { getSupabaseServiceClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// LINEのWebhook。即座に200を返し、重い処理（OCR等）はafter()で非同期に行う。
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''

  if (!validateSignature(body, getLineConfig().channelSecret, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const events = (JSON.parse(body) as webhook.CallbackRequest).events ?? []

  after(async () => {
    for (const event of events) {
      try {
        await handleEvent(event)
      } catch (e) {
        console.error('LINE webhook event error:', e)
        // 送信者に失敗を伝える（可能なら）
        const userId = event.source?.userId
        if (userId) {
          await getLineClient()
            .pushMessage({
              to: userId,
              messages: [
                {
                  type: 'text',
                  text: '処理中にエラーが発生しました。もう一度送るか、ダッシュボードから手入力してください。',
                },
              ],
            })
            .catch(() => {})
        }
      }
    }
  })

  return NextResponse.json({ ok: true })
}

async function handleEvent(event: webhook.Event) {
  // 友だち追加: 通知先として登録
  if (event.type === 'follow' && event.source?.userId) {
    await registerRecipient(event.source.userId)
    await getLineClient().pushMessage({
      to: event.source.userId,
      messages: [
        {
          type: 'text',
          text: '友だち追加ありがとうございます！\n\n📷 レシート写真を送ると、自動で読み取って経費に記録します。\n🔔 在庫が発注点を下回ると、毎朝このトークでお知らせします。',
        },
      ],
    })
    return
  }

  if (event.type === 'message' && event.source?.userId) {
    const userId = event.source.userId

    // レシート画像
    if (event.message.type === 'image') {
      const profile = await getLineClient()
        .getProfile(userId)
        .catch(() => null)
      const result = await processReceiptImage(
        event.message.id,
        profile?.displayName ?? 'LINE'
      )

      const summary = [
        result.confident ? '✅ 経費に記録しました' : '⚠️ 記録しましたが自信がありません。ダッシュボードで確認してください',
        `店舗: ${result.storeName}`,
        `日付: ${result.date}`,
        `金額: ¥${result.amount.toLocaleString('ja-JP')}`,
        `科目: ${result.categoryName}`,
        result.vendor ? `取引先: ${result.vendor}` : null,
        '',
        '店舗が違う場合は下のボタンで変更できます。',
      ]
        .filter((line) => line !== null)
        .join('\n')

      const supabase = getSupabaseServiceClient()
      const { data: stores } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      await getLineClient().pushMessage({
        to: userId,
        messages: [
          {
            type: 'text',
            text: summary,
            quickReply: {
              items: (stores ?? []).map((s) => ({
                type: 'action' as const,
                action: {
                  type: 'postback' as const,
                  label: `→ ${s.name}`.slice(0, 20),
                  data: `action=set_store&expense=${result.expenseId}&store=${s.id}`,
                  displayText: `店舗を${s.name}に変更`,
                },
              })),
            },
          },
        ],
      })
      return
    }

    // テキストメッセージには使い方を返す
    if (event.message.type === 'text') {
      await registerRecipient(userId)
      await getLineClient().pushMessage({
        to: userId,
        messages: [
          {
            type: 'text',
            text: '📷 レシート写真を送ると、自動で読み取って経費に記録します。',
          },
        ],
      })
      return
    }
  }

  // 店舗切り替えボタン
  if (event.type === 'postback' && event.source?.userId) {
    const params = new URLSearchParams(event.postback.data)
    if (params.get('action') === 'set_store') {
      const expenseId = params.get('expense')
      const storeId = params.get('store')
      if (!expenseId || !storeId) return

      const supabase = getSupabaseServiceClient()
      const [{ error }, { data: store }] = await Promise.all([
        supabase.from('expenses').update({ store_id: storeId }).eq('id', expenseId),
        supabase.from('stores').select('name').eq('id', storeId).single(),
      ])

      await getLineClient().pushMessage({
        to: event.source.userId,
        messages: [
          {
            type: 'text',
            text: error
              ? '店舗の変更に失敗しました。ダッシュボードから修正してください。'
              : `店舗を「${store?.name ?? ''}」に変更しました。`,
          },
        ],
      })
    }
  }
}

async function registerRecipient(lineUserId: string) {
  const supabase = getSupabaseServiceClient()
  const profile = await getLineClient()
    .getProfile(lineUserId)
    .catch(() => null)
  await supabase.from('notification_recipients').upsert(
    {
      line_user_id: lineUserId,
      display_name: profile?.displayName ?? '',
      is_active: true,
    },
    { onConflict: 'line_user_id' }
  )
}
