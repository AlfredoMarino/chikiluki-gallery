"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import type { Photo } from "@/types";

interface PresentationModeProps {
  photos: Photo[];
  startIndex?: number;
  onClose: () => void;
}

/**
 * Fullscreen presentation mode.
 * Landscape photos on portrait screens are CSS-rotated 90° to fill the display.
 * Dynamically adapts when the user physically rotates their device.
 */
export function PresentationMode({
  photos,
  startIndex = 0,
  onClose,
}: PresentationModeProps) {
  const [index, setIndex] = useState(startIndex);
  const [isPortraitScreen, setIsPortraitScreen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const photo = photos[index];
  const isLandscapePhoto = photo && photo.width > photo.height;
  const needsRotation = isLandscapePhoto && isPortraitScreen;

  // Detect screen orientation
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      setIsPortraitScreen(portrait);
    };

    checkOrientation();

    const mql = window.matchMedia("(orientation: portrait)");
    const handler = () => checkOrientation();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Show rotation hint briefly when a landscape photo is shown on portrait screen
  useEffect(() => {
    if (needsRotation) {
      setShowHint(true);
      const t = setTimeout(() => setShowHint(false), 2500);
      return () => clearTimeout(t);
    }
    setShowHint(false);
  }, [needsRotation, index]);

  // Reset image loaded state on photo change
  useEffect(() => {
    setImageLoaded(false);
  }, [index]);

  // Auto-hide controls after inactivity
  useEffect(() => {
    const resetTimer = () => {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    };

    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("touchstart", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [index]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Try to go fullscreen
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  const goNext = useCallback(() => {
    if (index < photos.length - 1) setIndex(index + 1);
  }, [index, photos.length]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          goPrev();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  // Touch swipe
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    const handleStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const handleEnd = (e: TouchEvent) => {
      const dx = startX - e.changedTouches[0].clientX;
      const dy = startY - e.changedTouches[0].clientY;
      // Only handle horizontal swipes (ignore vertical scrolls)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        dx > 0 ? goNext() : goPrev();
      }
    };
    window.addEventListener("touchstart", handleStart, { passive: true });
    window.addEventListener("touchend", handleEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [goNext, goPrev]);

  if (!photo) return null;

  // For landscape photos on portrait screens:
  // Rotate 90° and swap dimensions so the image fills the screen
  const rotateStyle = needsRotation
    ? {
        transform: "rotate(90deg)",
        width: "100vh",
        height: "100vw",
        maxWidth: "100vh",
        maxHeight: "100vw",
      }
    : {
        width: "100%",
        height: "100%",
      };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black">
      {/* Base64 placeholder background */}
      {photo.thumbBase64 && !imageLoaded && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${photo.thumbBase64})`,
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "blur(20px)",
            transform: needsRotation ? "rotate(90deg)" : undefined,
          }}
        />
      )}

      {/* Main image container */}
      <div
        className="flex items-center justify-center transition-transform duration-300"
        style={rotateStyle}
      >
        <img
          key={photo.id}
          src={`/api/drive/image/${photo.id}?size=full`}
          alt={photo.originalName}
          onLoad={() => setImageLoaded(true)}
          className={`max-h-full max-w-full object-contain transition-opacity duration-500 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          draggable={false}
        />
      </div>

      {/* Rotation hint */}
      {showHint && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="animate-pulse rounded-2xl bg-black/80 px-6 py-4 text-center">
            <svg
              className="mx-auto mb-2 h-10 w-10 animate-[spin_2s_ease-in-out_1] text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3"
              />
            </svg>
            <p className="text-sm text-white">Gira tu dispositivo</p>
          </div>
        </div>
      )}

      {/* Controls — auto-hide */}
      <div
        className={`transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-30 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition hover:bg-black/80"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Counter */}
        <div className="absolute left-3 top-3 z-30 rounded-full bg-black/60 px-3 py-1 text-sm text-white backdrop-blur-sm">
          {index + 1} / {photos.length}
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 z-30 h-0.5 bg-white/10">
          <div
            className="h-full bg-white/60 transition-all duration-300"
            style={{
              width: `${((index + 1) / photos.length) * 100}%`,
            }}
          />
        </div>

        {/* Prev/Next - larger touch targets for mobile */}
        {index > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-0 top-0 z-20 flex h-full w-16 items-center justify-start pl-2 md:w-20"
          >
            <span className="rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </span>
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-0 top-0 z-20 flex h-full w-16 items-center justify-end pr-2 md:w-20"
          >
            <span className="rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
