"use client";

import { PhotoItem } from "./photo-item";
import { useBreakpointColumns } from "@/hooks/use-breakpoint-columns";
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
  const { columnsMobile, columnsTablet, columnsDesktop, gap, photoOverrides } = config;
  const numColumns = useBreakpointColumns(columnsMobile, columnsTablet, columnsDesktop);

  return (
    <div
      className="grid"
      style={{
        gap: `${gap}px`,
        gridTemplateColumns: `repeat(${numColumns}, 1fr)`,
        gridAutoRows: "200px",
      }}
    >
      {photos.map((photo) => {
        const override = photoOverrides?.[photo.id];
        const span = Math.min(override?.span || 1, numColumns);
        const aspect = override?.aspect || `${photo.width}/${photo.height}`;

        return (
          <div
            key={photo.id}
            style={{
              gridColumn: `span ${span}`,
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
