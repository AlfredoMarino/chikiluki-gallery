"use client";

import type { Photo } from "@/types";

interface PhotoItemProps {
  photo: Photo;
  onClick?: () => void;
  className?: string;
  aspectRatio?: string;
  showInfo?: boolean;
}

/**
 * Shared photo renderer used by all layout types.
 * Handles blurhash placeholder → thumbnail → click.
 */
export function PhotoItem({
  photo,
  onClick,
  className = "",
  aspectRatio,
  showInfo = false,
}: PhotoItemProps) {
  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-lg bg-neutral-900 ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      onClick={onClick}
    >
      {/* Tiny base64 placeholder */}
      <div
        className="absolute inset-0 bg-neutral-800"
        style={{
          backgroundImage: photo.thumbBase64
            ? `url(${photo.thumbBase64})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Actual image */}
      <img
        src={`/api/drive/image/${photo.id}?size=thumb`}
        alt={photo.originalName}
        loading="lazy"
        className="relative h-full w-full object-cover transition duration-500"
      />

      {/* Hover overlay */}
      {showInfo && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
          <p className="truncate text-sm text-white">{photo.originalName}</p>
          <p className="text-xs text-neutral-300">
            {photo.width}×{photo.height}
          </p>
        </div>
      )}
    </div>
  );
}
