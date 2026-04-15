import { drive_v3 } from "googleapis";
import { createDriveClient, DRIVE_ROOT_FOLDER, DRIVE_FOLDERS } from "./client";
import { Readable } from "stream";

/**
 * Ensure the app's folder structure exists in the user's Drive.
 * Creates "Chikiluki Gallery/originals" and "Chikiluki Gallery/thumbnails" if missing.
 * Returns the folder IDs.
 */
export async function ensureDriveFolders(accessToken: string) {
  const drive = createDriveClient(accessToken);

  const rootId = await findOrCreateFolder(drive, DRIVE_ROOT_FOLDER, "root");
  const originalsId = await findOrCreateFolder(
    drive,
    DRIVE_FOLDERS.originals,
    rootId
  );
  const thumbnailsId = await findOrCreateFolder(
    drive,
    DRIVE_FOLDERS.thumbnails,
    rootId
  );

  return { rootId, originalsId, thumbnailsId };
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
 * Download a file from Google Drive as a Buffer.
 */
export async function downloadFromDrive(
  accessToken: string,
  fileId: string
): Promise<Buffer> {
  const drive = createDriveClient(accessToken);

  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(response.data as ArrayBuffer);
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
    throw new Error(`Drive download failed: ${response.status} ${response.statusText}`);
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
  // Search for existing folder
  const query = [
    `name = '${name}'`,
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

  // Create folder
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
