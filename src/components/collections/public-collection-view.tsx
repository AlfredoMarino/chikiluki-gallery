"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutEngine } from "@/components/layouts/layout-engine";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import { PresentationMode } from "@/components/photos/presentation-mode";
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
  const [presentationIndex, setPresentationIndex] = useState<number | null>(null);
  const searchParams = useSearchParams();

  // Auto-open presentation mode when the share link carries `?present=1`.
  // Only fires on mount (or when the photo list first arrives non-empty) so
  // closing the presentation doesn't immediately re-open it.
  useEffect(() => {
    if (searchParams.get("present") === "1" && photos.length > 0) {
      setPresentationIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  return (
    <>
      {/* Presentation mode button */}
      {photos.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setPresentationIndex(0)}
            className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            Presentacion
          </button>
        </div>
      )}

      <LayoutEngine
        photos={photos}
        layout={layout}
        onPhotoClick={setLightboxId}
        isPublic
        size="full"
        rounded={false}
      />

      {lightboxId && (
        <PhotoLightbox
          photos={photos}
          currentId={lightboxId}
          onClose={() => setLightboxId(null)}
          onNavigate={setLightboxId}
        />
      )}

      {presentationIndex !== null && (
        <PresentationMode
          photos={photos}
          startIndex={presentationIndex}
          onClose={() => setPresentationIndex(null)}
        />
      )}
    </>
  );
}
