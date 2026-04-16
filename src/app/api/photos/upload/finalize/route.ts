import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getGoogleAccessToken } from "@/lib/auth/helpers";
import {
  deleteFromDrive,
  streamFromDrive,
  uploadToDrive,
} from "@/lib/drive/service";
import {
  InvalidUploadTokenError,
  verifyUploadToken,
} from "@/lib/upload/token";
import { processImage, calculateFileHash } from "@/lib/images/processing";
import { errorResponse, jsonResponse } from "@/lib/utils";

/**
 * Finalize a single photo upload.
 *
 *   POST /api/photos/upload/finalize
 *   { token, driveFileId }
 *
 * Preconditions (client must have completed before calling this):
 *   - Received `token` + `uploadUrl` from /init.
 *   - Successfully PUT the file bytes to `uploadUrl` (Drive resumable session).
 *   - Drive returned the created file's `id` (→ driveFileId).
 *
 * The server:
 *   1. Verifies the HMAC on `token` and matches `userId` with the session.
 *   2. Streams the newly-uploaded original back from Drive, hashes it, and
 *      checks the hash against the one signed into the token. Protects dedup
 *      correctness (client could otherwise pair hash A with file B).
 *   3. Runs sharp → thumbnail + blurhash + tiny base64.
 *   4. Uploads the thumbnail to the mirrored `thumbnails/` folder.
 *   5. Inserts the `photos` row.
 *
 * On any failure after step 2, best-effort `deleteFromDrive` the original to
 * avoid orphaning bytes in Drive. Thumbnail is deleted too if it reached Drive.
 */

export const runtime = "nodejs";
// Allow up to 5 minutes for TIFF processing; the default (15s) isn't enough.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }
  const userId = session.user.id;

  let body: { token: string; driveFileId: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (typeof body.token !== "string" || typeof body.driveFileId !== "string") {
    return errorResponse("token and driveFileId are required");
  }

  // ─── 1. Verify token ───────────────────────────────────
  let payload;
  try {
    payload = verifyUploadToken(body.token);
  } catch (e) {
    if (e instanceof InvalidUploadTokenError) {
      return errorResponse(`Invalid token: ${e.message}`, 401);
    }
    throw e;
  }

  if (payload.userId !== userId) {
    return errorResponse("Token does not belong to this user", 403);
  }

  const accessToken = await getGoogleAccessToken(userId);

  // From here on, we always own `body.driveFileId` on failure and must clean
  // it up. Wrap in one try/catch.
  let thumbDriveId: string | null = null;

  try {
    // ─── 2. Stream the original back + verify hash ───────
    const driveResponse = await streamFromDrive(accessToken, body.driveFileId);
    const arrayBuf = await driveResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.byteLength !== payload.fileSize) {
      throw new Error(
        `size mismatch: expected ${payload.fileSize}, got ${buffer.byteLength}`
      );
    }

    const actualHash = await calculateFileHash(buffer);
    if (actualHash !== payload.fileHash) {
      throw new Error("hash mismatch: Drive bytes don't match init hash");
    }

    // Re-check dedup — another request may have inserted the same hash in the
    // window between init and finalize (e.g. two parallel batches).
    const [dup] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(
        and(eq(photos.userId, userId), eq(photos.fileHash, payload.fileHash))
      );
    if (dup) {
      throw new DedupError(dup.id);
    }

    // ─── 3. Process image (thumb + blurhash + tiny) ──────
    const processed = await processImage(buffer);

    // ─── 4. Upload thumbnail ─────────────────────────────
    thumbDriveId = await uploadToDrive(accessToken, {
      name: payload.storedFilename,
      mimeType: "image/jpeg",
      buffer: processed.thumbnail,
      folderId: payload.thumbFolderId,
    });

    // ─── 5. Insert the photos row ────────────────────────
    const [photo] = await db
      .insert(photos)
      .values({
        userId,
        driveFileId: body.driveFileId,
        driveThumbId: thumbDriveId,
        originalName: payload.originalName,
        mimeType: payload.mimeType,
        width: processed.width,
        height: processed.height,
        fileSize: buffer.byteLength,
        blurhash: processed.blurhash,
        thumbBase64: processed.thumbBase64,
        orientation: processed.orientation,
        fileHash: payload.fileHash,
        isPrivate: true,
        medium: payload.session.medium,
        sessionYear: payload.session.year,
        camera: payload.session.camera,
        sessionDate: payload.session.date,
        sessionFolder: payload.sessionFolder,
        sessionSeq: payload.sessionSeq,
        driveFolderId: payload.rawFolderId,
        driveThumbFolderId: payload.thumbFolderId,
        storedFilename: payload.storedFilename,
        digitalDescription:
          payload.session.medium === "digital"
            ? payload.session.description ?? null
            : null,
        filmStock:
          payload.session.medium === "film"
            ? payload.session.stock ?? null
            : null,
        filmIso:
          payload.session.medium === "film"
            ? payload.session.iso ?? null
            : null,
        filmDescriptors:
          payload.session.medium === "film"
            ? payload.session.descriptors ?? null
            : null,
      })
      .returning();

    return jsonResponse(photo, 201);
  } catch (error) {
    // Cleanup: delete both Drive files to avoid orphans.
    void deleteFromDrive(accessToken, body.driveFileId).catch((e) =>
      console.error("cleanup original failed:", e)
    );
    if (thumbDriveId) {
      void deleteFromDrive(accessToken, thumbDriveId).catch((e) =>
        console.error("cleanup thumb failed:", e)
      );
    }

    if (error instanceof DedupError) {
      return Response.json(
        { error: "photo already exists", existingPhotoId: error.photoId },
        { status: 409 }
      );
    }

    console.error("Finalize failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to finalize upload";
    return errorResponse(message, 500);
  }
}

class DedupError extends Error {
  constructor(public photoId: string) {
    super("duplicate");
    this.name = "DedupError";
  }
}
