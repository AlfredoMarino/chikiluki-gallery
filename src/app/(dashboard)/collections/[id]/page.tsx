"use client";

import { useEffect, useState, use } from "react";
import { PhotoGrid } from "@/components/photos/photo-grid";
import Link from "next/link";
import type { Photo, Collection } from "@/types";

interface CollectionDetail extends Collection {
  layout: unknown;
}

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [colRes, photosRes] = await Promise.all([
        fetch(`/api/collections/${id}`),
        fetch(`/api/collections/${id}/photos`),
      ]);

      if (colRes.ok) setCollection(await colRes.json());
      if (photosRes.ok) setPhotos(await photosRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleRemovePhotos = async (ids: string[]) => {
    await fetch(`/api/collections/${id}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: ids }),
    });
    fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-800" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="text-center text-neutral-500">
        Coleccion no encontrada
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    album: "Album",
    roll: "Rollo",
    collection: "Coleccion",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/collections"
          className="text-sm text-neutral-500 hover:text-white"
        >
          ← Colecciones
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{collection.name}</h1>
            <p className="text-sm text-neutral-500">
              {typeLabels[collection.type]} · {photos.length} fotos ·{" "}
              {collection.visibility}
            </p>
          </div>
          <Link
            href={`/collections/${id}/settings`}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            Configurar
          </Link>
        </div>
        {collection.description && (
          <p className="mt-2 text-sm text-neutral-400">
            {collection.description}
          </p>
        )}
      </div>

      <PhotoGrid photos={photos} onDeleteSelected={handleRemovePhotos} />
    </div>
  );
}
