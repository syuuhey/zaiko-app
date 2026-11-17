'use client'

import type { Store } from '@/lib/supabase'

type Props = {
  stores: Store[]
  storeId: string
  onSelect: (id: string) => void
}

export default function StoreSwitcher({ stores, storeId, onSelect }: Props) {
  if (stores.length <= 1) return null

  return (
    <div className="flex bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      {stores.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={storeId === s.id}
          onClick={() => onSelect(s.id)}
          className={`min-h-11 min-w-0 flex-1 px-2 py-2 text-sm font-medium transition-colors ${
            storeId === s.id ? 'bg-neutral-900 text-white' : 'text-gray-500'
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}
