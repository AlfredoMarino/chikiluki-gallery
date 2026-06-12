export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-12">
      <div className="skeleton h-10 w-56 max-w-full rounded-sm" />
      <div className="skeleton mt-3 h-3 w-40 rounded-sm" />

      <div className="mt-10 grid gap-4 border-t border-white/10 pt-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-sm" />
        ))}
      </div>
    </div>
  );
}
