import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '在庫管理',
  description: 'スイーツショップ在庫管理アプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
