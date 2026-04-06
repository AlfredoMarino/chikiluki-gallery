import type {
  photos,
  collections,
  tags,
  layoutConfigs,
  collectionPhotos,
  photoTags,
} from "@/lib/db/schema";

// ─── Inferred types from Drizzle schema ──────────────────

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type LayoutConfig = typeof layoutConfigs.$inferSelect;
export type NewLayoutConfig = typeof layoutConfigs.$inferInsert;

export type CollectionPhoto = typeof collectionPhotos.$inferSelect;
export type PhotoTag = typeof photoTags.$inferSelect;

// ─── API response types ──────────────────────────────────

export interface PhotoWithTags extends Photo {
  tags: (Tag & { source: "manual" | "ai"; confidence: number | null })[];
}

export interface CollectionWithPhotos extends Collection {
  photos: PhotoWithTags[];
  layout: LayoutConfig | null;
  photoCount: number;
}

export interface CollectionSummary extends Collection {
  photoCount: number;
  coverPhoto: Photo | null;
}

// ─── Layout types ────────────────────────────────────────

export type LayoutType = "grid" | "masonry" | "list" | "collage";

export interface LayoutSettings {
  layoutType: LayoutType;
  columns: { mobile: number; tablet: number; desktop: number };
  gap: number;
  forceOrientation: boolean;
  mobileBehavior: {
    landscapeInPortrait: "stack" | "scroll-horizontal" | "rotate-hint";
    maxPhotosPerRow: number;
  };
  photoOverrides: Record<string, { span: number; aspect?: string }>;
}
