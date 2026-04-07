"use client";

import { PhotoCard } from "./photo-card";
import { useSelectionStore } from "@/stores/selection-store";
import type { Photo } from "@/types";

interface PhotoGridProps {
  photos: Photo[];
  onDelete?: (id: string) => void;
  onAddToCollection?: (photoId: string) => void;
  onRemoveFromCollection?: (photoId: string) => void;
  inCollection?: boolean;
}

export function PhotoGrid({
  photos,
  onDelete,
  onAddToCollection,
  onRemoveFromCollection,
  inCollection = false,
}: PhotoGridProps) {
  const { selectedIds, isSelecting, clear, selectAll } = useSelectionStore();

  if (photos.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center text-neutral-500">
        <svg
          className="mb-3 h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
          />
        </svg>
        <p className="text-sm">No hay fotos</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selection toolbar */}
      {isSelecting && (
        <div className="flex items-center gap-3 rounded-lg bg-neutral-900 px-4 py-2">
          <span className="text-sm text-neutral-300">
            {selectedIds.size} seleccionadas
          </span>
          <button
            onClick={() => selectAll(photos.map((p) => p.id))}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Todas
          </button>
          <button
            onClick={clear}
            className="text-sm text-neutral-400 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onDelete={onDelete}
            onAddToCollection={onAddToCollection}
            onRemoveFromCollection={onRemoveFromCollection}
            inCollection={inCollection}
          />
        ))}
      </div>
    </div>
  );
}
