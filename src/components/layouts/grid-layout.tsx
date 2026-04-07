"use client";

import { PhotoItem } from "./photo-item";
import type { Photo, LayoutConfig } from "@/types";

interface GridLayoutProps {
  photos: Photo[];
  config: LayoutConfig;
  onPhotoClick?: (photoId: string) => void;
  isPublic?: boolean;
}

export function GridLayout({
  photos,
  config,
  onPhotoClick,
}: GridLayoutProps) {
  const { columnsMobile, columnsTablet, columnsDesktop, gap } = config;

  return (
    <div
      className="grid"
      style={{
        gap: `${gap}px`,
        gridTemplateColumns: `repeat(${columnsMobile}, 1fr)`,
      }}
    >
      <style>{`
        @media (min-width: 640px) {
          .layout-grid { grid-template-columns: repeat(${columnsTablet}, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .layout-grid { grid-template-columns: repeat(${columnsDesktop}, 1fr) !important; }
        }
      `}</style>
      {photos.map((photo) => (
        <PhotoItem
          key={photo.id}
          photo={photo}
          onClick={() => onPhotoClick?.(photo.id)}
          aspectRatio="1/1"
          showInfo
          className="layout-grid-item"
        />
      ))}
    </div>
  );
}
