"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import { BatchActions } from "@/components/photos/batch-actions";
import { AddToCollectionModal } from "@/components/photos/add-to-collection-modal";
import { useUIStore } from "@/stores/ui-store";
import Link from "next/link";
import type { Photo } from "@/types";

type View = "all" | "session";

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addToCollectionIds, setAddToCollectionIds] = useState<string[] | null>(
    null
  );
  const [view, setView] = useState<View>("session");
  const [cameraFilter, setCameraFilter] = useState<string>("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  );

  const SESSION_PREVIEW_COUNT = 5;

  const toggleSession = (sessionFolder: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionFolder)) next.delete(sessionFolder);
      else next.add(sessionFolder);
      return next;
    });
  };
  const { lightboxOpen, lightboxPhotoId, openLightbox, closeLightbox } =
    useUIStore();

  const fetchPhotos = async () => {
    try {
      const res = await fetch("/api/photos");
      if (res.ok) {
        setPhotos(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    fetchPhotos();
  };

  // Distinct cameras/years for the filter dropdowns.
  const { cameras, years } = useMemo(() => {
    const cameraSet = new Set<string>();
    const yearSet = new Set<number>();
    for (const p of photos) {
      if (p.camera) cameraSet.add(p.camera);
      if (p.sessionYear) yearSet.add(p.sessionYear);
    }
    return {
      cameras: Array.from(cameraSet).sort(),
      years: Array.from(yearSet).sort((a, b) => b - a),
    };
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (cameraFilter && p.camera !== cameraFilter) return false;
      if (yearFilter && String(p.sessionYear) !== yearFilter) return false;
      return true;
    });
  }, [photos, cameraFilter, yearFilter]);

  // Group filtered photos by sessionFolder. Groups are ordered by the max
  // createdAt in each group (most recent first); photos within a group by
  // sessionSeq ascending so they appear in roll order.
  const sessionGroups = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    for (const p of filteredPhotos) {
      const key = p.sessionFolder ?? "(sin sesión)";
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .map(([sessionFolder, arr]) => {
        arr.sort((a, b) => (a.sessionSeq ?? 0) - (b.sessionSeq ?? 0));
        const maxCreated = arr.reduce(
          (max, p) =>
            new Date(p.createdAt).getTime() > max
              ? new Date(p.createdAt).getTime()
              : max,
          0
        );
        return { sessionFolder, photos: arr, maxCreated };
      })
      .sort((a, b) => b.maxCreated - a.maxCreated);
  }, [filteredPhotos]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Mis fotos</h1>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis fotos</h1>
        <Link
          href="/upload"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 active:scale-[0.98]"
        >
          Subir fotos
        </Link>
      </div>

      {/* Toolbar: view toggle + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-neutral-800">
          {(["session", "all"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                view === v
                  ? "bg-white text-black"
                  : "bg-black text-neutral-400 hover:text-white"
              }`}
            >
              {v === "session" ? "Por sesión" : "Todas"}
            </button>
          ))}
        </div>

        {cameras.length > 0 && (
          <select
            value={cameraFilter}
            onChange={(e) => setCameraFilter(e.target.value)}
            className="rounded-md border border-neutral-800 bg-black px-2 py-1 text-xs text-white"
          >
            <option value="">Todas las cámaras</option>
            {cameras.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {years.length > 0 && (
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-md border border-neutral-800 bg-black px-2 py-1 text-xs text-white"
          >
            <option value="">Todos los años</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {view === "all" ? (
        <PhotoGrid
          photos={filteredPhotos}
          onDelete={handleDelete}
          onAddToCollection={(photoId) => setAddToCollectionIds([photoId])}
        />
      ) : (
        <div className="space-y-8">
          {sessionGroups.length === 0 && (
            <p className="text-sm text-neutral-500">No hay fotos.</p>
          )}
          {sessionGroups.map((group) => {
            const isExpanded = expandedSessions.has(group.sessionFolder);
            const hasMore = group.photos.length > SESSION_PREVIEW_COUNT;
            const visiblePhotos =
              isExpanded || !hasMore
                ? group.photos
                : group.photos.slice(0, SESSION_PREVIEW_COUNT);
            const hiddenCount = group.photos.length - SESSION_PREVIEW_COUNT;

            return (
              <section key={group.sessionFolder} className="space-y-3">
                <h2 className="font-mono text-sm text-neutral-300">
                  {group.sessionFolder}{" "}
                  <span className="text-neutral-600">
                    · {group.photos.length}
                  </span>
                </h2>
                <PhotoGrid
                  photos={visiblePhotos}
                  onDelete={handleDelete}
                  onAddToCollection={(photoId) =>
                    setAddToCollectionIds([photoId])
                  }
                />
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => toggleSession(group.sessionFolder)}
                    className="text-xs text-neutral-400 transition hover:text-white"
                  >
                    {isExpanded
                      ? "▲ Mostrar menos"
                      : `▼ Ver ${hiddenCount} más`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      <BatchActions onRefresh={fetchPhotos} />

      {lightboxOpen && (
        <PhotoLightbox
          photos={filteredPhotos}
          currentId={lightboxPhotoId}
          onClose={closeLightbox}
          onNavigate={openLightbox}
        />
      )}

      {addToCollectionIds && (
        <AddToCollectionModal
          photoIds={addToCollectionIds}
          onClose={() => setAddToCollectionIds(null)}
          onDone={() => {
            setAddToCollectionIds(null);
            fetchPhotos();
          }}
        />
      )}
    </div>
  );
}
