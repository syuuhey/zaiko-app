import type { Item } from '@/lib/supabase'

export function supplierChoices(items: Item[]) {
  return [...new Set(items.map((item) => item.supplier).filter((supplier) => supplier?.trim()))]
    .sort((first, second) => first.localeCompare(second, 'ja'))
}
