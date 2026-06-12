export default function Loading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1800px] px-2 py-6 sm:px-6 sm:py-12">
      {/* Header skeleton — replica el header real de la colección */}
      <div className="mb-10 space-y-4 border-b border-white/10 pb-8">
        <div className="skeleton h-11 w-80 max-w-full rounded-sm" />
        <div className="skeleton h-4 w-56 rounded-sm" />
        <div className="skeleton h-3 w-20 rounded-sm" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton aspect-square" />
        ))}
      </div>
    </div>
  );
}
