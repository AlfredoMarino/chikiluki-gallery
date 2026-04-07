"use client";

import { useEffect, useState, use } from "react";
import { LayoutEngine } from "@/components/layouts/layout-engine";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import { PresentationMode } from "@/components/photos/presentation-mode";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { PickPhotosModal } from "@/components/photos/pick-photos-modal";
import { BatchActions } from "@/components/photos/batch-actions";
import { useUIStore } from "@/stores/ui-store";
import Link from "next/link";
import type { Photo, Collection, LayoutConfig } from "@/types";

interface CollectionDetail extends Collection {
  layout: LayoutConfig | null;
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
  const [showPicker, setShowPicker] = useState(false);
  const [viewMode, setViewMode] = useState<"layout" | "manage">("layout");
  const [presentationIndex, setPresentationIndex] = useState<number | null>(null);
  const { lightboxOpen, lightboxPhotoId, openLightbox, closeLightbox } =
    useUIStore();

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

  const handleAddPhotos = async (photoIds: string[]) => {
    await fetch(`/api/collections/${id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds }),
    });
    setShowPicker(false);
    fetchData();
  };

  const handleRemovePhoto = async (photoId: string) => {
    await fetch(`/api/collections/${id}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: [photoId] }),
    });
    fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-800" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!collection) {
    return <div className="text-center text-neutral-500">Coleccion no encontrada</div>;
  }

  const typeLabels: Record<string, string> = {
    album: "Album",
    roll: "Rollo",
    collection: "Coleccion",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/collections" className="text-sm text-neutral-500 hover:text-white">
          &larr; Colecciones
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{collection.name}</h1>
            <p className="text-sm text-neutral-500">
              {typeLabels[collection.type]} · {photos.length} fotos · {collection.visibility}
            </p>
          </div>
          <div className="flex gap-2">
            {photos.length > 0 && (
              <button
                onClick={() => setPresentationIndex(0)}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                title="Modo presentacion"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowPicker(true)}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 active:scale-[0.98]"
            >
              + Agregar fotos
            </button>
            {/* View toggle */}
            <div className="flex rounded-lg border border-neutral-700">
              <button
                onClick={() => setViewMode("layout")}
                className={`px-3 py-2 text-xs transition ${
                  viewMode === "layout"
                    ? "bg-neutral-700 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Vista
              </button>
              <button
                onClick={() => setViewMode("manage")}
                className={`px-3 py-2 text-xs transition ${
                  viewMode === "manage"
                    ? "bg-neutral-700 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Gestionar
              </button>
            </div>
            <Link
              href={`/collections/${id}/settings`}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              Configurar
            </Link>
          </div>
        </div>
        {collection.description && (
          <p className="mt-2 text-sm text-neutral-400">{collection.description}</p>
        )}
      </div>

      {/* Content */}
      {viewMode === "layout" ? (
        <LayoutEngine
          photos={photos}
          layout={collection.layout}
          onPhotoClick={openLightbox}
          size="full"
          rounded={false}
        />
      ) : (
        <PhotoGrid
          photos={photos}
          onRemoveFromCollection={handleRemovePhoto}
          inCollection
        />
      )}

      <BatchActions onRefresh={fetchData} />

      {/* Lightbox */}
      {lightboxOpen && (
        <PhotoLightbox
          photos={photos}
          currentId={lightboxPhotoId}
          onClose={closeLightbox}
          onNavigate={openLightbox}
        />
      )}

      {/* Presentation mode */}
      {presentationIndex !== null && (
        <PresentationMode
          photos={photos}
          startIndex={presentationIndex}
          onClose={() => setPresentationIndex(null)}
        />
      )}

      {/* Pick photos modal */}
      {showPicker && (
        <PickPhotosModal
          excludeIds={photos.map((p) => p.id)}
          onAdd={handleAddPhotos}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
