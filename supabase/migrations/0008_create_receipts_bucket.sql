-- レシート画像の保存先バケット（非公開。サーバーのservice role経由でのみ読み書き）
-- ※このファイルは何度実行しても安全（冪等）です。

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;
