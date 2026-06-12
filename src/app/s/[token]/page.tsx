import type { Metadata } from "next";
import { PublicCollectionView } from "@/components/collections/public-collection-view";
import { getCollectionByShareToken } from "@/lib/data/public";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await getCollectionByShareToken(token);
  return {
    title: data ? `${data.name} — Chikiluki Gallery` : "No encontrada",
    description: data?.description || "Coleccion compartida",
  };
}

export default async function SharedCollectionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getCollectionByShareToken(token);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Coleccion no encontrada o el link no es valido</p>
      </div>
    );
  }

  return (
    <div className="animate-page-in mx-auto min-h-screen w-full max-w-[1800px] px-2 py-6 sm:px-6 sm:py-12">
      <div className="mb-10 border-b border-white/10 pb-8">
        <h1 className="text-4xl font-extralight tracking-tight sm:text-5xl">
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
