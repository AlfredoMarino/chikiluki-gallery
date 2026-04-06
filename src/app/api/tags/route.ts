import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { jsonResponse, errorResponse } from "@/lib/utils";

// List all tags for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const userTags = await db
    .select()
    .from(tags)
    .where(eq(tags.userId, session.user.id))
    .orderBy(tags.name);

  return jsonResponse(userTags);
}
