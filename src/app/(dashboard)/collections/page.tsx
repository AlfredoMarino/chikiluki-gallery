"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Collection } from "@/types";

interface CollectionWithCount extends Collection {
  photoCount: number;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections");
      if (res.ok) setCollections(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;

    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });

    if (res.ok) {
      setShowCreate(false);
      fetchCollections();
    }
  };

  const typeLabels: Record<string, string> = {
    album: "Album",
    roll: "Rollo",
    collection: "Coleccion",
  };

  const visibilityIcons: Record<string, string> = {
    private: "🔒",
    public: "🌐",
    unlisted: "🔗",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Colecciones</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 active:scale-[0.98]"
        >
          Nueva coleccion
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-end gap-3 rounded-lg bg-neutral-900 p-4"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-400">
              Nombre
            </label>
            <input
              name="name"
              required
              placeholder="Ej: Fujifilm 100 - Rollo 1"
              className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:ring-1 focus:ring-neutral-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Tipo</label>
            <select
              name="type"
              className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="album">Album</option>
              <option value="roll">Rollo</option>
              <option value="collection">Coleccion</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Collection list */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-neutral-800"
            />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center text-neutral-500">
          <p className="text-sm">No hay colecciones</p>
          <p className="mt-1 text-xs">
            Crea tu primera coleccion para organizar tus fotos
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((col) => (
            <Link
              key={col.id}
              href={`/collections/${col.id}`}
              className="group rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-white group-hover:text-blue-400">
                    {col.name}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {typeLabels[col.type]} · {col.photoCount} fotos
                  </p>
                </div>
                <span className="text-sm" title={col.visibility}>
                  {visibilityIcons[col.visibility]}
                </span>
              </div>
              {col.description && (
                <p className="mt-2 line-clamp-2 text-xs text-neutral-400">
                  {col.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
