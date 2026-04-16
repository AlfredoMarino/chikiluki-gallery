"use client";

import { useEffect, useState, use, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LayoutEngine } from "@/components/layouts/layout-engine";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import type { Photo, Collection, LayoutConfig } from "@/types";

interface CollectionWithLayout extends Collection {
  layout: LayoutConfig | null;
}

const layoutOptions = [
  { value: "grid", label: "Grid", desc: "Cuadricula uniforme", icon: "▦" },
  { value: "masonry", label: "Masonry", desc: "Alturas variables", icon: "▥" },
  { value: "list", label: "Lista", desc: "Una por fila", icon: "▤" },
  { value: "collage", label: "Collage", desc: "Tamaños mixtos", icon: "▧" },
];

const mobileBehaviorOptions = [
  { value: "stack", label: "Apilar verticalmente" },
  { value: "scroll-horizontal", label: "Scroll horizontal" },
  { value: "rotate-hint", label: "Sugerir rotar" },
];

const previewModes = [
  { value: "desktop", label: "Desktop", width: "100%" },
  { value: "tablet", label: "Tablet", width: "768px" },
  { value: "mobile", label: "Movil", width: "375px" },
] as const;

type PreviewMode = (typeof previewModes)[number]["value"];

// --- Sortable thumbnail item for drag-and-drop ---
function SortablePhotoThumb({
  photo,
  span,
  maxSpan,
  onChangeSpan,
}: {
  photo: Photo;
  span: number;
  maxSpan: number;
  onChangeSpan: (photoId: string, span: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden bg-neutral-900 ${
        isDragging ? "ring-2 ring-blue-500" : ""
      }`}
    >
      {/* Drag handle — the image itself */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <div
          className="aspect-square bg-neutral-800"
          style={{
            backgroundImage: photo.thumbBase64
              ? `url(${photo.thumbBase64})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <img
            src={`/api/drive/image/${photo.id}?size=thumb`}
            alt={photo.originalName}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {/* Span controls overlay — bottom */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 py-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChangeSpan(photo.id, Math.max(1, span - 1));
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-white hover:bg-white/20"
          title="Reducir tamaño"
        >
          −
        </button>
        <span className="text-[10px] text-neutral-300">{span}x</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChangeSpan(photo.id, Math.min(maxSpan, span + 1));
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-white hover:bg-white/20"
          title="Ampliar tamaño"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function CollectionSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionWithLayout | null>(
    null
  );
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");

  // Layout form state
  const [form, setForm] = useState({
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

  // dnd-kit sensors — require 8px movement before starting drag to allow clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    Promise.all([
      fetch(`/api/collections/${id}`).then((r) => r.json()),
      fetch(`/api/collections/${id}/photos`).then((r) => r.json()),
    ])
      .then(([col, pht]) => {
        setCollection(col);
        setPhotos(pht);
        if (col.layout) {
          setForm({
            layoutType: col.layout.layoutType || "grid",
            columnsMobile: col.layout.columnsMobile ?? 2,
            columnsTablet: col.layout.columnsTablet ?? 3,
            columnsDesktop: col.layout.columnsDesktop ?? 4,
            gap: col.layout.gap ?? 8,
            forceOrientation: col.layout.forceOrientation ?? false,
            mobileBehavior: col.layout.mobileBehavior ?? {
              landscapeInPortrait: "stack",
              maxPhotosPerRow: 1,
            },
            photoOverrides: col.layout.photoOverrides ?? {},
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Build live LayoutConfig from form state
  const liveConfig = useMemo(
    (): LayoutConfig => ({
      id: collection?.layout?.id || "",
      collectionId: id,
      layoutType: form.layoutType,
      columnsMobile: form.columnsMobile,
      columnsTablet: form.columnsTablet,
      columnsDesktop: form.columnsDesktop,
      gap: form.gap,
      forceOrientation: form.forceOrientation,
      mobileBehavior: form.mobileBehavior,
      photoOverrides: form.photoOverrides,
    }),
    [form, id, collection]
  );

  // Which columns value to use in the preview based on preview mode
  const previewColumns = useMemo(() => {
    if (previewMode === "mobile") return form.columnsMobile;
    if (previewMode === "tablet") return form.columnsTablet;
    return form.columnsDesktop;
  }, [previewMode, form.columnsMobile, form.columnsTablet, form.columnsDesktop]);

  // Override the config for the preview to simulate the correct device columns
  const previewConfig = useMemo((): LayoutConfig => {
    if (previewMode === "desktop") return liveConfig;
    // For mobile/tablet preview, override all column counts to match that device
    return {
      ...liveConfig,
      columnsMobile: previewColumns,
      columnsTablet: previewColumns,
      columnsDesktop: previewColumns,
    };
  }, [liveConfig, previewMode, previewColumns]);

  const update = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = photos.findIndex((p) => p.id === active.id);
      const newIndex = photos.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(photos, oldIndex, newIndex);
      setPhotos(reordered);
      setSaved(false);

      // Persist order to backend
      fetch(`/api/collections/${id}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: reordered.map((p) => p.id) }),
      });
    },
    [photos, id]
  );

  const handleChangeSpan = useCallback(
    (photoId: string, span: number) => {
      const newOverrides = { ...form.photoOverrides };
      if (span <= 1) {
        delete newOverrides[photoId];
      } else {
        newOverrides[photoId] = {
          ...newOverrides[photoId],
          span,
        };
      }
      update("photoOverrides", newOverrides);
    },
    [form.photoOverrides, update]
  );

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      await fetch(`/api/collections/${id}/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

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
    return <div className="h-96 animate-pulse rounded-lg bg-neutral-800" />;
  }

  if (!collection) {
    return <div className="text-neutral-500">Coleccion no encontrada</div>;
  }

  const previewWidth =
    previewModes.find((m) => m.value === previewMode)?.width || "100%";

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
        <h1 className="mt-2 text-2xl font-bold">Configuracion</h1>
      </div>

      {/* Two column layout: controls left, preview right */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Controls panel */}
        <div className="w-full space-y-6 lg:w-80 lg:shrink-0">
          {/* Layout type selector */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-neutral-300">
              Tipo de layout
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {layoutOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update("layoutType", opt.value)}
                  className={`rounded-lg border p-3 text-left transition ${
                    form.layoutType === opt.value
                      ? "border-blue-500 bg-blue-950/50"
                      : "border-neutral-700 hover:border-neutral-500"
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <p className="mt-1 text-xs font-medium text-white">
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-neutral-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Columns */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-neutral-300">
              Columnas
            </h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-neutral-400">Movil</label>
                  <span className="text-xs text-neutral-500">
                    {form.columnsMobile}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={form.columnsMobile}
                  onChange={(e) =>
                    update("columnsMobile", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-neutral-400">Tablet</label>
                  <span className="text-xs text-neutral-500">
                    {form.columnsTablet}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={form.columnsTablet}
                  onChange={(e) =>
                    update("columnsTablet", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-neutral-400">Desktop</label>
                  <span className="text-xs text-neutral-500">
                    {form.columnsDesktop}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={form.columnsDesktop}
                  onChange={(e) =>
                    update("columnsDesktop", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </section>

          {/* Gap */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-300">Espacio</h2>
              <span className="text-xs text-neutral-500">{form.gap}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={32}
              step={2}
              value={form.gap}
              onChange={(e) => update("gap", parseInt(e.target.value))}
              className="mt-2 w-full"
            />
          </section>

          {/* Orientation */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-neutral-300">
                  Forzar orientacion
                </h2>
                <p className="mt-0.5 text-[10px] text-neutral-500">
                  Fotos landscape se ven mejor en horizontal
                </p>
              </div>
              <button
                onClick={() =>
                  update("forceOrientation", !form.forceOrientation)
                }
                className={`relative h-6 w-11 rounded-full transition ${
                  form.forceOrientation ? "bg-blue-600" : "bg-neutral-700"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    form.forceOrientation ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-neutral-400">
                Landscape en movil portrait
              </label>
              <div className="flex flex-wrap gap-1.5">
                {mobileBehaviorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      update("mobileBehavior", {
                        ...form.mobileBehavior,
                        landscapeInPortrait: opt.value,
                      })
                    }
                    className={`rounded-md border px-2 py-1 text-[10px] transition ${
                      form.mobileBehavior?.landscapeInPortrait === opt.value
                        ? "border-blue-500 bg-blue-950/50 text-white"
                        : "border-neutral-700 text-neutral-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Save button */}
          <button
            onClick={handleSaveLayout}
            disabled={saving}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
              saved
                ? "bg-green-600 text-white"
                : "bg-blue-600 text-white hover:bg-blue-500"
            } disabled:opacity-50`}
          >
            {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar layout"}
          </button>
        </div>

        {/* Right panel: preview + reorder */}
        <div className="flex-1 space-y-6">
          {/* Live preview */}
          <div className="sticky top-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-300">
                Vista previa
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500">
                  {photos.length} fotos · {form.layoutType}
                </span>
                {/* Device preview toggle */}
                <div className="flex rounded-md border border-neutral-700">
                  {previewModes.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setPreviewMode(mode.value)}
                      className={`px-2 py-1 text-[10px] transition ${
                        previewMode === mode.value
                          ? "bg-neutral-700 text-white"
                          : "text-neutral-400 hover:text-white"
                      }`}
                      title={`Vista previa ${mode.label}`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview container — width constrained for device simulation */}
            <div className="flex justify-center">
              <div
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 transition-all duration-300"
                style={{ maxWidth: previewWidth }}
              >
                {photos.length > 0 ? (
                  <LayoutEngine
                    photos={photos}
                    layout={previewConfig}
                    onPhotoClick={setLightboxId}
                    rounded={false}
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
                    Agrega fotos a la coleccion para ver el preview
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Drag-and-drop reorder + span controls */}
          {photos.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-neutral-300">
                  Orden y tamaño
                </h2>
                <p className="text-[10px] text-neutral-500">
                  Arrastra para reordenar · hover para cambiar tamaño
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={photos.map((p) => p.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6">
                      {photos.map((photo) => (
                        <SortablePhotoThumb
                          key={photo.id}
                          photo={photo}
                          span={form.photoOverrides[photo.id]?.span || 1}
                          maxSpan={form.columnsDesktop}
                          onChangeSpan={handleChangeSpan}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collection details */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-300">
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
              className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-neutral-600"
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
              className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-neutral-600"
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
                className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white outline-none"
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
                className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="album">Album</option>
                <option value="roll">Rollo</option>
                <option value="collection">Coleccion</option>
              </select>
            </div>
          </div>

          {/* Share link */}
          {collection.visibility !== "private" && (
            <div className="rounded-md bg-neutral-800 p-3">
              <p className="mb-1 text-xs text-neutral-400">
                Link para compartir
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-xs text-blue-400">
                  {collection.visibility === "public"
                    ? `${typeof window !== "undefined" ? window.location.origin : ""}/gallery/me/${collection.slug}`
                    : `${typeof window !== "undefined" ? window.location.origin : ""}/s/${collection.shareToken}`}
                </code>
                <button
                  onClick={() => {
                    const url =
                      collection.visibility === "public"
                        ? `${window.location.origin}/gallery/me/${collection.slug}`
                        : `${window.location.origin}/s/${collection.shareToken}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="shrink-0 rounded bg-neutral-700 px-2 py-1 text-xs text-white hover:bg-neutral-600"
                >
                  Copiar
                </button>
              </div>

              {/* Variante que abre presentación al entrar. Sólo tiene sentido
                  para links privados (/s/{token}); en colecciones públicas
                  preferimos no enterrar la galería bajo un modal. */}
              {collection.visibility === "unlisted" && (
                <div className="mt-2 flex items-center gap-2 border-t border-neutral-700 pt-2">
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
                    className="shrink-0 rounded bg-neutral-700 px-2 py-1 text-[10px] text-white hover:bg-neutral-600"
                  >
                    Copiar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-red-900/50 bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-red-400">Zona peligrosa</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Eliminar la coleccion no borra las fotos, solo la agrupacion.
        </p>
        <button
          onClick={handleDelete}
          className="mt-3 rounded-md border border-red-800 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950"
        >
          Eliminar coleccion
        </button>
      </section>

      {/* Lightbox for preview */}
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
