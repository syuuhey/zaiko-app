import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentManager } from '@/lib/supabase-server'
import { signOut } from '@/app/actions/auth'

const NAV = [
  { href: '/dashboard', label: 'サマリー' },
  { href: '/dashboard/pnl', label: '損益計算書' },
  { href: '/dashboard/expenses', label: '経費' },
  { href: '/dashboard/sales', label: '売上' },
  { href: '/dashboard/register-closings', label: 'レジ締め' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentManager()
  if (!current) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-800 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white opacity-80 text-sm">← 在庫管理へ</Link>
            <h1 className="text-lg font-bold">経営ダッシュボード</h1>
          </div>
          <form action={signOut}>
            <button className="text-sm bg-white/10 px-3 py-1.5 rounded-full">ログアウト</button>
          </form>
        </div>
        <nav className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm px-3 py-2 text-white/80 hover:text-white shrink-0"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">{children}</div>
    </div>
  )
}
