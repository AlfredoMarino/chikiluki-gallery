"use client";

import { useState } from "react";
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

  // `?present=1` shows a fullscreen landing with a single "Comenzar" button.
  // Programmatically clicking the button wouldn't work — browsers require a
  // real user gesture for requestFullscreen — so we ask for exactly one tap.
  // Dismissing the landing (close or escape) drops them back to the gallery.
  const [presentLandingDismissed, setPresentLandingDismissed] = useState(false);
  const showPresentLanding =
    searchParams.get("present") === "1" &&
    photos.length > 0 &&
    presentationIndex === null &&
    !presentLandingDismissed;

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

      {showPresentLanding && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center gap-6 bg-black/95 px-6 text-center">
          <button
            type="button"
            onClick={() => setPresentLandingDismissed(true)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-neutral-400 transition hover:bg-white/20 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <p className="text-sm uppercase tracking-widest text-neutral-500">
            {photos.length} fotos
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setPresentLandingDismissed(true);
              setPresentationIndex(0);
            }}
            className="flex items-center gap-3 rounded-full bg-white px-8 py-4 text-lg font-medium text-black shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            Comenzar presentación
          </button>
          <p className="max-w-xs text-xs text-neutral-500">
            Se abrirá en pantalla completa. Pulsa Esc para salir.
          </p>
        </div>
      )}
    </>
  );
}
