"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { SortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PhotoItem } from "./photo-item";
import type { Photo } from "@/types";

/**
 * Lienzo único de la configuración de colecciones: ES la vista previa del
 * layout real Y permite editar directamente sobre ella (arrastrar para
 * reordenar; en collage, seleccionar un tile para cambiar su tamaño).
 *
 * Replica la geometría de los 4 layouts públicos en vez de modificarlos:
 * el render de visitantes queda intacto y aquí controlamos columnas
 * resueltas (sin useBreakpointColumns, que mide la ventana y no el frame
 * simulado del dispositivo).
 *
 * Estrategias dnd por layout:
 * - grid → rectSortingStrategy (tiles uniformes, reflow en vivo preciso)
 * - list → verticalListSortingStrategy
 * - collage/masonry → estrategia no-op + DragOverlay: los spans variables
 *   (collage) o el orden visual ≠ orden de array (masonry) rompen el
 *   preview de rectSorting; los tiles se quedan quietos, el overlay sigue
 *   el puntero y el tile destino se marca con un ring.
 */

interface EditableLayoutCanvasProps {
  photos: Photo[];
  layoutType: string;
  /** Columnas ya resueltas para el dispositivo simulado. */
  columns: number;
  gap: number;
  photoOverrides: Record<string, { span: number; aspect?: string }>;
  /** Tope del stepper de tamaño (= columnas del dispositivo activo). */
  maxSpan: number;
  onReorder: (photoIds: string[]) => void;
  onChangeSpan: (photoId: string, span: number) => void;
  onOpenLightbox: (photoId: string) => void;
}

// Estrategia que no mueve nada durante el drag — el DragOverlay es el
// único feedback de movimiento y el drop decide.
const noopStrategy: SortingStrategy = () => null;

export function EditableLayoutCanvas({
  photos,
  layoutType,
  columns,
  gap,
  photoOverrides,
  maxSpan,
  onReorder,
  onChangeSpan,
  onOpenLightbox,
}: EditableLayoutCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Selección para editar tamaño — solo aplica en collage.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sensors = useSensors(
    // 8px de umbral: un click limpio sigue siendo click (lightbox/selección).
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Long-press en touch para no secuestrar el scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const isCollage = layoutType === "collage";

  // Escape deselecciona.
  useEffect(() => {
    if (!selectedId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  // Al cambiar de layout, la selección deja de tener sentido.
  useEffect(() => {
    setSelectedId(null);
  }, [layoutType]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setSelectedId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = photos.findIndex((p) => p.id === active.id);
      const newIndex = photos.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      onReorder(arrayMove(photos, oldIndex, newIndex).map((p) => p.id));
    },
    [photos, onReorder]
  );

  const handleTileClick = useCallback(
    (photoId: string) => {
      if (isCollage) {
        setSelectedId((curr) => (curr === photoId ? null : photoId));
      } else {
        onOpenLightbox(photoId);
      }
    },
    [isCollage, onOpenLightbox]
  );

  const strategy =
    layoutType === "grid"
      ? rectSortingStrategy
      : layoutType === "list"
        ? verticalListSortingStrategy
        : noopStrategy;

  // Distribución masonry (mismo algoritmo shortest-column que el layout público).
  const masonryColumns = useMemo(() => {
    if (layoutType !== "masonry") return null;
    const cols: Photo[][] = Array.from({ length: columns }, () => []);
    const heights = new Array(columns).fill(0);
    for (const photo of photos) {
      const shortest = heights.indexOf(Math.min(...heights));
      cols[shortest].push(photo);
      heights[shortest] += photo.height / photo.width;
    }
    return cols;
  }, [layoutType, photos, columns]);

  const activePhoto = activeId ? photos.find((p) => p.id === activeId) : null;

  if (photos.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
        Agrega fotos a la coleccion para ver el preview
      </div>
    );
  }

  const renderTile = (photo: Photo) => {
    const override = photoOverrides?.[photo.id];
    const span = isCollage ? Math.min(override?.span || 1, columns) : 1;

    return (
      <SortableTile
        key={photo.id}
        photo={photo}
        aspectRatio={
          layoutType === "grid"
            ? "1/1"
            : isCollage
              ? override?.aspect || `${photo.width}/${photo.height}`
              : `${photo.width}/${photo.height}`
        }
        style={
          isCollage
            ? {
                gridColumn: `span ${span}`,
                gridRow: span > 1 ? `span ${Math.ceil(span * 0.75)}` : undefined,
              }
            : undefined
        }
        fillHeight={isCollage}
        selected={isCollage && selectedId === photo.id}
        showOverRing={strategy === noopStrategy}
        onClick={() => handleTileClick(photo.id)}
      >
        {isCollage && selectedId === photo.id && (
          <SpanStepper
            span={span}
            maxSpan={maxSpan}
            onChange={(s) => onChangeSpan(photo.id, s)}
            onView={() => onOpenLightbox(photo.id)}
          />
        )}
      </SortableTile>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={photos.map((p) => p.id)} strategy={strategy}>
        {layoutType === "masonry" && masonryColumns ? (
          <div className="flex" style={{ gap: `${gap}px` }}>
            {masonryColumns.map((column, colIdx) => (
              <div
                key={colIdx}
                className="flex flex-1 flex-col"
                style={{ gap: `${gap}px` }}
              >
                {column.map(renderTile)}
              </div>
            ))}
          </div>
        ) : layoutType === "list" ? (
          <div
            className="mx-auto flex max-w-3xl flex-col"
            style={{ gap: `${gap}px` }}
          >
            {photos.map(renderTile)}
          </div>
        ) : (
          <div
            className="grid"
            style={{
              gap: `${gap}px`,
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              ...(isCollage ? { gridAutoRows: "200px" } : {}),
            }}
          >
            {photos.map(renderTile)}
          </div>
        )}
      </SortableContext>

      {/* Snapshot estático que sigue el puntero — evita pelearse con los
          fades de carga progresiva de PhotoItem. */}
      <DragOverlay>
        {activePhoto && (
          <div className="w-32 overflow-hidden ring-2 ring-white shadow-2xl">
            <img
              src={`/api/drive/image/${activePhoto.id}?size=thumb`}
              alt=""
              draggable={false}
              className="photo-protect aspect-square h-auto w-full object-cover"
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Tile sortable ───────────────────────────────────────

function SortableTile({
  photo,
  aspectRatio,
  style,
  fillHeight,
  selected,
  showOverRing,
  onClick,
  children,
}: {
  photo: Photo;
  aspectRatio: string;
  style?: React.CSSProperties;
  fillHeight?: boolean;
  selected?: boolean;
  showOverRing?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: photo.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
        transition,
        touchAction: "manipulation",
      }}
      className={`relative ${isDragging ? "opacity-40" : ""} ${
        selected
          ? "ring-2 ring-white ring-offset-2 ring-offset-black"
          : showOverRing && isOver
            ? "ring-2 ring-white/60 ring-offset-2 ring-offset-black"
            : ""
      }`}
    >
      <PhotoItem
        photo={photo}
        onClick={onClick}
        aspectRatio={aspectRatio}
        showInfo
        size="thumb"
        rounded={false}
        className={fillHeight ? "h-full" : ""}
      />
      {children}
    </div>
  );
}

// ─── Stepper de tamaño (solo collage) ────────────────────

function SpanStepper({
  span,
  maxSpan,
  onChange,
  onView,
}: {
  span: number;
  maxSpan: number;
  onChange: (span: number) => void;
  onView: () => void;
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-black/80 py-1.5 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, span - 1))}
        disabled={span <= 1}
        className="flex h-6 w-6 items-center justify-center rounded-sm text-sm text-white transition hover:bg-white/20 disabled:opacity-30"
        title="Reducir tamaño"
      >
        −
      </button>
      <span className="min-w-6 text-center text-[11px] text-neutral-300">
        {span}x
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(maxSpan, span + 1))}
        disabled={span >= maxSpan}
        className="flex h-6 w-6 items-center justify-center rounded-sm text-sm text-white transition hover:bg-white/20 disabled:opacity-30"
        title="Ampliar tamaño"
      >
        +
      </button>
      <span className="mx-1 h-4 w-px bg-white/20" />
      <button
        type="button"
        onClick={onView}
        className="flex h-6 w-6 items-center justify-center rounded-sm text-white transition hover:bg-white/20"
        title="Ver foto"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>
    </div>
  );
}
