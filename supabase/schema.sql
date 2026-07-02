-- このファイルは最終形のスキーマ・スナップショットです。
-- 実際の変更履歴・適用手順は supabase/migrations/ 配下の連番ファイルを参照してください。

-- 店舗マスタ
create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 商品マスタ
create table items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  name text not null,
  category text not null check (category in ('食料品', '備品')),
  unit text not null default '個',
  stock integer not null default 0,
  min_stock integer not null default 0,
  ideal_stock integer not null default 0,
  unit_price integer default 0,
  supplier text default '',
  note text default '',
  sort_order integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 在庫チェック履歴
create table stock_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  store_id uuid not null references stores(id),
  checked_by text not null default 'スタッフ',
  stock_before integer not null,
  stock_after integer not null,
  note text default '',
  checked_at timestamptz default now()
);

-- ドーナツ種類マスタ（在庫とは独立）
create table donut_types (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  name text not null,
  sort_order integer,
  created_at timestamptz default now()
);

-- 廃棄記録
create table waste_logs (
  id uuid primary key default gen_random_uuid(),
  donut_type_id uuid references donut_types(id) on delete cascade,
  donut_type_name text not null,
  quantity integer not null default 1,
  recorded_by text not null default 'スタッフ',
  store_id uuid not null references stores(id),
  wasted_at timestamptz default now()
);

-- 経費科目マスタ（損益計算書の行構造に対応）
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  group_name text not null check (group_name in ('売上原価', '販管費')),
  sort_order integer not null default 0
);

-- 経費（レシートOCR・手入力）
create table expenses (
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

-- 月末棚卸スナップショット
create table inventory_snapshots (
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

-- 売上日次（フェーズ3でAirREGIから同期、フェーズ1は手動入力）
create table sales_daily (
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

-- レジ締め報告（フェーズ3でGoogleスプレッドシートから同期）
create table register_closings (
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

-- 低在庫LINE通知の送信先
create table notification_recipients (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  display_name text default '',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 店長ユーザーと店舗の紐付け（store_id=null は全店舗アクセス可）
create table store_managers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid references stores(id),
  display_name text default '',
  created_at timestamptz default now()
);

-- インデックス
create index items_store_idx on items(store_id);
create index stock_logs_store_idx on stock_logs(store_id);
create index donut_types_store_idx on donut_types(store_id);
create index waste_logs_store_idx on waste_logs(store_id);
create index expenses_store_date_idx on expenses(store_id, expense_date);
create index inventory_snapshots_store_date_idx on inventory_snapshots(store_id, snapshot_date);
create index sales_daily_store_date_idx on sales_daily(store_id, sales_date);
create index register_closings_store_date_idx on register_closings(store_id, closing_date);

-- updated_at 自動更新
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger items_updated_at
before update on items
for each row execute function update_updated_at();

-- Row Level Security
alter table stores enable row level security;
create policy "anyone can read stores" on stores for select to anon, authenticated using (true);

alter table items enable row level security;
create policy "anyone can read items" on items for select to anon, authenticated using (true);
create policy "anyone can insert items" on items for insert to anon, authenticated with check (true);
create policy "anyone can update items" on items for update to anon, authenticated using (true);
create policy "managers can delete items" on items for delete to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

alter table stock_logs enable row level security;
create policy "anyone can read stock_logs" on stock_logs for select to anon, authenticated using (true);
create policy "anyone can insert stock_logs" on stock_logs for insert to anon, authenticated with check (true);

alter table donut_types enable row level security;
create policy "anyone can read donut_types" on donut_types for select to anon, authenticated using (true);
create policy "anyone can insert donut_types" on donut_types for insert to anon, authenticated with check (true);
create policy "managers can delete donut_types" on donut_types for delete to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

alter table waste_logs enable row level security;
create policy "anyone can read waste_logs" on waste_logs for select to anon, authenticated using (true);
create policy "anyone can insert waste_logs" on waste_logs for insert to anon, authenticated with check (true);
create policy "anyone can delete recent waste_logs" on waste_logs for delete to anon, authenticated
  using (wasted_at > now() - interval '48 hours');

alter table expense_categories enable row level security;
create policy "managers can read expense_categories" on expense_categories for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

alter table expenses enable row level security;
create policy "managers can read expenses" on expenses for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert expenses" on expenses for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can update expenses" on expenses for update to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can delete expenses" on expenses for delete to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

alter table inventory_snapshots enable row level security;
create policy "managers can read inventory_snapshots" on inventory_snapshots for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert inventory_snapshots" on inventory_snapshots for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));

alter table sales_daily enable row level security;
create policy "managers can read sales_daily" on sales_daily for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert sales_daily" on sales_daily for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can update sales_daily" on sales_daily for update to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));

alter table register_closings enable row level security;
create policy "managers can read register_closings" on register_closings for select to authenticated
  using (exists (select 1 from store_managers where user_id = auth.uid()));
create policy "managers can insert register_closings" on register_closings for insert to authenticated
  with check (exists (select 1 from store_managers where user_id = auth.uid()));

alter table store_managers enable row level security;
create policy "managers can read own row" on store_managers for select to authenticated
  using (user_id = auth.uid());

-- notification_recipients はポリシーを作らない（service roleキー経由のサーバー処理専用）
alter table notification_recipients enable row level security;

-- シードデータ: 店舗
insert into stores (name, slug, sort_order) values
  ('アイスタベタイ/DONUT TABETAI', 'aisu-donut', 1),
  ('what''s?', 'whats', 2);

-- シードデータ: 経費科目（損益計算書の行と対応）
insert into expense_categories (name, group_name, sort_order) values
  ('仕入', '売上原価', 1),
  ('広告宣伝費', '販管費', 1),
  ('サービス費', '販管費', 2),
  ('販売手数料', '販管費', 3),
  ('役員報酬', '販管費', 4),
  ('給料手当', '販管費', 5),
  ('法定福利費', '販管費', 6),
  ('厚生費', '販管費', 7),
  ('減価償却費', '販管費', 8),
  ('地代家賃', '販管費', 9),
  ('修繕費', '販管費', 10),
  ('消耗品費', '販管費', 11),
  ('水道光熱費', '販管費', 12),
  ('旅費交通費', '販管費', 13),
  ('手数料', '販管費', 14),
  ('租税公課', '販管費', 15),
  ('交際接待費', '販管費', 16),
  ('保険料', '販管費', 17),
  ('通信費', '販管費', 18),
  ('諸会費', '販管費', 19),
  ('車輌費', '販管費', 20),
  ('報酬', '販管費', 21),
  ('手続料', '販管費', 22),
  ('会議費', '販管費', 23),
  ('雑費', '販管費', 24),
  ('研究開発費', '販管費', 25);

-- サンプルデータ（アイスタベタイ/DONUT TABETAI店のもの）
insert into items (store_id, name, category, unit, stock, min_stock, ideal_stock, unit_price, supplier, note)
select id, v.name, v.category, v.unit, v.stock, v.min_stock, v.ideal_stock, v.unit_price, v.supplier, v.note
from stores, (values
  ('バニラアイスクリーム(業務用2L)', '食料品', 'パック', 8, 3, 10, 1200, '〇〇冷凍食品', ''),
  ('チョコアイスクリーム(業務用2L)', '食料品', 'パック', 5, 3, 10, 1300, '〇〇冷凍食品', ''),
  ('いちごアイスクリーム(業務用2L)', '食料品', 'パック', 2, 3, 8, 1400, '〇〇冷凍食品', '季節限定'),
  ('コーン(業務用100個入)', '食料品', '箱', 3, 2, 5, 800, '製菓資材A社', ''),
  ('カップ(業務用200個入)', '備品', '箱', 4, 2, 5, 600, '製菓資材A社', ''),
  ('強力粉(5kg)', '食料品', 'kg', 20, 10, 25, 650, '製粉B社', ''),
  ('グラニュー糖(1kg)', '食料品', 'kg', 15, 5, 20, 180, '製菓資材A社', ''),
  ('バター(500g)', '食料品', '個', 12, 5, 15, 680, 'スーパーC', '要冷蔵'),
  ('生クリーム(1L)', '食料品', 'L', 6, 3, 8, 500, '乳製品D社', '要冷蔵'),
  ('チョコレートコーティング(1kg)', '食料品', 'kg', 8, 3, 10, 900, '製菓資材A社', ''),
  ('ストロベリーパウダー(500g)', '食料品', '袋', 5, 2, 6, 750, '製菓資材A社', ''),
  ('箱(アイス用 小)', '備品', '個', 150, 50, 200, 25, '資材E社', ''),
  ('箱(ドーナツ用 1個)', '備品', '個', 200, 50, 300, 30, '資材E社', ''),
  ('箱(ドーナツ用 3個)', '備品', '個', 120, 30, 150, 45, '資材E社', ''),
  ('ナプキン(100枚入)', '備品', '袋', 10, 5, 15, 150, '資材E社', ''),
  ('スプーン(100本入)', '備品', '袋', 8, 3, 10, 200, '資材E社', '')
) as v(name, category, unit, stock, min_stock, ideal_stock, unit_price, supplier, note)
where stores.slug = 'aisu-donut';
