export default function Loading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1800px] px-2 py-6 sm:px-6 sm:py-12">
      {/* Header skeleton — replica el header real de la colección */}
      <div className="mb-8 space-y-3">
        <div className="skeleton h-4 w-28 rounded-md" />
        <div className="skeleton h-9 w-72 max-w-full rounded-md" />
        <div className="skeleton h-4 w-48 rounded-md" />
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
