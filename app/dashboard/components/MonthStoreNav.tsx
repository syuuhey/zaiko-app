'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { Store } from '@/lib/supabase'

type Props = {
  stores: Store[]
  storeSlug: string
  month: string
}

export default function MonthStoreNav({ stores, storeSlug, month }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function go(nextStore: string, nextMonth: string) {
    router.push(`${pathname}?store=${nextStore}&month=${nextMonth}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex bg-white rounded-xl shadow-sm overflow-hidden">
        {stores.map((s) => (
          <button
            key={s.id}
            onClick={() => go(s.slug, month)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              storeSlug === s.slug ? 'bg-gray-800 text-white' : 'text-gray-500'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <input
        type="month"
        value={month}
        onChange={(e) => go(storeSlug, e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
    </div>
  )
}
