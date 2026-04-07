"use client";

import { useState } from "react";
import { useSelectionStore } from "@/stores/selection-store";
import { useUIStore } from "@/stores/ui-store";
import type { Photo } from "@/types";

interface PhotoCardProps {
  photo: Photo;
  onDelete?: (id: string) => void;
  onAddToCollection?: (photoId: string) => void;
  onRemoveFromCollection?: (photoId: string) => void;
  showActions?: boolean;
  inCollection?: boolean;
}

export function PhotoCard({
  photo,
  onDelete,
  onAddToCollection,
  onRemoveFromCollection,
  showActions = true,
  inCollection = false,
}: PhotoCardProps) {
  const { selectedIds, isSelecting, toggle, startSelecting } =
    useSelectionStore();
  const { openLightbox } = useUIStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const isSelected = selectedIds.has(photo.id);

  const handleClick = () => {
    if (isSelecting) {
      toggle(photo.id);
    } else {
      openLightbox(photo.id);
    }
  };

  const handleLongPress = () => {
    if (!isSelecting) {
      startSelecting();
      toggle(photo.id);
    }
  };

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-lg bg-neutral-900 transition ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
    >
      {/* Thumbnail */}
      <div
        className="aspect-square w-full bg-neutral-800"
        style={{
          backgroundImage: photo.thumbBase64
            ? `url(${photo.thumbBase64})`
            : undefined,
          backgroundSize: "cover",
        }}
      >
        <img
          src={`/api/drive/image/${photo.id}?size=thumb`}
          alt={photo.originalName}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300"
        />
      </div>

      {/* Selection checkbox */}
      {isSelecting && (
        <div className="absolute left-2 top-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
              isSelected
                ? "border-blue-500 bg-blue-500"
                : "border-white/70 bg-black/40"
            }`}
          >
            {isSelected && (
              <svg
                className="h-3.5 w-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={3}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Action buttons — visible on hover */}
      {showActions && !isSelecting && (
        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            title="Opciones"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Context menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
            }}
          />
          <div className="absolute right-1 top-10 z-40 w-44 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
            {onAddToCollection && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onAddToCollection(photo.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-neutral-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Agregar a coleccion
              </button>
            )}
            {inCollection && onRemoveFromCollection && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onRemoveFromCollection(photo.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-neutral-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                </svg>
                Quitar de coleccion
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                startSelecting();
                toggle(photo.id);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-neutral-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Seleccionar
            </button>
            {onDelete && (
              <>
                <div className="my-1 border-t border-neutral-700" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    if (confirm("Eliminar esta foto? Se borra de Drive.")) {
                      onDelete(photo.id);
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-neutral-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Eliminar foto
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
        <p className="truncate text-xs text-white">{photo.originalName}</p>
      </div>
    </div>
  );
}
