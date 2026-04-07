"use client";

import { useMemo } from "react";
import { PhotoItem } from "./photo-item";
import type { Photo, LayoutConfig } from "@/types";

interface MasonryLayoutProps {
  photos: Photo[];
  config: LayoutConfig;
  onPhotoClick?: (photoId: string) => void;
  isPublic?: boolean;
}

export function MasonryLayout({
  photos,
  config,
  onPhotoClick,
}: MasonryLayoutProps) {
  const { columnsDesktop, gap } = config;

  // Distribute photos across columns by shortest column
  const columns = useMemo(() => {
    const cols: Photo[][] = Array.from({ length: columnsDesktop }, () => []);
    const heights = new Array(columnsDesktop).fill(0);

    for (const photo of photos) {
      const shortestCol = heights.indexOf(Math.min(...heights));
      cols[shortestCol].push(photo);
      // Approximate height based on aspect ratio
      heights[shortestCol] += photo.height / photo.width;
    }

    return cols;
  }, [photos, columnsDesktop]);

  return (
    <div className="flex" style={{ gap: `${gap}px` }}>
      {columns.map((column, colIdx) => (
        <div
          key={colIdx}
          className="flex flex-1 flex-col"
          style={{ gap: `${gap}px` }}
        >
          {column.map((photo) => (
            <PhotoItem
              key={photo.id}
              photo={photo}
              onClick={() => onPhotoClick?.(photo.id)}
              aspectRatio={`${photo.width}/${photo.height}`}
              showInfo
            />
          ))}
        </div>
      ))}
    </div>
  );
}
