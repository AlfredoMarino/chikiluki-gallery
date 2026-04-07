import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { collections, layoutConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Update layout config for a collection
export async function PATCH(
  request: NextRequest,
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

  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.layoutType !== undefined) updates.layoutType = body.layoutType;
  if (body.columnsMobile !== undefined) updates.columnsMobile = body.columnsMobile;
  if (body.columnsTablet !== undefined) updates.columnsTablet = body.columnsTablet;
  if (body.columnsDesktop !== undefined) updates.columnsDesktop = body.columnsDesktop;
  if (body.gap !== undefined) updates.gap = body.gap;
  if (body.forceOrientation !== undefined) updates.forceOrientation = body.forceOrientation;
  if (body.mobileBehavior !== undefined) updates.mobileBehavior = body.mobileBehavior;
  if (body.photoOverrides !== undefined) updates.photoOverrides = body.photoOverrides;

  const [updated] = await db
    .update(layoutConfigs)
    .set(updates)
    .where(eq(layoutConfigs.collectionId, id))
    .returning();

  if (!updated) {
    // Create if doesn't exist
    const [created] = await db
      .insert(layoutConfigs)
      .values({ collectionId: id, ...updates })
      .returning();
    return jsonResponse(created);
  }

  return jsonResponse(updated);
}
