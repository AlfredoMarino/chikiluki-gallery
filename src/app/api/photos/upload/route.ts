import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getGoogleAccessToken } from "@/lib/auth/helpers";
import {
  ensureSessionFolders,
  uploadToDrive,
  deleteFromDrive,
} from "@/lib/drive/service";
import {
  validateSession,
  getExtensionFromFile,
  buildLevel4Folder,
  buildStoredFilename,
  InvalidSessionInputError,
} from "@/lib/drive/path";
import {
  allocateSessionSeq,
  cacheSessionFolderIds,
  getCachedSessionFolderIds,
} from "@/lib/drive/sequence";
import { processImage, calculateFileHash } from "@/lib/images/processing";
import { jsonResponse, errorResponse } from "@/lib/utils";

/**
 * Upload a photo to Google Drive under the strict session hierarchy.
 *
 *   raw/{medium}/{year}/{camera}/{level4}/{level4}_{NNNN}.{ext}
 *   thumbnails/{medium}/{year}/{camera}/{level4}/{level4}_{NNNN}.{ext}
 *
 * Expects multipart/form-data with `file` + session metadata fields:
 *
 *   medium:      "digital" | "film"
 *   camera:      free text (normalized server-side)
 *   date:        "YYYY-MM-DD" or "YYYYMMDD"
 *   year:        optional; must match the date year if provided
 *
 *   digital only:
 *     description: free text (required)
 *
 *   film only:
 *     stock:       free text, "" or "x" = unknown
 *     iso:         0..6400, 0 = unknown
 *     descriptors: optional free text
 *
 * NOTE on sequence gaps: allocateSessionSeq is atomic, but if an upload fails
 * *after* allocation, that sequence number stays burned. Filenames like
 * `_0001, _0003` with `_0002` missing are expected and intentional.
 */
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

    // ─── 1. Validate session metadata ────────────────────
    let sessionMeta;
    let ext;
    try {
      sessionMeta = validateSession({
        medium: formData.get("medium"),
        year: formData.get("year"),
        camera: formData.get("camera"),
        date: formData.get("date"),
        description: formData.get("description"),
        stock: formData.get("stock"),
        iso: formData.get("iso"),
        descriptors: formData.get("descriptors"),
      });
      ext = getExtensionFromFile(file.name);
    } catch (e) {
      if (e instanceof InvalidSessionInputError) {
        return Response.json(
          { error: e.message, field: e.field },
          { status: 400 }
        );
      }
      throw e;
    }

    const level4 = buildLevel4Folder(sessionMeta);

    // ─── 2. Hash + global dedup ──────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = await calculateFileHash(buffer);

    const [existing] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.fileHash, fileHash), eq(photos.userId, userId)));

    if (existing) {
      return errorResponse("This photo already exists", 409);
    }

    // ─── 3. Process image ────────────────────────────────
    const processed = await processImage(buffer);

    // ─── 4. Resolve Drive folder IDs (with cache) ────────
    const accessToken = await getGoogleAccessToken(userId);

    let folderIds = await getCachedSessionFolderIds(userId, level4);
    if (!folderIds) {
      folderIds = await ensureSessionFolders(accessToken, {
        medium: sessionMeta.medium,
        year: sessionMeta.year,
        camera: sessionMeta.camera,
        level4,
      });
    }

    // ─── 5. Allocate sequence + build filename ───────────
    const seq = await allocateSessionSeq(userId, level4);
    const storedFilename = buildStoredFilename(level4, seq, ext);

    // Cache the folder IDs on the counter row if this was the first upload to
    // this session (allocate just created the row). Cheap idempotent update.
    await cacheSessionFolderIds(userId, level4, folderIds);

    // ─── 6. Upload original + thumbnail in parallel ──────
    const uploads = await Promise.allSettled([
      uploadToDrive(accessToken, {
        name: storedFilename,
        mimeType: file.type,
        buffer,
        folderId: folderIds.rawFolderId,
      }),
      uploadToDrive(accessToken, {
        name: storedFilename,
        mimeType: "image/jpeg",
        buffer: processed.thumbnail,
        folderId: folderIds.thumbFolderId,
      }),
    ]);

    const originalUpload = uploads[0];
    const thumbUpload = uploads[1];

    if (originalUpload.status === "rejected" || thumbUpload.status === "rejected") {
      // Best-effort cleanup for whichever succeeded.
      if (originalUpload.status === "fulfilled") {
        void deleteFromDrive(accessToken, originalUpload.value).catch((e) =>
          console.error("cleanup original failed:", e)
        );
      }
      if (thumbUpload.status === "fulfilled") {
        void deleteFromDrive(accessToken, thumbUpload.value).catch((e) =>
          console.error("cleanup thumb failed:", e)
        );
      }
      const err =
        originalUpload.status === "rejected"
          ? originalUpload.reason
          : (thumbUpload as PromiseRejectedResult).reason;
      console.error("Drive upload failed:", err);
      return errorResponse("Drive upload failed", 502);
    }

    const driveFileId = originalUpload.value;
    const driveThumbId = thumbUpload.value;

    // ─── 7. Insert DB row ────────────────────────────────
    try {
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
          // Session metadata (strict convention)
          medium: sessionMeta.medium,
          sessionYear: sessionMeta.year,
          camera: sessionMeta.camera,
          sessionDate: sessionMeta.date,
          sessionFolder: level4,
          sessionSeq: seq,
          driveFolderId: folderIds.rawFolderId,
          driveThumbFolderId: folderIds.thumbFolderId,
          storedFilename,
          digitalDescription:
            sessionMeta.medium === "digital" ? sessionMeta.description : null,
          filmStock: sessionMeta.medium === "film" ? sessionMeta.stock : null,
          filmIso: sessionMeta.medium === "film" ? sessionMeta.iso : null,
          filmDescriptors:
            sessionMeta.medium === "film" ? sessionMeta.descriptors : null,
        })
        .returning();

      return jsonResponse(photo, 201);
    } catch (dbError) {
      // Best-effort cleanup: remove the files we just uploaded to keep Drive
      // consistent with the DB. We intentionally don't await — the user sees
      // the error faster, and Drive deletion is best-effort anyway.
      void deleteFromDrive(accessToken, driveFileId).catch((e) =>
        console.error("cleanup original failed:", e)
      );
      void deleteFromDrive(accessToken, driveThumbId).catch((e) =>
        console.error("cleanup thumb failed:", e)
      );
      console.error("DB insert failed:", dbError);
      return errorResponse("Failed to persist photo", 500);
    }
  } catch (error) {
    console.error("Upload error:", error);
    return errorResponse("Upload failed", 500);
  }
}
