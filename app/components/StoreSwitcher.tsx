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
    <div className="flex bg-white rounded-xl shadow-sm overflow-hidden">
      {stores.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            storeId === s.id ? 'bg-gray-800 text-white' : 'text-gray-500'
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}
