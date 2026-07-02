-- 損益計算書用: 経費科目マスタ・経費・棚卸スナップショット
-- ※このファイルは何度実行しても安全（冪等）です。

create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  group_name text not null check (group_name in ('売上原価', '販管費')),
  sort_order integer not null default 0
);

insert into expense_categories (name, group_name, sort_order) values
  ('仕入', '売上原価', 1),
  ('人件費', '販管費', 1),
  ('賞与、社員旅行積み立て', '販管費', 2),
  ('法定福利費', '販管費', 3),
  ('旅費・交通費', '販管費', 4),
  ('広告宣伝費', '販管費', 5),
  ('接待交際費', '販管費', 6),
  ('管理諸費', '販管費', 7),
  ('通信費', '販管費', 8),
  ('消耗品費', '販管費', 9),
  ('修繕費', '販管費', 10),
  ('外部委託費', '販管費', 11),
  ('減価償却費', '販管費', 12),
  ('水道光熱費', '販管費', 13),
  ('クレジット手数料', '販管費', 14),
  ('地代家賃', '販管費', 15),
  ('リース料', '販管費', 16),
  ('雑費', '販管費', 17)
on conflict (name) do nothing;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  category_id uuid not null references expense_categories(id),
  vendor text default '',
  amount integer not null check (amount >= 0),
  expense_date date not null,
  note text default '',
  receipt_image_url text,
  source text not null default 'manual' check (source in ('manual', 'line_ocr')),
  ocr_raw_json jsonb,
  created_by text default '',
  created_at timestamptz default now()
);

create index if not exists expenses_store_date_idx on expenses(store_id, expense_date);

create table if not exists inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  item_id uuid not null references items(id),
  snapshot_date date not null,
  stock integer not null,
  unit_price integer not null,
  amount integer not null,
  created_at timestamptz default now(),
  unique (store_id, item_id, snapshot_date)
);

create index if not exists inventory_snapshots_store_date_idx on inventory_snapshots(store_id, snapshot_date);
