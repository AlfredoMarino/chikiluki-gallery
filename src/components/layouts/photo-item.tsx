"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useLikesOptional } from "@/components/likes/likes-context";
import { LikeButton } from "@/components/likes/like-button";
import type { Photo } from "@/types";

interface PhotoItemProps {
  photo: Photo;
  onClick?: () => void;
  className?: string;
  aspectRatio?: string;
  showInfo?: boolean;
  /** "thumb" for manage/preview, "full" for layout view */
  size?: "thumb" | "full";
  /** Whether to round corners (false for layout views) */
  rounded?: boolean;
}

/**
 * Shared photo renderer used by all layout types.
 * Progressive loading: base64 placeholder → thumbnail → full image.
 * Uses IntersectionObserver to only load when visible.
 */
export function PhotoItem({
  photo,
  onClick,
  className = "",
  aspectRatio,
  showInfo = false,
  size = "thumb",
  rounded = true,
}: PhotoItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const likes = useLikesOptional();
  const [isVisible, setIsVisible] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);

  // IntersectionObserver: only start loading when photo enters viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" } // start loading 200px before entering viewport
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleThumbLoad = useCallback(() => setThumbLoaded(true), []);
  const handleFullLoad = useCallback(() => setFullLoaded(true), []);

  const showFull = size === "full";

  return (
    <div
      ref={containerRef}
      className={`group relative cursor-pointer overflow-hidden bg-neutral-950 ${
        rounded ? "rounded-sm" : ""
      } ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      onClick={onClick}
    >
      {/* Layer 1: base64 tiny placeholder — always present, prevents blank space */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: photo.thumbBase64
            ? `url(${photo.thumbBase64})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: photo.thumbBase64 ? "blur(8px)" : undefined,
          transform: "scale(1.1)", // hide blur edges
          backgroundColor: photo.thumbBase64 ? undefined : "#262626",
        }}
      />

      {/* Layer 2: thumbnail — loads first, fades in over placeholder */}
      {isVisible && (
        <img
          src={`/api/drive/image/${photo.id}?size=thumb`}
          alt={photo.originalName}
          onLoad={handleThumbLoad}
          draggable={false}
          className={`photo-protect absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            thumbLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Layer 3: full resolution — loads after thumbnail, fades in on top */}
      {showFull && isVisible && thumbLoaded && (
        <img
          src={`/api/drive/image/${photo.id}?size=full`}
          alt={photo.originalName}
          onLoad={handleFullLoad}
          draggable={false}
          className={`photo-protect absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            fullLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Like de visitante (solo vistas públicas con LikesProvider).
          Oculto hasta hover en desktop, pero siempre visible cuando ya está
          liked para que el visitante vea sus corazones al scrollear. */}
      {likes && (
        <LikeButton
          size="sm"
          liked={likes.liked.has(photo.id)}
          onToggle={() => likes.toggle(photo.id)}
          className={`absolute bottom-2 right-2 z-10 transition-opacity ${
            likes.liked.has(photo.id)
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          }`}
        />
      )}

      {/* Hover overlay */}
      {showInfo && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
          <p className="truncate text-sm text-white">{photo.originalName}</p>
          <p className="text-xs text-neutral-300">
            {photo.width}×{photo.height}
          </p>
        </div>
      )}
    </div>
  );
}
