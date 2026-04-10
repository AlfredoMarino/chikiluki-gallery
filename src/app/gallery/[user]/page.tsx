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
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">{user}</h1>
      <p className="mt-1 text-neutral-400">
        {collections.length} colecciones publicas
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((col) => (
          <Link
            key={col.id}
            href={`/gallery/${user}/${col.slug}`}
            className="group rounded-lg border border-neutral-800 bg-neutral-900 p-5 transition hover:border-neutral-600"
          >
            <h2 className="text-lg font-medium group-hover:text-blue-400">
              {col.name}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {col.photoCount} fotos
            </p>
            {col.description && (
              <p className="mt-2 line-clamp-2 text-sm text-neutral-400">
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
