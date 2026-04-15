import { google } from "googleapis";

/**
 * Create an authenticated Google Drive client for a user.
 */
export function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.drive({ version: "v3", auth });
}

/** Name of the root folder the app creates in the user's Drive */
export const DRIVE_ROOT_FOLDER = "Chikiluki Gallery";

/**
 * Top-level subfolder names inside the root folder.
 * `raw/` holds full-resolution originals organized by medium/year/camera/session.
 * `thumbnails/` mirrors the same hierarchy with JPEG previews.
 */
export const DRIVE_TOP = {
  raw: "raw",
  thumbnails: "thumbnails",
} as const;
