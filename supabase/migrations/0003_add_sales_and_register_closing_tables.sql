-- 売上（フェーズ3でAirREGI同期、フェーズ1は手動入力）・レジ締め報告（フェーズ3でGoogle Sheets同期）
-- ※このファイルは何度実行しても安全（冪等）です。

create table if not exists sales_daily (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  sales_date date not null,
  gross_sales integer not null default 0,
  net_sales integer not null default 0,
  source text not null default 'manual' check (source in ('manual', 'airregi')),
  raw_json jsonb,
  synced_at timestamptz default now(),
  unique (store_id, sales_date, source)
);

create index if not exists sales_daily_store_date_idx on sales_daily(store_id, sales_date);

create table if not exists register_closings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  closing_date date not null,
  opening_change integer,
  adjustment integer,
  over_short integer,
  deposit integer,
  carried_over integer,
  receipt_photo_url text,
  staff_name text default '',
  source_row_id text,
  synced_at timestamptz default now(),
  unique (store_id, closing_date, source_row_id)
);

create index if not exists register_closings_store_date_idx on register_closings(store_id, closing_date);
