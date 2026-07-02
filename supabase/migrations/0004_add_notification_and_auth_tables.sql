-- LINE低在庫通知の送信先・店長ユーザーと店舗の紐付け
-- ※このファイルは何度実行しても安全（冪等）です。

create table if not exists notification_recipients (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  display_name text default '',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists store_managers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid references stores(id),
  display_name text default '',
  created_at timestamptz default now()
);
