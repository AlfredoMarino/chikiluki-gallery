import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getGoogleAccessToken } from "@/lib/auth/helpers";
import {
  createResumableUploadSession,
  ensureSessionFolders,
} from "@/lib/drive/service";
import {
  validateSession,
  getExtensionFromFile,
  buildLevel4Folder,
  buildStoredFilename,
  InvalidSessionInputError,
} from "@/lib/drive/path";
import {
  allocateSessionSeqBatch,
  cacheSessionFolderIds,
  getCachedSessionFolderIds,
} from "@/lib/drive/sequence";
import { signUploadToken } from "@/lib/upload/token";
import { errorResponse } from "@/lib/utils";

/**
 * Batch-initiate a set of photo uploads.
 *
 * Replaces the old monolithic upload route. The client sends:
 *
 *   POST /api/photos/upload/init
 *   {
 *     session: {
 *       medium, year?, camera, date,
 *       // digital: description
 *       // film:    stock, iso, descriptors?
 *     },
 *     files: [{ name, size, mimeType, hash }]
 *   }
 *
 * The server validates everything, dedupes by hash, allocates a consecutive
 * block of sequence numbers, creates one Drive resumable upload session per
 * non-duplicate file, and returns an opaque signed token the client echoes
 * back to `/finalize` once the bytes are in Drive.
 *
 * The file bytes never pass through this function — they go browser → Drive
 * directly, bypassing Vercel's 4.5MB serverless payload limit.
 */

export const runtime = "nodejs";

type IncomingFile = {
  name: string;
  size: number;
  mimeType: string;
  hash: string;
};

type FileResult =
  | {
      status: "ready";
      uploadUrl: string;
      token: string;
      storedFilename: string;
      sessionSeq: number;
    }
  | { status: "duplicate"; error: string; existingPhotoId: string }
  | { status: "unsupported"; error: string }
  | { status: "error"; error: string };

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }
  const userId = session.user.id;

  let body: { session: unknown; files: IncomingFile[] };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!Array.isArray(body.files) || body.files.length === 0) {
    return errorResponse("files must be a non-empty array");
  }
  if (body.files.length > 200) {
    return errorResponse("too many files in one batch (max 200)");
  }

  // ─── 1. Validate session metadata ──────────────────────
  let sessionMeta;
  try {
    sessionMeta = validateSession(body.session);
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

  // ─── 2. Per-file extension + shape validation ──────────
  // We preserve input order so the response can be zipped with the request.
  const perFile: (
    | { kind: "pending"; ext: string; hash: string; mimeType: string; name: string; size: number }
    | { kind: "bad"; result: FileResult }
  )[] = body.files.map((f) => {
    if (!f || typeof f !== "object") {
      return { kind: "bad", result: { status: "error", error: "invalid file entry" } };
    }
    if (typeof f.name !== "string" || typeof f.hash !== "string" || typeof f.size !== "number" || typeof f.mimeType !== "string") {
      return { kind: "bad", result: { status: "error", error: "missing fields on file entry" } };
    }
    if (!/^[a-f0-9]{64}$/.test(f.hash)) {
      return { kind: "bad", result: { status: "error", error: "hash must be sha256 hex" } };
    }
    if (f.size <= 0 || f.size > 500 * 1024 * 1024) {
      return { kind: "bad", result: { status: "error", error: "file size out of range (0 < size <= 500MB)" } };
    }
    try {
      const ext = getExtensionFromFile(f.name);
      return { kind: "pending", ext, hash: f.hash, mimeType: f.mimeType, name: f.name, size: f.size };
    } catch (e) {
      return {
        kind: "bad",
        result: {
          status: "unsupported",
          error: e instanceof InvalidSessionInputError ? e.message : "unsupported",
        },
      };
    }
  });

  // ─── 3. Batch dedup by hash (per-user, global) ─────────
  const pendingHashes = Array.from(
    new Set(
      perFile.flatMap((r) => (r.kind === "pending" ? [r.hash] : []))
    )
  );

  const existing = pendingHashes.length
    ? await db
        .select({ id: photos.id, hash: photos.fileHash })
        .from(photos)
        .where(
          and(
            eq(photos.userId, userId),
            inArray(photos.fileHash, pendingHashes)
          )
        )
    : [];
  const dupMap = new Map(existing.map((e) => [e.hash, e.id]));

  // Also detect dupes within the same batch (two files with same hash).
  const seenInBatch = new Set<string>();

  // Decide the final action per file without mutating perFile yet.
  const decisions: FileResult[] = perFile.map((r) => {
    if (r.kind === "bad") return r.result;
    const dupId = dupMap.get(r.hash);
    if (dupId) {
      return {
        status: "duplicate",
        error: "photo already exists",
        existingPhotoId: dupId,
      };
    }
    if (seenInBatch.has(r.hash)) {
      return {
        status: "duplicate",
        error: "duplicate file in this batch",
        existingPhotoId: "",
      };
    }
    seenInBatch.add(r.hash);
    // Will be filled in below after seq allocation + Drive session creation.
    return { status: "error", error: "pending" };
  });

  // Indexes of files that still need a Drive session.
  const readyIdx = perFile
    .map((r, i) => (r.kind === "pending" && decisions[i].status === "error" ? i : -1))
    .filter((i) => i >= 0);

  if (readyIdx.length === 0) {
    // Everything was duplicate or unsupported — no Drive work needed.
    return Response.json({ sessionFolder: level4, files: decisions });
  }

  // ─── 4. Resolve Drive folder IDs (with cache) ──────────
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(userId);
  } catch (e) {
    console.error("getGoogleAccessToken failed:", e);
    return errorResponse("Google Drive not authorized", 401);
  }

  let folderIds = await getCachedSessionFolderIds(userId, level4);
  if (!folderIds) {
    try {
      folderIds = await ensureSessionFolders(accessToken, {
        medium: sessionMeta.medium,
        year: sessionMeta.year,
        camera: sessionMeta.camera,
        level4,
      });
    } catch (e) {
      console.error("ensureSessionFolders failed:", e);
      return errorResponse("Failed to prepare Drive folders", 502);
    }
  }

  // ─── 5. Allocate consecutive sequence numbers ──────────
  let seqs: number[];
  try {
    seqs = await allocateSessionSeqBatch(userId, level4, readyIdx.length);
  } catch (e) {
    console.error("allocateSessionSeqBatch failed:", e);
    return errorResponse("Failed to allocate sequence numbers", 500);
  }

  // Cache folder IDs now that the counter row is guaranteed to exist.
  await cacheSessionFolderIds(userId, level4, folderIds).catch((e) => {
    console.error("cacheSessionFolderIds non-fatal:", e);
  });

  // ─── 6. Create one Drive resumable session per ready file ──
  // Per-file failures become status:"error" but don't fail the whole batch.
  // Sequence numbers that fail are burned (gap), which is accepted by design.
  await Promise.all(
    readyIdx.map(async (i, idxInReady) => {
      const entry = perFile[i];
      if (entry.kind !== "pending") return;

      const seq = seqs[idxInReady];
      const storedFilename = buildStoredFilename(level4, seq, entry.ext);

      try {
        const uploadUrl = await createResumableUploadSession(accessToken, {
          name: storedFilename,
          mimeType: entry.mimeType,
          size: entry.size,
          folderId: folderIds!.rawFolderId,
        });

        const token = signUploadToken({
          userId,
          sessionFolder: level4,
          sessionSeq: seq,
          storedFilename,
          rawFolderId: folderIds!.rawFolderId,
          thumbFolderId: folderIds!.thumbFolderId,
          fileHash: entry.hash,
          mimeType: entry.mimeType,
          originalName: entry.name,
          fileSize: entry.size,
          session: {
            medium: sessionMeta.medium,
            year: sessionMeta.year,
            camera: sessionMeta.camera,
            date: sessionMeta.date,
            description:
              sessionMeta.medium === "digital"
                ? sessionMeta.description
                : undefined,
            stock:
              sessionMeta.medium === "film" ? sessionMeta.stock : undefined,
            iso: sessionMeta.medium === "film" ? sessionMeta.iso : undefined,
            descriptors:
              sessionMeta.medium === "film"
                ? sessionMeta.descriptors
                : undefined,
          },
        });

        decisions[i] = {
          status: "ready",
          uploadUrl,
          token,
          storedFilename,
          sessionSeq: seq,
        };
      } catch (e) {
        console.error(`Drive session init failed for seq ${seq}:`, e);
        decisions[i] = {
          status: "error",
          error: "Failed to create upload session",
        };
      }
    })
  );

  return Response.json({ sessionFolder: level4, files: decisions });
}
