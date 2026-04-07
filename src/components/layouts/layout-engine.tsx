"use client";

import { GridLayout } from "./grid-layout";
import { MasonryLayout } from "./masonry-layout";
import { ListLayout } from "./list-layout";
import { CollageLayout } from "./collage-layout";
import type { Photo, LayoutConfig } from "@/types";

interface LayoutEngineProps {
  photos: Photo[];
  layout: LayoutConfig | null;
  onPhotoClick?: (photoId: string) => void;
  isPublic?: boolean;
  /** Image resolution: "thumb" for previews, "full" for layout views */
  size?: "thumb" | "full";
  /** Round photo corners (default true) */
  rounded?: boolean;
}

const defaultLayout: LayoutConfig = {
  id: "",
  collectionId: "",
  layoutType: "grid",
  columnsMobile: 2,
  columnsTablet: 3,
  columnsDesktop: 4,
  gap: 8,
  forceOrientation: false,
  mobileBehavior: { landscapeInPortrait: "stack", maxPhotosPerRow: 1 },
  photoOverrides: {},
};

export function LayoutEngine({
  photos,
  layout,
  onPhotoClick,
  isPublic = false,
  size = "thumb",
  rounded = true,
}: LayoutEngineProps) {
  const config = layout || defaultLayout;

  const commonProps = {
    photos,
    config,
    onPhotoClick,
    isPublic,
    size,
    rounded,
  };

  switch (config.layoutType) {
    case "masonry":
      return <MasonryLayout {...commonProps} />;
    case "list":
      return <ListLayout {...commonProps} />;
    case "collage":
      return <CollageLayout {...commonProps} />;
    case "grid":
    default:
      return <GridLayout {...commonProps} />;
  }
}
