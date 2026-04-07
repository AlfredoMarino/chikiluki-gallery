import type { Metadata } from "next";
import { PublicCollectionView } from "@/components/collections/public-collection-view";
import type { Photo, LayoutConfig, Collection } from "@/types";

interface PublicCollectionData extends Collection {
  layout: LayoutConfig | null;
  photos: Photo[];
}

async function getPublicCollection(
  userName: string,
  slug: string
): Promise<PublicCollectionData | null> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/public/gallery/${userName}/${slug}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string; slug: string }>;
}): Promise<Metadata> {
  const { user, slug } = await params;
  const data = await getPublicCollection(user, slug);
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
  const data = await getPublicCollection(user, slug);

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
