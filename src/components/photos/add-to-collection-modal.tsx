"use client";

import { useState, useEffect } from "react";
import type { Collection } from "@/types";

interface AddToCollectionModalProps {
  photoIds: string[];
  onClose: () => void;
  onDone: () => void;
}

export function AddToCollectionModal({
  photoIds,
  onClose,
  onDone,
}: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<(Collection & { photoCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("album");

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then(setCollections)
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (collectionId: string) => {
    await fetch(`/api/collections/${collectionId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds }),
    });
    onDone();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), type: newType }),
    });
    if (res.ok) {
      const col = await res.json();
      await handleAdd(col.id);
    }
  };

  const typeIcons: Record<string, string> = {
    album: "📷",
    roll: "🎞️",
    collection: "📁",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-sm font-medium text-white">
            Agregar {photoIds.length} foto{photoIds.length > 1 ? "s" : ""} a...
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Collection list */}
        <div className="max-h-64 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-neutral-800" />
              ))}
            </div>
          ) : (
            <>
              {collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleAdd(col.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-neutral-800"
                >
                  <span className="text-lg">{typeIcons[col.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-white">{col.name}</p>
                    <p className="text-xs text-neutral-500">
                      {col.photoCount} fotos
                    </p>
                  </div>
                </button>
              ))}
              {collections.length === 0 && !creating && (
                <p className="p-3 text-center text-sm text-neutral-500">
                  No hay colecciones. Crea una nueva.
                </p>
              )}
            </>
          )}
        </div>

        {/* Create new */}
        <div className="border-t border-neutral-800 p-3">
          {creating ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Nombre de la coleccion"
                className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:ring-1 focus:ring-neutral-600"
              />
              <div className="flex gap-2">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="rounded-md bg-neutral-800 px-2 py-1.5 text-sm text-white outline-none"
                >
                  <option value="album">Album</option>
                  <option value="roll">Rollo</option>
                  <option value="collection">Coleccion</option>
                </select>
                <button
                  onClick={handleCreate}
                  className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Crear y agregar
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-600 px-3 py-2.5 text-sm text-neutral-400 transition hover:border-neutral-400 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Crear nueva coleccion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
