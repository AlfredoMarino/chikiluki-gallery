"use client";

import { useEffect, useCallback, useState } from "react";
import type { Photo } from "@/types";

interface PhotoLightboxProps {
  photos: Photo[];
  currentId: string | null;
  onClose: () => void;
  onNavigate: (photoId: string) => void;
}

export function PhotoLightbox({
  photos,
  currentId,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const [showInfo, setShowInfo] = useState(false);

  const currentIndex = photos.findIndex((p) => p.id === currentId);
  const photo = currentIndex >= 0 ? photos[currentIndex] : null;

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(photos[currentIndex + 1].id);
    }
  }, [currentIndex, photos, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(photos[currentIndex - 1].id);
    }
  }, [currentIndex, photos, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
          goNext();
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case "i":
          setShowInfo((prev) => !prev);
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  // Touch swipe
  useEffect(() => {
    let startX = 0;
    const handleStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };
    const handleEnd = (e: TouchEvent) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? goNext() : goPrev();
      }
    };
    window.addEventListener("touchstart", handleStart);
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [goNext, goPrev]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/80"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Counter */}
      <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Info toggle */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="absolute right-14 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/80"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
      </button>

      {/* Prev button */}
      {currentIndex > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/80 md:left-6"
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      {/* Next button */}
      {currentIndex < photos.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/80 md:right-6"
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* Image */}
      <img
        key={photo.id}
        src={`/api/drive/image/${photo.id}?size=full`}
        alt={photo.originalName}
        className="max-h-[90vh] max-w-[90vw] object-contain"
      />

      {/* Info panel */}
      {showInfo && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6 pt-16">
          <h3 className="text-lg font-medium text-white">{photo.originalName}</h3>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-400">
            <span>{photo.width} × {photo.height}</span>
            <span>{photo.orientation}</span>
            <span>{(photo.fileSize / 1024 / 1024).toFixed(1)} MB</span>
            <span>{photo.mimeType}</span>
            {photo.takenAt && (
              <span>{new Date(photo.takenAt).toLocaleDateString()}</span>
            )}
          </div>
          {photo.metadata && Object.keys(photo.metadata).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(photo.metadata).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
                >
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
