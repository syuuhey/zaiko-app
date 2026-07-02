import { getSupabaseServerClient } from '@/lib/supabase-server'
import type { Store } from '@/lib/supabase'

export async function getStores(): Promise<Store[]> {
  const supabase = await getSupabaseServerClient()
  const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('sort_order')
  return data ?? []
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}
