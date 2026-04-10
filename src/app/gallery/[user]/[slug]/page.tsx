import type { Metadata } from "next";
import { PublicCollectionView } from "@/components/collections/public-collection-view";
import { getPublicCollectionBySlug } from "@/lib/data/public";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string; slug: string }>;
}): Promise<Metadata> {
  const { user, slug } = await params;
  const data = await getPublicCollectionBySlug(user, slug);
  return {
    title: data
      ? `${data.name} — ${user} — Chikiluki Gallery`
      : "Coleccion no encontrada",
    description: data?.description || `Fotos de ${user}`,
  };
}

export default async function PublicCollectionPage({
  params,
}: {
  params: Promise<{ user: string; slug: string }>;
}) {
  const { user, slug } = await params;
  const data = await getPublicCollectionBySlug(user, slug);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Coleccion no encontrada</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-12">
      <div className="mb-8">
        <p className="text-sm text-neutral-500">
          <a href={`/gallery/${user}`} className="hover:text-white">
            {user}
          </a>
        </p>
        <h1 className="mt-1 text-3xl font-bold">{data.name}</h1>
        {data.description && (
          <p className="mt-2 text-neutral-400">{data.description}</p>
        )}
        <p className="mt-1 text-sm text-neutral-500">
          {data.photos.length} fotos
        </p>
      </div>

      <PublicCollectionView photos={data.photos} layout={data.layout} />
    </div>
  );
}
