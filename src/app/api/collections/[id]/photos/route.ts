import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { collections, collectionPhotos, photos } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Get photos in a collection (ordered by position)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  // Verify collection belongs to user
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user.id)));

  if (!collection) {
    return errorResponse("Collection not found", 404);
  }

  const result = await db
    .select({
      photo: photos,
      position: collectionPhotos.position,
    })
    .from(collectionPhotos)
    .innerJoin(photos, eq(photos.id, collectionPhotos.photoId))
    .where(eq(collectionPhotos.collectionId, id))
    .orderBy(collectionPhotos.position);

  return jsonResponse(result.map((r) => ({ ...r.photo, position: r.position })));
}

// Add photos to a collection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id: collectionId } = await params;
  const { photoIds } = await request.json();

  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return errorResponse("photoIds array is required");
  }

  // Verify collection belongs to user
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.id, collectionId),
        eq(collections.userId, session.user.id)
      )
    );

  if (!collection) {
    return errorResponse("Collection not found", 404);
  }

  // Get current max position
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${collectionPhotos.position}), -1)` })
    .from(collectionPhotos)
    .where(eq(collectionPhotos.collectionId, collectionId));

  // Insert photos with incrementing positions
  const values = photoIds.map((photoId: string, i: number) => ({
    collectionId,
    photoId,
    position: maxPos + 1 + i,
  }));

  await db.insert(collectionPhotos).values(values).onConflictDoNothing();

  // Update collection timestamp
  await db
    .update(collections)
    .set({ updatedAt: new Date() })
    .where(eq(collections.id, collectionId));

  return jsonResponse({ added: photoIds.length }, 201);
}

// Remove photos from a collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id: collectionId } = await params;
  const { photoIds } = await request.json();

  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return errorResponse("photoIds array is required");
  }

  // Verify collection belongs to user
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.id, collectionId),
        eq(collections.userId, session.user.id)
      )
    );

  if (!collection) {
    return errorResponse("Collection not found", 404);
  }

  for (const photoId of photoIds) {
    await db
      .delete(collectionPhotos)
      .where(
        and(
          eq(collectionPhotos.collectionId, collectionId),
          eq(collectionPhotos.photoId, photoId)
        )
      );
  }

  return jsonResponse({ removed: photoIds.length });
}
