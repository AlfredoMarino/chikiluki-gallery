import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { collections, layoutConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { jsonResponse, errorResponse, slugify } from "@/lib/utils";

// Get a single collection with its layout config
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user.id)));

  if (!collection) {
    return errorResponse("Collection not found", 404);
  }

  const [layout] = await db
    .select()
    .from(layoutConfigs)
    .where(eq(layoutConfigs.collectionId, id));

  return jsonResponse({ ...collection, layout: layout || null });
}

// Update a collection
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name) {
    updates.name = body.name.trim();
    updates.slug = slugify(body.name);
  }
  if (body.description !== undefined) updates.description = body.description;
  if (body.type) updates.type = body.type;
  if (body.visibility) updates.visibility = body.visibility;
  if (body.coverPhotoId !== undefined) updates.coverPhotoId = body.coverPhotoId;
  if (body.rollMetadata) updates.rollMetadata = body.rollMetadata;

  const [updated] = await db
    .update(collections)
    .set(updates)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user.id)))
    .returning();

  if (!updated) {
    return errorResponse("Collection not found", 404);
  }

  return jsonResponse(updated);
}

// Delete a collection
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user.id)))
    .returning({ id: collections.id });

  if (!deleted) {
    return errorResponse("Collection not found", 404);
  }

  return jsonResponse({ success: true });
}
