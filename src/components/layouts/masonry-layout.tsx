"use client";

import { useMemo } from "react";
import { PhotoItem } from "./photo-item";
import { useBreakpointColumns } from "@/hooks/use-breakpoint-columns";
import type { Photo, LayoutConfig } from "@/types";

interface MasonryLayoutProps {
  photos: Photo[];
  config: LayoutConfig;
  onPhotoClick?: (photoId: string) => void;
  isPublic?: boolean;
  size?: "thumb" | "full";
  rounded?: boolean;
}

export function MasonryLayout({
  photos,
  config,
  onPhotoClick,
  size = "thumb",
  rounded = true,
}: MasonryLayoutProps) {
  const { columnsMobile, columnsTablet, columnsDesktop, gap } = config;
  const numColumns = useBreakpointColumns(columnsMobile, columnsTablet, columnsDesktop);

  // Distribute photos across columns by shortest column
  const columns = useMemo(() => {
    const cols: Photo[][] = Array.from({ length: numColumns }, () => []);
    const heights = new Array(numColumns).fill(0);

    for (const photo of photos) {
      const shortestCol = heights.indexOf(Math.min(...heights));
      cols[shortestCol].push(photo);
      heights[shortestCol] += photo.height / photo.width;
    }

    return cols;
  }, [photos, numColumns]);

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
              size={size}
              rounded={rounded}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
