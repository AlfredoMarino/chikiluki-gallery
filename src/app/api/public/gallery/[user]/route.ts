import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { collections, users, collectionPhotos } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Get public collections for a user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
) {
  const { user: userName } = await params;

  // Find user by name (slug-like)
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.name, userName));

  if (!user) {
    return errorResponse("User not found", 404);
  }

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

  return jsonResponse(
    result.map((r) => ({
      ...r.collection,
      photoCount: r.photoCount,
    }))
  );
}
