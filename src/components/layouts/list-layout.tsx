"use client";

import { PhotoItem } from "./photo-item";
import type { Photo, LayoutConfig } from "@/types";

interface ListLayoutProps {
  photos: Photo[];
  config: LayoutConfig;
  onPhotoClick?: (photoId: string) => void;
  isPublic?: boolean;
  size?: "thumb" | "full";
  rounded?: boolean;
}

export function ListLayout({
  photos,
  config,
  onPhotoClick,
  size = "thumb",
  rounded = true,
}: ListLayoutProps) {
  const { gap } = config;

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ gap: `${gap}px` }}>
      {photos.map((photo) => (
        <PhotoItem
          key={photo.id}
          photo={photo}
          onClick={() => onPhotoClick?.(photo.id)}
          aspectRatio={`${photo.width}/${photo.height}`}
          showInfo
          size={size}
          rounded={rounded}
        />
      ))}
    </div>
  );
}
