'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentManager, getSupabaseServerClient } from '@/lib/supabase-server'

async function requireManager() {
  const current = await getCurrentManager()
  if (!current) redirect('/login')
  return current.manager
}

function readQuantity(formData: FormData, minimum: number) {
  const input = formData.get('quantity')
  if (typeof input !== 'string' || !/^[0-9]+$/.test(input)) return null
  const quantity = Number(input)
  return quantity >= minimum && quantity <= 2_147_483_647 ? quantity : null
}

function readActor(displayName: string | null, formData: FormData) {
  const input = formData.get('actor')
  return displayName?.trim() || (typeof input === 'string' ? input.trim() : '')
}

export async function recordOrder(storeId: string, _state: string | null, formData: FormData) {
  const manager = await requireManager()
  const actor = readActor(manager.display_name, formData)
  const quantity = readQuantity(formData, 1)
  const itemId = formData.get('item_id')
  if (!actor) return '発注者名を入力してください。'
  if (quantity === null) return '発注数には1以上の整数を入力してください。'
  if (typeof itemId !== 'string' || !itemId) return '商品を選択してください。'

  const supabase = await getSupabaseServerClient()
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id, supplier')
    .eq('id', itemId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (itemError || !item) return 'この店舗の商品を取得できませんでした。'

  const { error } = await supabase.from('purchase_orders').insert({
    store_id: storeId,
    item_id: item.id,
    supplier: item.supplier ?? '',
    quantity,
    ordered_by: actor,
  })

  if (error?.code === '23505') return 'この商品にはすでに未入荷の発注があります。'
  if (error) return '発注を記録できませんでした。'

  revalidatePath('/dashboard/orders')
  return null
}

export async function receiveOrder(orderId: string, _state: string | null, formData: FormData) {
  const manager = await requireManager()
  const actor = readActor(manager.display_name, formData)
  const quantity = readQuantity(formData, 0)
  if (!actor) return '入荷担当者名を入力してください。'
  if (quantity === null) return '入荷数には0以上の整数を入力してください。'

  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.rpc('receive_purchase_order', {
    p_order_id: orderId,
    p_received_quantity: quantity,
    p_checked_by: actor,
  })

  if (error) return '入荷を記録できませんでした。発注の状態と入荷数を確認してください。'

  revalidatePath('/dashboard/orders')
  return null
}

export async function cancelOrder(orderId: string) {
  await requireManager()
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase
    .from('purchase_orders')
    .update({ status: '取消' })
    .eq('id', orderId)
    .eq('status', '発注済')
    .select('id')
    .maybeSingle()

  if (error || !data) return '発注を取り消せませんでした。発注の状態を確認してください。'

  revalidatePath('/dashboard/orders')
  return null
}
