import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { photos, photoTags, tags } from "@/lib/db/schema";
import { eq, desc, and, ilike, inArray } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const userPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.userId, session.user.id))
    .orderBy(desc(photos.createdAt));

  return jsonResponse(userPhotos);
}
