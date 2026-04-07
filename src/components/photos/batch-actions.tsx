"use client";

import { useState, useEffect } from "react";
import { useSelectionStore } from "@/stores/selection-store";
import type { Collection } from "@/types";

interface BatchActionsProps {
  onRefresh: () => void;
}

export function BatchActions({ onRefresh }: BatchActionsProps) {
  const { selectedIds, isSelecting, clear } = useSelectionStore();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showAddTo, setShowAddTo] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    if (isSelecting) {
      fetch("/api/collections")
        .then((r) => r.json())
        .then(setCollections);
    }
  }, [isSelecting]);

  if (!isSelecting || selectedIds.size === 0) return null;

  const ids = Array.from(selectedIds);

  const handleAddToCollection = async (collectionId: string) => {
    await fetch(`/api/collections/${collectionId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: ids }),
    });
    setShowAddTo(false);
    clear();
    onRefresh();
  };

  const handleTagSelected = async () => {
    if (!tagInput.trim()) return;
    for (const photoId of ids) {
      await fetch(`/api/photos/${photoId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagInput.trim() }),
      });
    }
    setTagInput("");
    setShowTagInput(false);
    clear();
    onRefresh();
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Eliminar ${ids.length} fotos? Se borran de Drive tambien.`))
      return;
    for (const photoId of ids) {
      await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    }
    clear();
    onRefresh();
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 px-4 md:bottom-4">
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 shadow-2xl">
        <span className="text-sm text-neutral-300">
          {selectedIds.size} seleccionadas
        </span>
        <div className="flex-1" />

        {/* Add to collection */}
        <div className="relative">
          <button
            onClick={() => {
              setShowAddTo(!showAddTo);
              setShowTagInput(false);
            }}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
          >
            + Coleccion
          </button>
          {showAddTo && (
            <div className="absolute bottom-full right-0 mb-2 w-56 rounded-lg border border-neutral-700 bg-neutral-800 p-2 shadow-xl">
              {collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleAddToCollection(col.id)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-white hover:bg-neutral-700"
                >
                  {col.name}
                </button>
              ))}
              {collections.length === 0 && (
                <p className="p-2 text-xs text-neutral-500">
                  No hay colecciones
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tag */}
        <div className="relative">
          <button
            onClick={() => {
              setShowTagInput(!showTagInput);
              setShowAddTo(false);
            }}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
          >
            Etiquetar
          </button>
          {showTagInput && (
            <div className="absolute bottom-full right-0 mb-2 flex w-56 gap-2 rounded-lg border border-neutral-700 bg-neutral-800 p-2 shadow-xl">
              <input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTagSelected()}
                placeholder="Nombre del tag"
                className="flex-1 rounded bg-neutral-700 px-2 py-1 text-sm text-white outline-none"
              />
              <button
                onClick={handleTagSelected}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
              >
                OK
              </button>
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={handleDeleteSelected}
          className="rounded-md bg-red-900/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900"
        >
          Eliminar
        </button>

        {/* Cancel */}
        <button
          onClick={clear}
          className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
