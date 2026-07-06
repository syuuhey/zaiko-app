'use client'

import { useActionState } from 'react'
import { signIn } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null)

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-gray-800">店長ログイン</h1>
          <p className="text-xs text-gray-400">売上・経費・損益計算書はこちらから</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-gray-500">メールアドレス</label>
            <input
              type="email"
              name="email"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-500">パスワード</label>
            <input
              type="password"
              name="password"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-500 text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-neutral-900 text-white py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {pending ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
