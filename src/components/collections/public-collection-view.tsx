"use client";

import { useState } from "react";
import { LayoutEngine } from "@/components/layouts/layout-engine";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import type { Photo, LayoutConfig } from "@/types";

interface PublicCollectionViewProps {
  photos: Photo[];
  layout: LayoutConfig | null;
}

export function PublicCollectionView({
  photos,
  layout,
}: PublicCollectionViewProps) {
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  return (
    <>
      <LayoutEngine
        photos={photos}
        layout={layout}
        onPhotoClick={setLightboxId}
        isPublic
      />

      {lightboxId && (
        <PhotoLightbox
          photos={photos}
          currentId={lightboxId}
          onClose={() => setLightboxId(null)}
          onNavigate={setLightboxId}
        />
      )}
    </>
  );
}
