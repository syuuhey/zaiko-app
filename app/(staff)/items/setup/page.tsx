import Link from 'next/link'

export default function SetupPage() {
  return (
    <main className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-bold">一括設定</h1>
      <p>一括設定は段階Bで提供予定です。</p>
      <Link href="/items" className="inline-flex min-h-11 items-center font-medium underline">商品管理を開く</Link>
    </main>
  )
}
