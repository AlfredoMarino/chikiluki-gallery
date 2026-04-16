import { drive_v3 } from "googleapis";
import { createDriveClient, DRIVE_ROOT_FOLDER, DRIVE_TOP } from "./client";
import type { Medium } from "./path";
import { Readable } from "stream";

/**
 * Ensure the two top-level folders exist:
 *   - "Chikiluki Gallery/raw"
 *   - "Chikiluki Gallery/thumbnails"
 *
 * Cheap after first call (one Drive list per level).
 */
export async function ensureDriveRoots(accessToken: string): Promise<{
  galleryRootId: string;
  rawRootId: string;
  thumbsRootId: string;
}> {
  const drive = createDriveClient(accessToken);

  const galleryRootId = await findOrCreateFolder(
    drive,
    DRIVE_ROOT_FOLDER,
    "root"
  );
  const rawRootId = await findOrCreateFolder(
    drive,
    DRIVE_TOP.raw,
    galleryRootId
  );
  const thumbsRootId = await findOrCreateFolder(
    drive,
    DRIVE_TOP.thumbnails,
    galleryRootId
  );

  return { galleryRootId, rawRootId, thumbsRootId };
}

/**
 * Walk (or create) the per-session folder hierarchy under both `raw/` and
 * `thumbnails/` and return the two leaf folder IDs.
 *
 *   raw/{medium}/{year}/{camera}/{level4}
 *   thumbnails/{medium}/{year}/{camera}/{level4}
 *
 * This makes ~10 Drive API calls on a cold session. Cache the returned IDs on
 * `photo_session_counters` so subsequent uploads to the same session skip the
 * walk entirely.
 */
export async function ensureSessionFolders(
  accessToken: string,
  p: { medium: Medium; year: number; camera: string; level4: string }
): Promise<{ rawFolderId: string; thumbFolderId: string }> {
  const drive = createDriveClient(accessToken);
  const { rawRootId, thumbsRootId } = await ensureDriveRoots(accessToken);

  const yearStr = String(p.year);

  // raw/{medium}/{year}/{camera}/{level4}
  const rawMedium = await findOrCreateFolder(drive, p.medium, rawRootId);
  const rawYear = await findOrCreateFolder(drive, yearStr, rawMedium);
  const rawCamera = await findOrCreateFolder(drive, p.camera, rawYear);
  const rawFolderId = await findOrCreateFolder(drive, p.level4, rawCamera);

  // thumbnails/{medium}/{year}/{camera}/{level4}
  const thumbMedium = await findOrCreateFolder(drive, p.medium, thumbsRootId);
  const thumbYear = await findOrCreateFolder(drive, yearStr, thumbMedium);
  const thumbCamera = await findOrCreateFolder(drive, p.camera, thumbYear);
  const thumbFolderId = await findOrCreateFolder(drive, p.level4, thumbCamera);

  return { rawFolderId, thumbFolderId };
}

/**
 * Upload a file to Google Drive.
 */
export async function uploadToDrive(
  accessToken: string,
  file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
    folderId: string;
  }
): Promise<string> {
  const drive = createDriveClient(accessToken);

  const response = await drive.files.create({
    requestBody: {
      name: file.name,
      mimeType: file.mimeType,
      parents: [file.folderId],
    },
    media: {
      mimeType: file.mimeType,
      body: Readable.from(file.buffer),
    },
    fields: "id",
  });

  if (!response.data.id) {
    throw new Error("Failed to upload file to Google Drive");
  }

  return response.data.id;
}

/**
 * Initiate a Drive resumable upload session.
 *
 * Returns an opaque upload URL that the browser can PUT the file bytes to
 * directly, bypassing Vercel's 4.5MB serverless payload limit. The URL is
 * valid for ~7 days. Drive's resumable protocol supports pause/resume by
 * querying the URL with Content-Range: bytes *\/{total}.
 *
 * CORS: Drive enables CORS on the returned upload URL **only if** the
 * original POST here includes the browser's Origin. Without this header the
 * client's PUT is blocked with "No 'Access-Control-Allow-Origin' header".
 * Docs: https://developers.google.com/drive/api/guides/manage-uploads#resumable
 */
export async function createResumableUploadSession(
  accessToken: string,
  file: {
    name: string;
    mimeType: string;
    size: number;
    folderId: string;
    /** Browser origin that will PUT the bytes (required for CORS). */
    origin: string;
  }
): Promise<string> {
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.mimeType,
        "X-Upload-Content-Length": String(file.size),
        Origin: file.origin,
      },
      body: JSON.stringify({
        name: file.name,
        mimeType: file.mimeType,
        parents: [file.folderId],
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to create resumable upload session: ${response.status} ${response.statusText} ${body}`
    );
  }

  const uploadUrl = response.headers.get("Location");
  if (!uploadUrl) {
    throw new Error(
      "Drive resumable init succeeded but no Location header returned"
    );
  }
  return uploadUrl;
}

/**
 * Stream a file from Google Drive without buffering.
 * Returns a fetch Response whose body is a ReadableStream.
 * Avoids Vercel's 4.5MB serverless payload limit.
 */
export async function streamFromDrive(
  accessToken: string,
  fileId: string
): Promise<Response> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(
      `Drive download failed: ${response.status} ${response.statusText}`
    );
  }

  return response;
}

/**
 * Delete a file from Google Drive.
 */
export async function deleteFromDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  const drive = createDriveClient(accessToken);
  await drive.files.delete({ fileId });
}

// ─── Helpers ─────────────────────────────────────────────

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  // Drive query syntax requires escaping single quotes in the name.
  const escaped = name.replace(/'/g, "\\'");
  const query = [
    `name = '${escaped}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `'${parentId}' in parents`,
    `trashed = false`,
  ].join(" and ");

  const existing = await drive.files.list({
    q: query,
    fields: "files(id)",
    spaces: "drive",
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error(`Failed to create folder: ${name}`);
  }

  return created.data.id;
}
