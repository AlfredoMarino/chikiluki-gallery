import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { photoLikes, collectionPhotos } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  isPhotoPubliclyAccessible,
  isCollectionPubliclyAccessible,
} from "@/lib/data/public";
import { getVisitorId, ensureVisitorId, isUuid } from "@/lib/likes/visitor";
import { jsonResponse, errorResponse } from "@/lib/utils";

/**
 * Likes anónimos de visitantes en páginas públicas.
 *
 * Anti-abuso ligero: UUIDs validados estrictos, writes de una sola foto,
 * la foto debe pertenecer a una colección pública/unlisted, y el PK
 * compuesto (photoId, visitorId) dedupea a nivel BD. Si algún día hay
 * abuso real, el upgrade path es un rate-limiter en KV (Upstash/Vercel KV).
 */

/** GET /api/public/likes?collectionId=… → { liked: photoId[] } del visitante. */
export async function GET(request: NextRequest) {
  const collectionId = request.nextUrl.searchParams.get("collectionId");
  if (!isUuid(collectionId)) {
    return errorResponse("collectionId inválido", 400);
  }

  const visitorId = getVisitorId(request);
  if (!visitorId) return jsonResponse({ liked: [] });

  if (!(await isCollectionPubliclyAccessible(collectionId))) {
    return errorResponse("Colección no encontrada", 404);
  }

  const rows = await db
    .select({ photoId: photoLikes.photoId })
    .from(photoLikes)
    .innerJoin(
      collectionPhotos,
      eq(collectionPhotos.photoId, photoLikes.photoId)
    )
    .where(
      and(
        eq(collectionPhotos.collectionId, collectionId),
        eq(photoLikes.visitorId, visitorId)
      )
    );

  return jsonResponse({ liked: rows.map((r) => r.photoId) });
}

/** POST { photoId } → da like. Setea la cookie de visitante si es el primero. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Body inválido", 400);
  }

  const photoId = (body as { photoId?: unknown })?.photoId;
  if (!isUuid(photoId)) return errorResponse("photoId inválido", 400);

  if (!(await isPhotoPubliclyAccessible(photoId))) {
    return errorResponse("Foto no encontrada", 404);
  }

  const visitorId = await ensureVisitorId(request);

  await db
    .insert(photoLikes)
    .values({ photoId, visitorId })
    .onConflictDoNothing();

  return jsonResponse({ liked: true });
}

/** DELETE { photoId } → quita el like. Sin cookie es un no-op. */
export async function DELETE(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Body inválido", 400);
  }

  const photoId = (body as { photoId?: unknown })?.photoId;
  if (!isUuid(photoId)) return errorResponse("photoId inválido", 400);

  const visitorId = getVisitorId(request);
  if (!visitorId) return jsonResponse({ liked: false });

  await db
    .delete(photoLikes)
    .where(
      and(eq(photoLikes.photoId, photoId), eq(photoLikes.visitorId, visitorId))
    );

  return jsonResponse({ liked: false });
}
