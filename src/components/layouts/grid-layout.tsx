"use client";

import { useId } from "react";
import { PhotoItem } from "./photo-item";
import type { Photo, LayoutConfig } from "@/types";

interface GridLayoutProps {
  photos: Photo[];
  config: LayoutConfig;
  onPhotoClick?: (photoId: string) => void;
  isPublic?: boolean;
  size?: "thumb" | "full";
  rounded?: boolean;
}

export function GridLayout({
  photos,
  config,
  onPhotoClick,
  size = "thumb",
  rounded = true,
}: GridLayoutProps) {
  const { columnsMobile, columnsTablet, columnsDesktop, gap } = config;
  const uid = useId().replace(/:/g, "");

  return (
    <div
      className={`grid lg-${uid}`}
      style={{
        gap: `${gap}px`,
        gridTemplateColumns: `repeat(${columnsMobile}, 1fr)`,
      }}
    >
      <style>{`
        @media (min-width: 640px) {
          .lg-${uid} { grid-template-columns: repeat(${columnsTablet}, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .lg-${uid} { grid-template-columns: repeat(${columnsDesktop}, 1fr) !important; }
        }
      `}</style>
      {photos.map((photo) => (
        <PhotoItem
          key={photo.id}
          photo={photo}
          onClick={() => onPhotoClick?.(photo.id)}
          aspectRatio="1/1"
          showInfo
          size={size}
          rounded={rounded}
        />
      ))}
    </div>
  );
}
