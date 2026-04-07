"use client";

import { useEffect, useState } from "react";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import { BatchActions } from "@/components/photos/batch-actions";
import { AddToCollectionModal } from "@/components/photos/add-to-collection-modal";
import { useUIStore } from "@/stores/ui-store";
import Link from "next/link";
import type { Photo } from "@/types";

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addToCollectionIds, setAddToCollectionIds] = useState<string[] | null>(null);
  const { lightboxOpen, lightboxPhotoId, openLightbox, closeLightbox } =
    useUIStore();

  const fetchPhotos = async () => {
    try {
      const res = await fetch("/api/photos");
      if (res.ok) {
        setPhotos(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    fetchPhotos();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Mis fotos</h1>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis fotos</h1>
        <Link
          href="/upload"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 active:scale-[0.98]"
        >
          Subir fotos
        </Link>
      </div>

      <PhotoGrid
        photos={photos}
        onDelete={handleDelete}
        onAddToCollection={(photoId) => setAddToCollectionIds([photoId])}
      />

      <BatchActions onRefresh={fetchPhotos} />

      {lightboxOpen && (
        <PhotoLightbox
          photos={photos}
          currentId={lightboxPhotoId}
          onClose={closeLightbox}
          onNavigate={openLightbox}
        />
      )}

      {addToCollectionIds && (
        <AddToCollectionModal
          photoIds={addToCollectionIds}
          onClose={() => setAddToCollectionIds(null)}
          onDone={() => {
            setAddToCollectionIds(null);
            fetchPhotos();
          }}
        />
      )}
    </div>
  );
}
