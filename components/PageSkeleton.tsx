export default function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="max-w-md mx-auto min-h-dvh px-4 pt-6 animate-pulse">
      <div className="h-6 bg-stone-200 dark:bg-stone-800 rounded-lg w-1/2 mb-2" />
      <div className="h-3 bg-stone-100 dark:bg-stone-800/60 rounded-lg w-3/4 mb-6" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-4">
          <div className="h-40 bg-stone-200 dark:bg-stone-800 rounded-2xl mb-2" />
          <div className="h-3 bg-stone-100 dark:bg-stone-800/60 rounded-lg w-2/3 mb-1.5" />
          <div className="h-3 bg-stone-100 dark:bg-stone-800/60 rounded-lg w-1/2" />
        </div>
      ))}
    </div>
  )
}
