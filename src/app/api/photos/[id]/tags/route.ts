import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { tags, photoTags, photos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Get tags for a photo
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      source: photoTags.source,
      confidence: photoTags.confidence,
    })
    .from(photoTags)
    .innerJoin(tags, eq(photoTags.tagId, tags.id))
    .where(eq(photoTags.photoId, id));

  return jsonResponse(result);
}

// Add a tag to a photo (creates tag if it doesn't exist)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id: photoId } = await params;
  const { name, color } = await request.json();

  if (!name || typeof name !== "string") {
    return errorResponse("Tag name is required");
  }

  const tagName = name.trim().toLowerCase();

  // Verify photo belongs to user
  const [photo] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.userId, session.user.id)));

  if (!photo) {
    return errorResponse("Photo not found", 404);
  }

  // Find or create tag
  let [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.name, tagName), eq(tags.userId, session.user.id)));

  if (!tag) {
    [tag] = await db
      .insert(tags)
      .values({ userId: session.user.id, name: tagName, color: color || null })
      .returning();
  }

  // Link tag to photo (ignore if already exists)
  await db
    .insert(photoTags)
    .values({ photoId, tagId: tag.id, source: "manual" })
    .onConflictDoNothing();

  return jsonResponse(tag, 201);
}

// Remove a tag from a photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id: photoId } = await params;
  const { tagId } = await request.json();

  if (!tagId) {
    return errorResponse("tagId is required");
  }

  await db
    .delete(photoTags)
    .where(and(eq(photoTags.photoId, photoId), eq(photoTags.tagId, tagId)));

  return jsonResponse({ success: true });
}
