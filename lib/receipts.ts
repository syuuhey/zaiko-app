import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServiceClient } from '@/lib/supabase-server'
import { getLineBlobClient } from '@/lib/line'

// レシートのデフォルト帰属店舗（LINE返信のボタンで切り替え可能）
const DEFAULT_STORE_SLUG = 'whats'

export type ReceiptResult = {
  expenseId: string
  storeName: string
  vendor: string
  date: string
  amount: number
  categoryName: string
  confident: boolean
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// LINEで受信したレシート画像を取得→Storage保存→Claudeで読み取り→expensesに登録する。
export async function processReceiptImage(
  messageId: string,
  senderDisplayName: string
): Promise<ReceiptResult> {
  const supabase = getSupabaseServiceClient()

  // 1. LINEから画像本体を取得
  const blob = await getLineBlobClient().getMessageContent(messageId)
  const chunks: Buffer[] = []
  for await (const chunk of blob) {
    chunks.push(Buffer.from(chunk))
  }
  const imageBuffer = Buffer.concat(chunks)

  // 2. 科目リストと店舗を取得
  const [{ data: categories }, { data: store }] = await Promise.all([
    supabase.from('expense_categories').select('*').order('sort_order'),
    supabase.from('stores').select('*').eq('slug', DEFAULT_STORE_SLUG).single(),
  ])
  if (!categories || categories.length === 0 || !store) {
    throw new Error('経費科目または店舗マスタが取得できませんでした')
  }
  const categoryNames = categories.map((c) => c.name)

  // 3. Claude Visionで構造化データ抽出
  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [
      {
        name: 'record_expense',
        description: 'レシートから読み取った経費情報を記録する',
        input_schema: {
          type: 'object',
          properties: {
            vendor: { type: 'string', description: '店名・取引先名。読み取れなければ空文字' },
            date: {
              type: 'string',
              description:
                'レシートに印字された日付を YYYY-MM-DD 形式で。和暦は西暦に変換（令和8年=2026年）、「26/07/01」のような2桁年は20xx年として解釈。読み取れなければ空文字',
            },
            amount: { type: 'integer', description: '合計金額（税込・円）' },
            category: {
              type: 'string',
              enum: categoryNames,
              description: [
                '最も適切な経費科目。分類ルール:',
                '・食材/材料/ドリンク/包材/商品の仕入れ → 仕入',
                '・駐車場/コインパーキング/電車/バス/タクシー/高速道路 → 旅費交通費',
                '・ガソリン/洗車/車検 → 車輌費',
                '・飲食を伴う打合せ/会食 → 交際接待費',
                '・文房具/掃除用品/雑貨 → 消耗品費',
                '・電気/ガス/水道 → 水道光熱費',
                '・どれにも当てはまらない → 雑費',
              ].join('\n'),
            },
            confidence: {
              type: 'string',
              enum: ['high', 'low'],
              description: '読み取り・分類に自信があればhigh、不鮮明・判断に迷う場合はlow',
            },
          },
          required: ['vendor', 'date', 'amount', 'category', 'confidence'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'record_expense' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBuffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'このレシートを読み取り、record_expenseツールで経費情報を記録してください。スイーツテイクアウト店の経費です。',
          },
        ],
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('レシートの読み取り結果を取得できませんでした')
  }
  const ocr = toolUse.input as {
    vendor: string
    date: string
    amount: number
    category: string
    confidence: 'high' | 'low'
  }

  // 4. 画像をStorageへ保存
  const imagePath = `${store.id}/${messageId}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(imagePath, imageBuffer, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) {
    throw new Error(`レシート画像の保存に失敗しました: ${uploadError.message}`)
  }

  // 5. 科目を決定（マッチしなければ雑費にフォールバック）
  const category =
    categories.find((c) => c.name === ocr.category) ??
    categories.find((c) => c.name === '雑費')
  if (!category) throw new Error('経費科目の決定に失敗しました')

  const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(ocr.date) ? ocr.date : todayJst()
  const isConfident = ocr.confidence === 'high' && category.name === ocr.category

  // 6. expensesに登録
  const { data: expense, error: insertError } = await supabase
    .from('expenses')
    .insert({
      store_id: store.id,
      category_id: category.id,
      vendor: ocr.vendor ?? '',
      amount: Math.max(0, Math.round(ocr.amount ?? 0)),
      expense_date: expenseDate,
      note: isConfident ? '' : '要確認（OCR自信度低）',
      receipt_image_url: imagePath,
      source: 'line_ocr',
      ocr_raw_json: ocr,
      created_by: senderDisplayName,
    })
    .select('id')
    .single()
  if (insertError || !expense) {
    throw new Error(`経費の登録に失敗しました: ${insertError?.message}`)
  }

  return {
    expenseId: expense.id,
    storeName: store.name,
    vendor: ocr.vendor ?? '',
    date: expenseDate,
    amount: Math.max(0, Math.round(ocr.amount ?? 0)),
    categoryName: category.name,
    confident: isConfident,
  }
}
