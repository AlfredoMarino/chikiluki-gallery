"use client";

import { PhotoItem } from "./photo-item";
import type { Photo, LayoutConfig } from "@/types";

interface CollageLayoutProps {
  photos: Photo[];
  config: LayoutConfig;
  onPhotoClick?: (photoId: string) => void;
  isPublic?: boolean;
  size?: "thumb" | "full";
  rounded?: boolean;
}

/**
 * Collage layout: photos can span multiple columns and have custom aspect ratios.
 * Uses CSS Grid with photo-specific overrides from config.photoOverrides.
 */
export function CollageLayout({
  photos,
  config,
  onPhotoClick,
  size = "thumb",
  rounded = true,
}: CollageLayoutProps) {
  const { columnsDesktop, gap, photoOverrides } = config;

  return (
    <div
      className="grid"
      style={{
        gap: `${gap}px`,
        gridTemplateColumns: `repeat(${columnsDesktop}, 1fr)`,
        gridAutoRows: "200px",
      }}
    >
      {photos.map((photo) => {
        const override = photoOverrides?.[photo.id];
        const span = override?.span || 1;
        const aspect = override?.aspect || `${photo.width}/${photo.height}`;

        return (
          <div
            key={photo.id}
            style={{
              gridColumn: `span ${Math.min(span, columnsDesktop)}`,
              gridRow: span > 1 ? `span ${Math.ceil(span * 0.75)}` : undefined,
            }}
          >
            <PhotoItem
              photo={photo}
              onClick={() => onPhotoClick?.(photo.id)}
              aspectRatio={aspect}
              showInfo
              size={size}
              rounded={rounded}
              className="h-full"
            />
          </div>
        );
      })}
    </div>
  );
}
