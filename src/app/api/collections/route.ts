import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { collections, collectionPhotos, photos, layoutConfigs } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { jsonResponse, errorResponse, slugify } from "@/lib/utils";

// List all collections for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
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
    .where(eq(collections.userId, session.user.id))
    .groupBy(collections.id)
    .orderBy(desc(collections.updatedAt));

  const mapped = result.map((r) => ({
    ...r.collection,
    photoCount: r.photoCount,
  }));

  return jsonResponse(mapped);
}

// Create a new collection
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await request.json();
  const { name, type, description, visibility } = body;

  if (!name || typeof name !== "string") {
    return errorResponse("Collection name is required");
  }

  const slug = slugify(name);

  const [collection] = await db
    .insert(collections)
    .values({
      userId: session.user.id,
      name: name.trim(),
      slug,
      type: type || "album",
      description: description || null,
      visibility: visibility || "private",
    })
    .returning();

  // Create default layout config
  await db.insert(layoutConfigs).values({
    collectionId: collection.id,
  });

  return jsonResponse(collection, 201);
}
