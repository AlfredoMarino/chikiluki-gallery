"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import { EditableLayoutCanvas } from "@/components/layouts/editable-layout-canvas";
import {
  LayoutInspector,
  type Device,
  type SaveStatus,
  type LayoutForm,
} from "@/components/collections/layout-inspector";
import Link from "next/link";
import type { Photo, Collection, LayoutConfig } from "@/types";

interface CollectionWithLayout extends Collection {
  layout: LayoutConfig | null;
}

const deviceWidths: Record<Device, string> = {
  mobile: "375px",
  tablet: "768px",
  desktop: "100%",
};

export default function CollectionSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "";
  const [collection, setCollection] = useState<CollectionWithLayout | null>(
    null
  );
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Dispositivo simulado: controla el ancho del lienzo Y qué campo de
  // columnas edita el slider del inspector. En pantallas pequeñas arranca
  // en móvil. Es estado de UI — cambiarlo no guarda nada.
  const [device, setDevice] = useState<Device>(() =>
    typeof window !== "undefined" && window.innerWidth < 640
      ? "mobile"
      : "desktop"
  );

  // Layout form state
  const [form, setForm] = useState<LayoutForm>({
    layoutType: "grid",
    columnsMobile: 2,
    columnsTablet: 3,
    columnsDesktop: 4,
    gap: 8,
    forceOrientation: false,
    mobileBehavior: {
      landscapeInPortrait: "stack" as const,
      maxPhotosPerRow: 1,
    },
    photoOverrides: {} as Record<string, { span: number; aspect?: string }>,
  });

  // Snapshot del último form persistido — el autosave solo dispara cuando
  // el form difiere de esto. null = aún no cargó (no guardar nada).
  const lastSavedForm = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/collections/${id}`).then((r) => r.json()),
      fetch(`/api/collections/${id}/photos`).then((r) => r.json()),
    ])
      .then(([col, pht]) => {
        setCollection(col);
        setPhotos(pht);
        let initialForm = null;
        if (col.layout) {
          initialForm = {
            layoutType: col.layout.layoutType || "grid",
            columnsMobile: col.layout.columnsMobile ?? 2,
            columnsTablet: col.layout.columnsTablet ?? 3,
            columnsDesktop: col.layout.columnsDesktop ?? 4,
            gap: col.layout.gap ?? 8,
            forceOrientation: col.layout.forceOrientation ?? false,
            mobileBehavior: col.layout.mobileBehavior ?? {
              landscapeInPortrait: "stack" as const,
              maxPhotosPerRow: 1,
            },
            photoOverrides: col.layout.photoOverrides ?? {},
          };
          setForm(initialForm);
          lastSavedForm.current = JSON.stringify(initialForm);
        }
      })
      .finally(() => {
        setLoading(false);
        // Colección sin layout: el form por defecto es el punto de partida.
        if (lastSavedForm.current === null) {
          setForm((f) => {
            lastSavedForm.current = JSON.stringify(f);
            return f;
          });
        }
      });
  }, [id]);

  // ── Autosave del layout: debounce 800ms cuando el form difiere del
  // último estado guardado. La carga inicial no dispara PATCH.
  useEffect(() => {
    const serialized = JSON.stringify(form);
    if (lastSavedForm.current === null || lastSavedForm.current === serialized) {
      return;
    }
    setSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/collections/${id}/layout`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) lastSavedForm.current = serialized;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [form, id]);

  const update = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Columnas resueltas para el dispositivo simulado.
  const resolvedColumns =
    device === "mobile"
      ? form.columnsMobile
      : device === "tablet"
        ? form.columnsTablet
        : form.columnsDesktop;

  const handleReorder = useCallback(
    (photoIds: string[]) => {
      setPhotos((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        return photoIds.map((pid) => byId.get(pid)!).filter(Boolean);
      });
      // El orden persiste al instante, igual que antes.
      fetch(`/api/collections/${id}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds }),
      });
    },
    [id]
  );

  const handleChangeSpan = useCallback(
    (photoId: string, span: number) => {
      setForm((prev) => {
        const newOverrides = { ...prev.photoOverrides };
        if (span <= 1) {
          delete newOverrides[photoId];
        } else {
          newOverrides[photoId] = { ...newOverrides[photoId], span };
        }
        return { ...prev, photoOverrides: newOverrides };
      });
    },
    []
  );

  const handleUpdateCollection = async (field: string, value: unknown) => {
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const res = await fetch(`/api/collections/${id}`);
    if (res.ok) setCollection(await res.json());
  };

  const handleDelete = async () => {
    if (!confirm("Eliminar esta coleccion? Las fotos no se borran.")) return;
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    router.push("/collections");
  };

  if (loading) {
    return <div className="skeleton h-96 rounded-sm" />;
  }

  if (!collection) {
    return <div className="text-neutral-500">Coleccion no encontrada</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/collections/${id}`}
          className="text-sm text-neutral-500 hover:text-white"
        >
          &larr; {collection.name}
        </Link>
        <h1 className="mt-2 text-2xl font-light tracking-tight">Configuracion</h1>
      </div>

      {/* Collection details */}
      <section className="rounded-sm border border-white/10 p-4">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
          Detalles de la coleccion
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-400">
              Nombre
            </label>
            <input
              defaultValue={collection.name}
              onBlur={(e) => handleUpdateCollection("name", e.target.value)}
              className="w-full rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-white/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">
              Descripcion
            </label>
            <textarea
              defaultValue={collection.description || ""}
              onBlur={(e) =>
                handleUpdateCollection("description", e.target.value)
              }
              rows={2}
              className="w-full rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-white/40"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-neutral-400">
                Visibilidad
              </label>
              <select
                value={collection.visibility}
                onChange={(e) =>
                  handleUpdateCollection("visibility", e.target.value)
                }
                className="w-full rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-white/40"
              >
                <option value="private">Privada</option>
                <option value="public">Publica</option>
                <option value="unlisted">Oculta (con link)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-neutral-400">
                Tipo
              </label>
              <select
                value={collection.type}
                onChange={(e) =>
                  handleUpdateCollection("type", e.target.value)
                }
                className="w-full rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-white/40"
              >
                <option value="album">Album</option>
                <option value="roll">Rollo</option>
                <option value="collection">Coleccion</option>
              </select>
            </div>
          </div>

          {/* Share link */}
          {collection.visibility !== "private" &&
            (collection.visibility !== "public" || userName) && (
            <div className="rounded-sm border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-1 text-xs text-neutral-400">
                Link para compartir
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-xs text-neutral-300">
                  {collection.visibility === "public"
                    ? `${typeof window !== "undefined" ? window.location.origin : ""}/gallery/${encodeURIComponent(userName)}/${collection.slug}`
                    : `${typeof window !== "undefined" ? window.location.origin : ""}/s/${collection.shareToken}`}
                </code>
                <button
                  onClick={() => {
                    const url =
                      collection.visibility === "public"
                        ? `${window.location.origin}/gallery/${encodeURIComponent(userName)}/${collection.slug}`
                        : `${window.location.origin}/s/${collection.shareToken}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="shrink-0 rounded-sm border border-white/15 px-2 py-1 text-xs text-neutral-300 transition hover:border-white/40 hover:text-white"
                >
                  Copiar
                </button>
              </div>

              {/* Variante que abre presentación al entrar. Sólo tiene sentido
                  para links privados (/s/{token}); en colecciones públicas
                  preferimos no enterrar la galería bajo un modal. */}
              {collection.visibility === "unlisted" && (
                <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
                  <p className="flex-1 text-[10px] text-neutral-500">
                    ¿Abrir directamente en modo presentación?
                  </p>
                  <code className="truncate text-[10px] text-neutral-400">
                    …/s/{collection.shareToken}?present=1
                  </code>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/s/${collection.shareToken}?present=1`;
                      navigator.clipboard.writeText(url);
                    }}
                    className="shrink-0 rounded-sm border border-white/15 px-2 py-1 text-[10px] text-neutral-300 transition hover:border-white/40 hover:text-white"
                  >
                    Copiar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Lienzo editable (izquierda) + inspector (derecha) */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Canvas: ES la vista previa y se edita directamente sobre ella */}
        <div className="min-w-0 flex-1">
          <div className="flex justify-center">
            <div
              className="w-full rounded-sm border border-white/10 bg-black p-3 transition-all duration-300"
              style={{ maxWidth: deviceWidths[device] }}
            >
              <EditableLayoutCanvas
                photos={photos}
                layoutType={form.layoutType}
                columns={resolvedColumns}
                gap={form.gap}
                photoOverrides={form.photoOverrides}
                maxSpan={resolvedColumns}
                onReorder={handleReorder}
                onChangeSpan={handleChangeSpan}
                onOpenLightbox={setLightboxId}
              />
            </div>
          </div>
        </div>

        {/* Inspector */}
        <div className="w-full lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:w-80 lg:shrink-0 lg:self-start lg:overflow-y-auto">
          <LayoutInspector
            form={form}
            device={device}
            onDeviceChange={setDevice}
            update={update}
            saveStatus={saveStatus}
            photoCount={photos.length}
          />
        </div>
      </div>

      {/* Danger zone */}
      <section className="rounded-sm border border-red-900/50 p-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-red-400/90">Zona peligrosa</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Eliminar la coleccion no borra las fotos, solo la agrupacion.
        </p>
        <button
          onClick={handleDelete}
          className="mt-3 rounded-sm border border-red-900/60 px-4 py-2 text-sm text-red-400/90 transition hover:border-red-700 hover:text-red-300"
        >
          Eliminar coleccion
        </button>
      </section>

      {/* Lightbox */}
      {lightboxId && (
        <PhotoLightbox
          photos={photos}
          currentId={lightboxId}
          onClose={() => setLightboxId(null)}
          onNavigate={setLightboxId}
        />
      )}
    </div>
  );
}
