import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase-server'

// Next.js 16: middleware.ts はproxy.tsに改名された。/dashboard配下のみ認証必須にする。
// ここでの判定は「楽観的チェック」であり、財務データを返すServer Component/Route Handler側でも
// store_managersテーブル照会+RLSによる強制チェックを必ず行う。
export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request)

  if (request.nextUrl.pathname.startsWith('/dashboard') && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
