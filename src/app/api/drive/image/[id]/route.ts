import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { photos, collectionPhotos, collections } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { getGoogleAccessToken } from "@/lib/auth/helpers";
import { streamFromDrive } from "@/lib/drive/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const size = request.nextUrl.searchParams.get("size") || "thumb";

  // Try authenticated access first
  const session = await auth();
  let photo;

  if (session?.user?.id) {
    [photo] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.userId, session.user.id)));
  }

  if (!photo) {
    // Check if photo belongs to a public/unlisted collection
    const [publicPhoto] = await db
      .select({ photo: photos })
      .from(photos)
      .innerJoin(collectionPhotos, eq(collectionPhotos.photoId, photos.id))
      .innerJoin(
        collections,
        eq(collections.id, collectionPhotos.collectionId)
      )
      .where(
        and(
          eq(photos.id, id),
          or(
            eq(collections.visibility, "public"),
            eq(collections.visibility, "unlisted")
          )
        )
      );

    if (!publicPhoto) {
      return new Response("Not found", { status: 404 });
    }
    photo = publicPhoto.photo;
  }

  // Determine which Drive file to fetch
  const driveId =
    size === "full" ? photo.driveFileId : (photo.driveThumbId || photo.driveFileId);

  try {
    const accessToken = await getGoogleAccessToken(photo.userId);
    const driveResponse = await streamFromDrive(accessToken, driveId);

    const headers: HeadersInit = {
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    };

    const contentLength = driveResponse.headers.get("content-length");
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    return new Response(driveResponse.body, { headers });
  } catch (error) {
    console.error("Drive image proxy error:", error);
    return new Response("Failed to load image", { status: 502 });
  }
}
