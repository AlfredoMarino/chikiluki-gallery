"use client";

import { useState, useEffect } from "react";
import type { Photo } from "@/types";

interface PickPhotosModalProps {
  excludeIds: string[];
  onAdd: (photoIds: string[]) => void;
  onClose: () => void;
}

/**
 * Modal to pick photos from the user's library to add to a collection.
 * Shows all photos except those already in the collection.
 */
export function PickPhotosModal({
  excludeIds,
  onAdd,
  onClose,
}: PickPhotosModalProps) {
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/photos")
      .then((r) => r.json())
      .then(setAllPhotos)
      .finally(() => setLoading(false));
  }, []);

  const excludeSet = new Set(excludeIds);
  const available = allPhotos.filter((p) => !excludeSet.has(p.id));

  const togglePhoto = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-sm font-medium text-white">
            Agregar fotos a la coleccion
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Photo grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-neutral-800" />
              ))}
            </div>
          ) : available.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              Todas tus fotos ya estan en esta coleccion.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {available.map((photo) => {
                const isSelected = selected.has(photo.id);
                return (
                  <div
                    key={photo.id}
                    onClick={() => togglePhoto(photo.id)}
                    className={`relative cursor-pointer overflow-hidden rounded-lg transition ${
                      isSelected ? "ring-2 ring-blue-500" : "hover:opacity-80"
                    }`}
                  >
                    <div
                      className="aspect-square bg-neutral-800"
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
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {isSelected && (
                      <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
          <span className="text-sm text-neutral-400">
            {selected.size} seleccionadas
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={() => onAdd(Array.from(selected))}
              disabled={selected.size === 0}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-40"
            >
              Agregar {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
