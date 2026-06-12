export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-12">
      <div className="skeleton h-9 w-56 max-w-full rounded-md" />
      <div className="skeleton mt-2 h-4 w-40 rounded-md" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
