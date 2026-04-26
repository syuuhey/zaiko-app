-- 商品マスタ
create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('食料品', '備品')),
  unit text not null default '個',
  stock integer not null default 0,
  min_stock integer not null default 0,
  ideal_stock integer not null default 0,
  unit_price integer default 0,
  supplier text default '',
  note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 在庫チェック履歴
create table stock_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  checked_by text not null default 'スタッフ',
  stock_before integer not null,
  stock_after integer not null,
  note text default '',
  checked_at timestamptz default now()
);

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

-- サンプルデータ
insert into items (name, category, unit, stock, min_stock, ideal_stock, unit_price, supplier, note) values
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
('スプーン(100本入)', '備品', '袋', 8, 3, 10, 200, '資材E社', '');
