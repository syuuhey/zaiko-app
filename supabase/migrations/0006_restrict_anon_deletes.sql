-- 削除操作の権限を制限する（いたずら・事故対策）。
-- URLを知っていれば誰でも商品マスタや廃棄履歴を全削除できる状態を解消する。
-- ※このファイルは何度実行しても安全（冪等）です。

-- items: 削除は店長ログイン後のみ（在庫数の編集・商品追加は今まで通りログイン不要）
drop policy if exists "anyone can delete items" on items;
drop policy if exists "managers can delete items" on items;
create policy "managers can delete items"
  on items for delete to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

-- donut_types: 削除は店長のみ（削除するとその種類の廃棄履歴も連動して消えるため）
drop policy if exists "anyone can delete donut_types" on donut_types;
drop policy if exists "managers can delete donut_types" on donut_types;
create policy "managers can delete donut_types"
  on donut_types for delete to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

-- waste_logs: 「当日の記録を保存し直す」スタッフの通常操作に削除が必要なため、
-- 直近48時間の行のみ削除可とし、過去の廃棄履歴の一括削除はできないようにする
drop policy if exists "anyone can delete waste_logs" on waste_logs;
drop policy if exists "anyone can delete recent waste_logs" on waste_logs;
create policy "anyone can delete recent waste_logs"
  on waste_logs for delete to anon, authenticated
  using (wasted_at > now() - interval '48 hours');
