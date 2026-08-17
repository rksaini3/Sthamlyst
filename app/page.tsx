import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-extrabold text-amber-900">Sthamly</h1>
      <p className="text-amber-700 mt-2">सीखो ➔ बनाओ ➔ लोकल बेचो</p>

      <div className="mt-10 w-full space-y-4">
        <Link
          href="/learn"
          className="block w-full bg-amber-600 text-white font-semibold py-3.5 rounded-xl"
        >
          🎥 Learn &amp; Earn
        </Link>
        <Link
          href="/bazaar"
          className="block w-full bg-stone-900 text-white font-semibold py-3.5 rounded-xl"
        >
          🛍️ Local Bazaar
        </Link>
      </div>

      <p className="text-xs text-stone-400 mt-10">Pilot: Gonda, Uttar Pradesh</p>
    </div>
  )
}
