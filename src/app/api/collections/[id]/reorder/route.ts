import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { collections, collectionPhotos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Reorder photos in a collection
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id: collectionId } = await params;
  const { photoIds } = await request.json();

  if (!Array.isArray(photoIds)) {
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

  // Update positions based on array order
  for (let i = 0; i < photoIds.length; i++) {
    await db
      .update(collectionPhotos)
      .set({ position: i })
      .where(
        and(
          eq(collectionPhotos.collectionId, collectionId),
          eq(collectionPhotos.photoId, photoIds[i])
        )
      );
  }

  return jsonResponse({ success: true });
}
