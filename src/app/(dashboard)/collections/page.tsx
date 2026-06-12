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
        <h1 className="text-2xl font-light tracking-tight">Colecciones</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 active:scale-[0.98]"
        >
          Nueva coleccion
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-end gap-3 rounded-sm border border-white/10 p-4"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-400">
              Nombre
            </label>
            <input
              name="name"
              required
              placeholder="Ej: Fujifilm 100 - Rollo 1"
              className="w-full rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-white/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Tipo</label>
            <select
              name="type"
              className="rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-white/40"
            >
              <option value="album">Album</option>
              <option value="roll">Rollo</option>
              <option value="collection">Coleccion</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200"
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
              className="skeleton h-24 rounded-sm"
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
              className="group rounded-sm border border-white/10 p-4 transition hover:border-white/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-light text-white">{col.name}</h3>
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
