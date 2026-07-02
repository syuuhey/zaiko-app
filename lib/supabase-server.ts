import { createServerClient } from '@supabase/ssr'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

// Cookieセッションを認識するクライアント。RLSはこのクライアントのauth.uid()で評価される。
export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component から呼ばれた場合は書き込み不可（proxy側でセッション更新されるため無視してよい）
          }
        },
      },
    }
  )
}

// RLSをバイパスするservice roleクライアント。Webhook/cron/OCR/同期処理などサーバー専用処理からのみ使う。
let _serviceInstance: SupabaseClient | null = null

export function getSupabaseServiceClient(): SupabaseClient {
  if (!_serviceInstance) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Supabaseダッシュボード > Settings > API から取得し.env.localに設定してください。')
    }
    _serviceInstance = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
  }
  return _serviceInstance
}

// app/proxy.ts から呼ぶセッション更新+認証判定。Supabase公式の@supabase/ssr連携パターンに準拠。
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, isAuthenticated: !!user }
}

// 現在ログイン中の店長ユーザーを取得。未ログインならnull。
export async function getCurrentManager() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: manager } = await supabase
    .from('store_managers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return manager ? { user, manager } : null
}
