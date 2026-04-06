import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getGoogleAccessToken } from "@/lib/auth/helpers";
import { ensureDriveFolders, uploadToDrive } from "@/lib/drive/service";
import { processImage, calculateFileHash } from "@/lib/images/processing";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const userId = session.user.id;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse("No file provided");
    }

    if (!file.type.startsWith("image/")) {
      return errorResponse("File must be an image");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Calculate hash for deduplication
    const fileHash = await calculateFileHash(buffer);

    // Check if photo already exists
    const [existing] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.fileHash, fileHash), eq(photos.userId, userId)));

    if (existing) {
      return errorResponse("This photo already exists", 409);
    }

    // Process image: thumbnails, blurhash, metadata
    const processed = await processImage(buffer);

    // Get Google Drive access token and ensure folder structure
    const accessToken = await getGoogleAccessToken(userId);
    const folders = await ensureDriveFolders(accessToken);

    // Upload original and thumbnail to Google Drive
    const [driveFileId, driveThumbId] = await Promise.all([
      uploadToDrive(accessToken, {
        name: file.name,
        mimeType: file.type,
        buffer,
        folderId: folders.originalsId,
      }),
      uploadToDrive(accessToken, {
        name: `thumb_${file.name}`,
        mimeType: "image/jpeg",
        buffer: processed.thumbnail,
        folderId: folders.thumbnailsId,
      }),
    ]);

    // Save to database
    const [photo] = await db
      .insert(photos)
      .values({
        userId,
        driveFileId,
        driveThumbId,
        originalName: file.name,
        mimeType: file.type,
        width: processed.width,
        height: processed.height,
        fileSize: buffer.byteLength,
        blurhash: processed.blurhash,
        thumbBase64: processed.thumbBase64,
        orientation: processed.orientation,
        fileHash,
        isPrivate: true,
      })
      .returning();

    return jsonResponse(photo, 201);
  } catch (error) {
    console.error("Upload error:", error);
    return errorResponse("Upload failed", 500);
  }
}
