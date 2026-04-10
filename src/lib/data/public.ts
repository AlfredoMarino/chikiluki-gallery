import "server-only";
import { db } from "@/lib/db";
import {
  collections,
  collectionPhotos,
  photos,
  users,
  layoutConfigs,
} from "@/lib/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import type { Collection, Photo, LayoutConfig } from "@/types";

export interface PublicCollectionSummary extends Collection {
  photoCount: number;
}

export interface PublicCollectionDetail extends Collection {
  layout: LayoutConfig | null;
  photos: Photo[];
}

/**
 * Get all public collections for a user by their name.
 * Used by /gallery/[user]
 */
export async function getPublicCollectionsByUser(
  userName: string
): Promise<PublicCollectionSummary[]> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.name, userName));

  if (!user) return [];

  const result = await db
    .select({
      collection: collections,
      photoCount: sql<number>`count(${collectionPhotos.photoId})::int`,
    })
    .from(collections)
    .leftJoin(
      collectionPhotos,
      eq(collectionPhotos.collectionId, collections.id)
    )
    .where(
      and(
        eq(collections.userId, user.id),
        eq(collections.visibility, "public")
      )
    )
    .groupBy(collections.id);

  return result.map((r) => ({
    ...(r.collection as Collection),
    photoCount: r.photoCount,
  }));
}

/**
 * Get a single public collection with its photos and layout.
 * Used by /gallery/[user]/[slug]
 */
export async function getPublicCollectionBySlug(
  userName: string,
  slug: string
): Promise<PublicCollectionDetail | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.name, userName));

  if (!user) return null;

  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.userId, user.id),
        eq(collections.slug, slug),
        eq(collections.visibility, "public")
      )
    );

  if (!collection) return null;

  const [layout] = await db
    .select()
    .from(layoutConfigs)
    .where(eq(layoutConfigs.collectionId, collection.id));

  const photosResult = await db
    .select({ photo: photos, position: collectionPhotos.position })
    .from(collectionPhotos)
    .innerJoin(photos, eq(photos.id, collectionPhotos.photoId))
    .where(eq(collectionPhotos.collectionId, collection.id))
    .orderBy(collectionPhotos.position);

  return {
    ...(collection as Collection),
    layout: (layout as LayoutConfig) || null,
    photos: photosResult.map((r) => r.photo as Photo),
  };
}

/**
 * Get a collection by share token (for unlisted or public).
 * Used by /s/[token]
 */
export async function getCollectionByShareToken(
  token: string
): Promise<PublicCollectionDetail | null> {
  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.shareToken, token),
        or(
          eq(collections.visibility, "unlisted"),
          eq(collections.visibility, "public")
        )
      )
    );

  if (!collection) return null;

  const [layout] = await db
    .select()
    .from(layoutConfigs)
    .where(eq(layoutConfigs.collectionId, collection.id));

  const photosResult = await db
    .select({ photo: photos, position: collectionPhotos.position })
    .from(collectionPhotos)
    .innerJoin(photos, eq(photos.id, collectionPhotos.photoId))
    .where(eq(collectionPhotos.collectionId, collection.id))
    .orderBy(collectionPhotos.position);

  return {
    ...(collection as Collection),
    layout: (layout as LayoutConfig) || null,
    photos: photosResult.map((r) => r.photo as Photo),
  };
}
