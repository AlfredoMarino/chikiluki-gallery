import Link from "next/link";
import type { Metadata } from "next";
import { getPublicCollectionsByUser } from "@/lib/data/public";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string }>;
}): Promise<Metadata> {
  const { user } = await params;
  return {
    title: `${user} — Chikiluki Gallery`,
    description: `Colecciones publicas de ${user}`,
  };
}

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ user: string }>;
}) {
  const { user } = await params;
  const collections = await getPublicCollectionsByUser(user);

  return (
    <div className="animate-page-in mx-auto min-h-screen max-w-5xl px-4 py-12">
      <h1 className="text-4xl font-extralight tracking-tight">{user}</h1>
      <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-neutral-500">
        {collections.length} colecciones publicas
      </p>

      <div className="mt-10 grid gap-4 border-t border-white/10 pt-10 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((col) => (
          <Link
            key={col.id}
            href={`/gallery/${user}/${col.slug}`}
            className="group border border-white/10 p-6 transition hover:border-white/30"
          >
            <h2 className="text-xl font-light text-white">{col.name}</h2>
            <p className="mt-2 text-[11px] uppercase tracking-[0.15em] text-neutral-500">
              {col.photoCount} fotos
            </p>
            {col.description && (
              <p className="mt-3 line-clamp-2 text-sm font-light text-neutral-400">
                {col.description}
              </p>
            )}
          </Link>
        ))}
      </div>

      {collections.length === 0 && (
        <p className="mt-12 text-center text-neutral-500">
          No hay colecciones publicas.
        </p>
      )}
    </div>
  );
}
