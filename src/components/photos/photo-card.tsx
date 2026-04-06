"use client";

import { useSelectionStore } from "@/stores/selection-store";
import { useUIStore } from "@/stores/ui-store";
import type { Photo } from "@/types";

interface PhotoCardProps {
  photo: Photo;
}

export function PhotoCard({ photo }: PhotoCardProps) {
  const { selectedIds, isSelecting, toggle, startSelecting } =
    useSelectionStore();
  const { openLightbox } = useUIStore();

  const isSelected = selectedIds.has(photo.id);

  const handleClick = () => {
    if (isSelecting) {
      toggle(photo.id);
    } else {
      openLightbox(photo.id);
    }
  };

  const handleLongPress = () => {
    if (!isSelecting) {
      startSelecting();
      toggle(photo.id);
    }
  };

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-lg bg-neutral-900 transition ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
    >
      {/* Blurhash / tiny thumbnail placeholder */}
      <div
        className="aspect-square w-full bg-neutral-800"
        style={{
          backgroundImage: photo.thumbBase64
            ? `url(${photo.thumbBase64})`
            : undefined,
          backgroundSize: "cover",
        }}
      >
        <img
          src={`/api/drive/image/${photo.id}?size=thumb`}
          alt={photo.originalName}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300"
        />
      </div>

      {/* Selection checkbox */}
      {isSelecting && (
        <div className="absolute left-2 top-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
              isSelected
                ? "border-blue-500 bg-blue-500"
                : "border-white/70 bg-black/40"
            }`}
          >
            {isSelected && (
              <svg
                className="h-3.5 w-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={3}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Hover overlay with filename */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
        <p className="truncate text-xs text-white">{photo.originalName}</p>
      </div>
    </div>
  );
}
