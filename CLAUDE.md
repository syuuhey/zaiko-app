# zaiko-app

区分: 自社用(株式会社TiE)

自店2店舗(アイスタベタイ/DONUT TABETAI、what's?)の在庫管理+店長用の経営ダッシュボード。
Next.js 16(App Router)+ Tailwind + Supabase。main への push で Vercel 自動デプロイ。

## コマンド
- `npm run dev` … 開発サーバー
- `npm run lint` / `npx tsc --noEmit` / `npm run build` … 完了報告前に必ず通す(テストは無い)

## ルール
- 実装前に【確認事項】で止める: DBスキーマ変更、認証・RLS、本番反映、環境変数の追加、Cron・LINE送信・レジ締め連携に触る変更
- マイグレーションは `supabase/migrations/` に連番・冪等で書く。適用はしゅうへいが Supabase SQL Editor で手動
- スタッフ用画面(在庫・廃棄・履歴・商品管理)はログイン不要のまま。財務系は店長ログイン必須
- secrets は `.env.local` / Vercel の環境変数のみ
- 完了時に docs を更新する

## ドキュメント
- [docs/設計書.md](docs/設計書.md) … 仕様の正(索引つき)
- [docs/決定ログ.md](docs/決定ログ.md) … なぜそう決めたか
- [docs/引き継ぎ.md](docs/引き継ぎ.md) … 稼働状況・未対応タスク

@AGENTS.md
