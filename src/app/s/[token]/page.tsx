import type { Metadata } from "next";
import { PublicCollectionView } from "@/components/collections/public-collection-view";
import type { Photo, LayoutConfig, Collection } from "@/types";

interface SharedCollectionData extends Collection {
  layout: LayoutConfig | null;
  photos: Photo[];
}

async function getSharedCollection(
  token: string
): Promise<SharedCollectionData | null> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/public/shared/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await getSharedCollection(token);
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
  const data = await getSharedCollection(token);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Coleccion no encontrada o el link no es valido</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{data.name}</h1>
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
