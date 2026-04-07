import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  collections,
  collectionPhotos,
  photos,
  users,
  layoutConfigs,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Get a public collection with its photos
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ user: string; slug: string }> }
) {
  const { user: userName, slug } = await params;

  const [user] = await db.select().from(users).where(eq(users.name, userName));

  if (!user) {
    return errorResponse("User not found", 404);
  }

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

  if (!collection) {
    return errorResponse("Collection not found", 404);
  }

  const [layout] = await db
    .select()
    .from(layoutConfigs)
    .where(eq(layoutConfigs.collectionId, collection.id));

  const collectionPhotosResult = await db
    .select({ photo: photos, position: collectionPhotos.position })
    .from(collectionPhotos)
    .innerJoin(photos, eq(photos.id, collectionPhotos.photoId))
    .where(eq(collectionPhotos.collectionId, collection.id))
    .orderBy(collectionPhotos.position);

  return jsonResponse({
    ...collection,
    layout: layout || null,
    photos: collectionPhotosResult.map((r) => r.photo),
  });
}
