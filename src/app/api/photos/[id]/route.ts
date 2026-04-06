import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getGoogleAccessToken } from "@/lib/auth/helpers";
import { deleteFromDrive } from "@/lib/drive/service";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, id), eq(photos.userId, session.user.id)));

  if (!photo) {
    return errorResponse("Photo not found", 404);
  }

  return jsonResponse(photo);
}

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

  const allowedFields = ["metadata", "isPrivate", "takenAt"] as const;
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse("No valid fields to update");
  }

  const [updated] = await db
    .update(photos)
    .set(updates)
    .where(and(eq(photos.id, id), eq(photos.userId, session.user.id)))
    .returning();

  if (!updated) {
    return errorResponse("Photo not found", 404);
  }

  return jsonResponse(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  // Get photo to find Drive file IDs
  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, id), eq(photos.userId, session.user.id)));

  if (!photo) {
    return errorResponse("Photo not found", 404);
  }

  // Delete from Google Drive
  try {
    const accessToken = await getGoogleAccessToken(session.user.id);
    await Promise.all([
      deleteFromDrive(accessToken, photo.driveFileId),
      photo.driveThumbId
        ? deleteFromDrive(accessToken, photo.driveThumbId)
        : Promise.resolve(),
    ]);
  } catch (error) {
    console.error("Drive delete error:", error);
    // Continue with DB deletion even if Drive fails
  }

  // Delete from database (cascades to photo_tags and collection_photos)
  await db
    .delete(photos)
    .where(and(eq(photos.id, id), eq(photos.userId, session.user.id)));

  return jsonResponse({ success: true });
}
