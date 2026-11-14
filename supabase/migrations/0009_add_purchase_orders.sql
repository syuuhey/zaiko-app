-- 発注の記録と状態管理(設計書 §3 / §6)。2026-11-14 承認。
-- ※このファイルは何度実行しても安全（冪等）です。既存テーブルは変更しません。

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  item_id uuid not null references items(id),
  supplier text not null default '',
  quantity integer not null check (quantity > 0),
  received_quantity integer check (received_quantity >= 0),
  status text not null default '発注済' check (status in ('発注済', '入荷済', '取消')),
  ordered_by text not null default '',
  ordered_at timestamptz not null default now(),
  received_at timestamptz,
  note text not null default ''
);

create index if not exists purchase_orders_store_status_idx on purchase_orders(store_id, status);

-- 同じ商品に未入荷の発注は1件まで（二重発注防止）
create unique index if not exists purchase_orders_open_item_idx
  on purchase_orders(item_id) where status = '発注済';

-- RLS: 財務系と同じく store_managers に登録された authenticated のみ。anon には何も許可しない。
-- 削除ポリシーは作らない（取消は status の更新で行い、記録を残す）。
alter table purchase_orders enable row level security;
drop policy if exists "managers can read purchase_orders" on purchase_orders;
drop policy if exists "managers can insert purchase_orders" on purchase_orders;
drop policy if exists "managers can update purchase_orders" on purchase_orders;
create policy "managers can read purchase_orders"
  on purchase_orders for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert purchase_orders"
  on purchase_orders for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can update purchase_orders"
  on purchase_orders for update to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()))
  with check (exists (select 1 from store_managers where user_id = auth.uid()));

-- 入荷処理: 発注を入荷済に更新 → 在庫を加算 → 履歴に記録、を1トランザクションで行う。
-- security invoker（既定）なので、呼び出した人のRLSがそのまま効く（店長以外は発注行が見えず失敗する）。
create or replace function receive_purchase_order(
  p_order_id uuid,
  p_received_quantity integer,
  p_checked_by text
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_order purchase_orders%rowtype;
  v_stock integer;
begin
  if p_received_quantity is null or p_received_quantity < 0 then
    raise exception '入荷数が不正です';
  end if;

  select * into v_order from purchase_orders where id = p_order_id for update;
  if not found then
    raise exception '発注が見つかりません';
  end if;
  if v_order.status <> '発注済' then
    raise exception 'この発注は既に%です', v_order.status;
  end if;

  select stock into v_stock from items where id = v_order.item_id for update;
  if not found then
    raise exception '商品が見つかりません';
  end if;

  update purchase_orders
    set status = '入荷済', received_quantity = p_received_quantity, received_at = now()
    where id = p_order_id;

  update items set stock = v_stock + p_received_quantity where id = v_order.item_id;

  insert into stock_logs (item_id, checked_by, stock_before, stock_after, note, store_id)
    values (v_order.item_id, coalesce(p_checked_by, ''), v_stock, v_stock + p_received_quantity, '入荷', v_order.store_id);
end;
$$;

revoke all on function receive_purchase_order(uuid, integer, text) from public, anon;
grant execute on function receive_purchase_order(uuid, integer, text) to authenticated;

-- スタッフ画面の「発注済」バッジ用。発注中の item_id だけを返す（数量・仕入先・金額は返さない）。
-- anon は purchase_orders を読めないため security definer にする。
create or replace function open_order_item_ids(p_store_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select item_id from purchase_orders where store_id = p_store_id and status = '発注済';
$$;

revoke all on function open_order_item_ids(uuid) from public;
grant execute on function open_order_item_ids(uuid) to anon, authenticated;
