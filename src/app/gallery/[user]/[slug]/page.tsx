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
    <div className="animate-page-in mx-auto min-h-screen w-full max-w-[1800px] px-2 py-6 sm:px-6 sm:py-12">
      <div className="mb-10 border-b border-white/10 pb-8">
        <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500">
          <a href={`/gallery/${user}`} className="transition hover:text-white">
            {user}
          </a>
        </p>
        <h1 className="mt-2 text-4xl font-extralight tracking-tight sm:text-5xl">
          {data.name}
        </h1>
        {data.description && (
          <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-neutral-400">
            {data.description}
          </p>
        )}
        <p className="mt-4 text-[11px] uppercase tracking-[0.15em] text-neutral-500">
          {data.photos.length} fotos
        </p>
      </div>

      <PublicCollectionView
        collectionId={data.id}
        photos={data.photos}
        layout={data.layout}
      />
    </div>
  );
}
