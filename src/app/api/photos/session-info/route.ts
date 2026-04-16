import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { photoSessionCounters } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { errorResponse } from "@/lib/utils";

/**
 * Peek at an existing session's counter so the uploader can show:
 *
 *   "Sesión existente — ya subiste 12 fotos; las nuevas serán _0013, _0014…"
 *
 *   GET /api/photos/session-info?folder={level4}
 *   → 200 { exists: true,  uploadedCount: 12, nextSeq: 13 }
 *   → 200 { exists: false }
 *
 * `uploadedCount` is `nextSeq - 1`. It includes gaps from failed uploads, so
 * it's really "highest sequence ever allocated" rather than a live photo
 * count — but that's the meaningful number for the user (tells them what the
 * next filename will be).
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }
  const userId = session.user.id;

  const folder = request.nextUrl.searchParams.get("folder");
  if (!folder) {
    return errorResponse("folder query param is required");
  }

  const [row] = await db
    .select({ nextSeq: photoSessionCounters.nextSeq })
    .from(photoSessionCounters)
    .where(
      and(
        eq(photoSessionCounters.userId, userId),
        eq(photoSessionCounters.sessionFolder, folder)
      )
    );

  if (!row) {
    return Response.json({ exists: false });
  }

  return Response.json({
    exists: true,
    uploadedCount: row.nextSeq - 1,
    nextSeq: row.nextSeq,
  });
}
