import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // /dashboard配下はLINE Webhookなど外部から書き込まれるデータを扱うため、
    // タブ移動のたびに必ず最新データを取得する（クライアント側キャッシュによる古い表示を防ぐ）
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
