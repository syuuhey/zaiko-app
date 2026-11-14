import { redirect } from 'next/navigation'
import { getCurrentManager, getSupabaseServerClient } from '@/lib/supabase-server'
import { getStores } from '@/lib/stores-server'
import type { Item } from '@/lib/supabase'
import MonthStoreNav from '@/app/dashboard/components/MonthStoreNav'
import { cancelOrder, receiveOrder, recordOrder } from './actions'
import { OrderForm, QuantityField } from './forms'

type OrderItem = Pick<Item, 'id' | 'name' | 'unit' | 'stock' | 'min_stock' | 'ideal_stock' | 'supplier'>
type Order = {
  id: string
  item_id: string
  supplier: string
  quantity: number
  received_quantity: number | null
  status: '発注済' | '入荷済' | '取消'
  ordered_by: string
  ordered_at: string
  received_at: string | null
  items: Pick<Item, 'name' | 'unit'> | null
}

const dateTime = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Tokyo',
})
const panel = 'rounded-2xl border border-neutral-200 bg-white p-4'
const field = 'mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900'

function ActorField({ name, label }: { name: string; label: string }) {
  if (name) return null
  return (
    <label className="text-xs text-neutral-600">
      {label}
      <input name="actor" required className={field} />
    </label>
  )
}

export default async function OrdersPage({ searchParams }: {
  searchParams: Promise<{ store?: string }>
}) {
  const current = await getCurrentManager()
  if (!current) redirect('/login')

  const [params, stores, supabase] = await Promise.all([
    searchParams,
    getStores(),
    getSupabaseServerClient(),
  ])
  const store = stores.find((entry) => entry.slug === params.store) ?? stores[0]
  if (!store) return <p>店舗が登録されていません</p>

  const orderRows = () => supabase.from('purchase_orders')
    .select('id, item_id, supplier, quantity, received_quantity, status, ordered_by, ordered_at, received_at, items(name, unit)')
    .eq('store_id', store.id)
    .order('ordered_at', { ascending: false })

  const [items, openOrders, history] = await Promise.all([
    supabase.from('items')
      .select('id, name, unit, stock, min_stock, ideal_stock, supplier')
      .eq('store_id', store.id)
      .order('name')
      .returns<OrderItem[]>(),
    orderRows().eq('status', '発注済').returns<Order[]>(),
    orderRows().neq('status', '発注済').returns<Order[]>(),
  ])

  if (items.error || openOrders.error || history.error) {
    return (
      <>
        <MonthStoreNav stores={stores} storeSlug={store.slug} />
        <p role="alert" className="text-sm text-red-700">発注データを取得できませんでした。</p>
      </>
    )
  }

  const openItemIds = new Set(openOrders.data.map((order) => order.item_id))
  const orderableItems = items.data.filter((item) => !openItemIds.has(item.id))
  const candidates = new Map<string, OrderItem[]>()

  for (const item of orderableItems) {
    if (item.min_stock <= 0 || item.stock > item.min_stock) continue
    const supplier = item.supplier?.trim() || ''
    const group = candidates.get(supplier) ?? []
    group.push(item)
    candidates.set(supplier, group)
  }

  const actor = current.manager.display_name?.trim() ?? ''
  const placeOrder = recordOrder.bind(null, store.id)

  return (
    <>
      <h2 className="text-lg font-bold text-neutral-900">発注</h2>
      <MonthStoreNav stores={stores} storeSlug={store.slug} />

      <section className={panel + ' space-y-4'}>
        <h3 className="font-bold text-neutral-800">発注候補</h3>
        {candidates.size === 0 && <p className="text-sm text-neutral-500">発注候補はありません</p>}
        {Array.from(candidates, ([supplier, group]) => (
          <div key={supplier}>
            <h4 className="text-sm font-medium text-neutral-600">{supplier || '仕入先未設定'}</h4>
            {group.map((item) => (
              <div key={item.id} className="space-y-2 border-t border-neutral-100 py-3">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-neutral-500">在庫 {item.stock} {item.unit} / 発注点 {item.min_stock} {item.unit}</p>
                <OrderForm action={placeOrder} label="発注済にする">
                  <input type="hidden" name="item_id" value={item.id} />
                  <QuantityField label="発注数" initialQuantity={item.ideal_stock === 0
                    ? undefined
                    : Math.max(item.ideal_stock - item.stock, 0)} />
                  <ActorField name={actor} label="発注者" />
                </OrderForm>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section key={store.id} className={panel + ' space-y-3'}>
        <h3 className="font-bold text-neutral-800">手動で追加</h3>
        {orderableItems.length > 0 ? (
          <OrderForm action={placeOrder} label="発注済にする">
            <label className="text-xs text-neutral-600">
              商品
              <select name="item_id" required defaultValue="" className={field}>
                <option value="" disabled>商品を選択</option>
                {orderableItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <QuantityField label="発注数" />
            <ActorField name={actor} label="発注者" />
          </OrderForm>
        ) : <p className="text-sm text-neutral-500">追加できる商品はありません</p>}
      </section>

      <section className={panel + ' space-y-3'}>
        <h3 className="font-bold text-neutral-800">未入荷</h3>
        {openOrders.data.length === 0 && <p className="text-sm text-neutral-500">未入荷の発注はありません</p>}
        {openOrders.data.map((order) => (
          <article key={order.id} className="space-y-2 border-t border-neutral-100 pt-3">
            <p className="font-medium">{order.items?.name ?? '商品名不明'} <span className="text-xs text-neutral-500">{order.status}</span></p>
            <p className="text-sm text-neutral-500">
              {order.supplier.trim() || '仕入先未設定'} · 発注 {order.quantity} {order.items?.unit} · {dateTime.format(new Date(order.ordered_at))} · {order.ordered_by}
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <OrderForm action={receiveOrder.bind(null, order.id)} label="入荷済にする">
                <QuantityField label="入荷数" initialQuantity={order.quantity} />
                <ActorField name={actor} label="入荷担当者" />
              </OrderForm>
              <OrderForm action={cancelOrder.bind(null, order.id)} label="取消" confirmation="この発注を取り消しますか？" />
            </div>
          </article>
        ))}
      </section>

      <section className={panel + ' space-y-3'}>
        <h3 className="font-bold text-neutral-800">発注履歴</h3>
        {history.data.length === 0 && <p className="text-sm text-neutral-500">入荷済・取消の発注はありません</p>}
        {history.data.map((order) => (
          <article key={order.id} className="space-y-1 border-t border-neutral-100 pt-3">
            <p className="font-medium">{order.items?.name ?? '商品名不明'} <span className="text-xs text-neutral-500">{order.status}</span></p>
            <p className="text-sm text-neutral-500">
              {order.supplier.trim() || '仕入先未設定'} · 発注 {order.quantity} {order.items?.unit} · {dateTime.format(new Date(order.ordered_at))} · {order.ordered_by}
            </p>
            {order.received_at && (
              <p className="text-sm text-neutral-500">入荷 {order.received_quantity} {order.items?.unit} · {dateTime.format(new Date(order.received_at))}</p>
            )}
          </article>
        ))}
      </section>
    </>
  )
}
