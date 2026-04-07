import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  collections,
  collectionPhotos,
  photos,
  layoutConfigs,
} from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Get an unlisted (or public) collection by share token
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

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
