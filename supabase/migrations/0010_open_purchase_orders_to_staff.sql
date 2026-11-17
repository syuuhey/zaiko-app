-- 発注をログイン不要にする(設計書 §5)。2026-11-17 承認。
-- 在庫(items / stock_logs)と同じ扱いにし、anon でも発注の閲覧・登録・更新・入荷ができるようにする。
-- 削除ポリシーは引き続き作らない(取消は status の更新で行い、記録を残す)。
-- ※このファイルは何度実行しても安全（冪等）です。テーブルとデータは変更しません。

drop policy if exists "managers can read purchase_orders" on purchase_orders;
drop policy if exists "managers can insert purchase_orders" on purchase_orders;
drop policy if exists "managers can update purchase_orders" on purchase_orders;
drop policy if exists "anyone can read purchase_orders" on purchase_orders;
drop policy if exists "anyone can insert purchase_orders" on purchase_orders;
drop policy if exists "anyone can update purchase_orders" on purchase_orders;

create policy "anyone can read purchase_orders"
  on purchase_orders for select to anon, authenticated using (true);
create policy "anyone can insert purchase_orders"
  on purchase_orders for insert to anon, authenticated with check (true);
create policy "anyone can update purchase_orders"
  on purchase_orders for update to anon, authenticated using (true) with check (true);

-- 入荷処理(発注を入荷済に更新 → 在庫を加算 → 履歴に記録)を anon からも呼べるようにする
grant execute on function receive_purchase_order(uuid, integer, text) to anon;
