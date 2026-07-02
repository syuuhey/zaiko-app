-- 店舗テーブルの新設と既存テーブルへの店舗スコープ追加
-- ※このファイルは何度実行しても安全（冪等）です。前回途中まで実行されていても、
--   このまま再実行すれば正しい状態に収束します。

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

insert into stores (name, slug, sort_order) values
  ('アイスタベタイ/DONUT TABETAI', 'aisu-donut', 1),
  ('what''s?', 'whats', 2)
on conflict (slug) do nothing;

-- items: sort_order バグ修正（本番には存在するがschema.sqlに未反映だった列）＋ store_id 追加
alter table items add column if not exists sort_order integer;
alter table items add column if not exists store_id uuid references stores(id);

alter table stock_logs  add column if not exists store_id uuid references stores(id);
alter table donut_types add column if not exists store_id uuid references stores(id);
alter table waste_logs  add column if not exists store_id uuid references stores(id);

-- 既存データは全て「アイスタベタイ/DONUT TABETAI」に紐付け直す（無条件で上書き。
-- 過去に途中まで実行され古いstore_idが残っている場合でも正しい値に収束させるため）
update items set store_id = (select id from stores where slug = 'aisu-donut');
update stock_logs set store_id = (
  select i.store_id from items i where i.id = stock_logs.item_id
);
update donut_types set store_id = (select id from stores where slug = 'aisu-donut');
update waste_logs set store_id = (
  select dt.store_id from donut_types dt where dt.id = waste_logs.donut_type_id
);

alter table items       alter column store_id set not null;
alter table stock_logs  alter column store_id set not null;
alter table donut_types alter column store_id set not null;
alter table waste_logs  alter column store_id set not null;

create index if not exists items_store_idx on items(store_id);
create index if not exists stock_logs_store_idx on stock_logs(store_id);
create index if not exists donut_types_store_idx on donut_types(store_id);
create index if not exists waste_logs_store_idx on waste_logs(store_id);
