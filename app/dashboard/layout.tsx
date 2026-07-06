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
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 pt-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-neutral-400 text-sm hover:text-neutral-600">← 在庫管理</Link>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900">経営ダッシュボード</h1>
          </div>
          <form action={signOut}>
            <button className="text-sm text-neutral-500 border border-neutral-200 px-3 py-1.5 rounded-full hover:bg-neutral-100 transition-colors">
              ログアウト
            </button>
          </form>
        </div>
        <nav className="max-w-4xl mx-auto px-4 mt-2 flex gap-4 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm py-2.5 text-neutral-500 hover:text-neutral-900 border-b-2 border-transparent hover:border-neutral-300 shrink-0 transition-colors"
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
