-- 全テーブルRLS有効化。
-- 在庫・廃棄まわりはスタッフがログイン不要で使う現行仕様を維持（無条件許可ポリシー）。
-- 財務系テーブルは store_managers に登録された authenticated ユーザーのみアクセス可。
-- notification_recipients は anon/authenticated 向けポリシーを作らず、service role専用（サーバーのみ）にする。
-- ※このファイルは何度実行しても安全（冪等）です。既存ポリシーは一旦削除してから作り直します。

-- stores: 誰でも閲覧可（店舗名一覧はスタッフ画面のタブ切り替えでも必要）
alter table stores enable row level security;
drop policy if exists "anyone can read stores" on stores;
create policy "anyone can read stores" on stores for select to anon, authenticated using (true);

-- items
alter table items enable row level security;
drop policy if exists "anyone can read items" on items;
drop policy if exists "anyone can insert items" on items;
drop policy if exists "anyone can update items" on items;
drop policy if exists "anyone can delete items" on items;
create policy "anyone can read items" on items for select to anon, authenticated using (true);
create policy "anyone can insert items" on items for insert to anon, authenticated with check (true);
create policy "anyone can update items" on items for update to anon, authenticated using (true);
create policy "anyone can delete items" on items for delete to anon, authenticated using (true);

-- stock_logs（現行アプリは select/insert のみ使用、update/delete のUIは無い）
alter table stock_logs enable row level security;
drop policy if exists "anyone can read stock_logs" on stock_logs;
drop policy if exists "anyone can insert stock_logs" on stock_logs;
create policy "anyone can read stock_logs" on stock_logs for select to anon, authenticated using (true);
create policy "anyone can insert stock_logs" on stock_logs for insert to anon, authenticated with check (true);

-- donut_types
alter table donut_types enable row level security;
drop policy if exists "anyone can read donut_types" on donut_types;
drop policy if exists "anyone can insert donut_types" on donut_types;
drop policy if exists "anyone can delete donut_types" on donut_types;
create policy "anyone can read donut_types" on donut_types for select to anon, authenticated using (true);
create policy "anyone can insert donut_types" on donut_types for insert to anon, authenticated with check (true);
create policy "anyone can delete donut_types" on donut_types for delete to anon, authenticated using (true);

-- waste_logs
alter table waste_logs enable row level security;
drop policy if exists "anyone can read waste_logs" on waste_logs;
drop policy if exists "anyone can insert waste_logs" on waste_logs;
drop policy if exists "anyone can delete waste_logs" on waste_logs;
create policy "anyone can read waste_logs" on waste_logs for select to anon, authenticated using (true);
create policy "anyone can insert waste_logs" on waste_logs for insert to anon, authenticated with check (true);
create policy "anyone can delete waste_logs" on waste_logs for delete to anon, authenticated using (true);

-- expense_categories: 店長のみ閲覧（デフォルト非公開、将来スタッフに見せたくなったらポリシー追加）
alter table expense_categories enable row level security;
drop policy if exists "managers can read expense_categories" on expense_categories;
create policy "managers can read expense_categories"
  on expense_categories for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

-- expenses: 店長のみ read/write
alter table expenses enable row level security;
drop policy if exists "managers can read expenses" on expenses;
drop policy if exists "managers can insert expenses" on expenses;
drop policy if exists "managers can update expenses" on expenses;
drop policy if exists "managers can delete expenses" on expenses;
create policy "managers can read expenses"
  on expenses for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert expenses"
  on expenses for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can update expenses"
  on expenses for update to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can delete expenses"
  on expenses for delete to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

-- inventory_snapshots: 店長のみ read/write
alter table inventory_snapshots enable row level security;
drop policy if exists "managers can read inventory_snapshots" on inventory_snapshots;
drop policy if exists "managers can insert inventory_snapshots" on inventory_snapshots;
create policy "managers can read inventory_snapshots"
  on inventory_snapshots for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert inventory_snapshots"
  on inventory_snapshots for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));

-- sales_daily: 店長のみ read/write（フェーズ1は手動入力、フェーズ3でsource='airregi'をサーバーがinsert）
alter table sales_daily enable row level security;
drop policy if exists "managers can read sales_daily" on sales_daily;
drop policy if exists "managers can insert sales_daily" on sales_daily;
drop policy if exists "managers can update sales_daily" on sales_daily;
create policy "managers can read sales_daily"
  on sales_daily for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert sales_daily"
  on sales_daily for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can update sales_daily"
  on sales_daily for update to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

-- register_closings: 店長のみ read/write
alter table register_closings enable row level security;
drop policy if exists "managers can read register_closings" on register_closings;
drop policy if exists "managers can insert register_closings" on register_closings;
create policy "managers can read register_closings"
  on register_closings for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert register_closings"
  on register_closings for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));

-- store_managers: 自分の行のみ read
alter table store_managers enable row level security;
drop policy if exists "managers can read own row" on store_managers;
create policy "managers can read own row"
  on store_managers for select to authenticated
  using (user_id = auth.uid());

-- notification_recipients: RLS有効化のみ。ポリシーを一切作らないため
-- anon/authenticatedからは完全にアクセス不可（service roleキーはRLSをバイパスするためサーバー側のみ操作可能）。
alter table notification_recipients enable row level security;
