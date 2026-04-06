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

/** Subfolder names inside the root folder */
export const DRIVE_FOLDERS = {
  originals: "originals",
  thumbnails: "thumbnails",
} as const;
