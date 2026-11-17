'use client'

import Link from 'next/link'
import { StaffNameForm, useStaff } from '../staff-layout'
import { panelClass } from '../ui'

const menu = [
  { href: '/items', label: '商品管理' },
  { href: '/items/setup', label: '一括設定' },
  { href: '/history', label: '履歴' },
  { href: '/waste', label: '廃棄' },
  { href: '/dashboard', label: '経営ダッシュボード（店長ログイン）' },
]

export default function MorePage() {
  const { staffName } = useStaff()
  return (
    <main className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-bold">その他</h1>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
        {menu.map(({ href, label }) => (
          <li key={href}><Link href={href} className="flex min-h-12 items-center justify-between gap-2 px-4 text-sm font-medium">
            {label}<span aria-hidden>›</span>
          </Link></li>
        ))}
      </ul>
      <section className={panelClass}><StaffNameForm currentName={staffName} /></section>
    </main>
  )
}
