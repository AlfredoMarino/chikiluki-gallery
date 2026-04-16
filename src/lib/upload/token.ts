import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Opaque, signed token carrying everything `finalize` needs to complete an
 * upload that `init` already reserved. Prevents the client from tampering
 * with the sequence number, folder ID, or hash between the two requests.
 *
 * Token format: `{base64url(json)}.{base64url(hmac)}`
 * Signed with `AUTH_SECRET` (the NextAuth v5 secret, already required in prod).
 */

export type UploadTokenPayload = {
  /** User who initiated the upload. Must match the session on finalize. */
  userId: string;
  /** Level4 folder name (e.g. `20250515_ilford-hp5_400`). */
  sessionFolder: string;
  /** 1-indexed sequence within the folder, assigned by allocateSessionSeq. */
  sessionSeq: number;
  /** `{level4}_{NNNN}.{ext}` — final name on Drive. */
  storedFilename: string;
  /** Drive folder IDs (raw + thumbnail) resolved during init. */
  rawFolderId: string;
  thumbFolderId: string;
  /** Content-addressed dedup key computed client-side from the file bytes. */
  fileHash: string;
  /** Declared MIME type of the original. */
  mimeType: string;
  /** Original filename as uploaded — kept for `photos.originalName`. */
  originalName: string;
  /** Declared byte size — used as a sanity check after Drive upload. */
  fileSize: number;
  /** Canonical, re-normalized session metadata. Copied into the photos row. */
  session: {
    medium: "digital" | "film";
    year: number;
    camera: string;
    date: string;
    description?: string;
    stock?: string;
    iso?: number;
    descriptors?: string | null;
  };
  /** Unix seconds — token rejected after this. */
  exp: number;
};

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 2; // 2 days; Drive URLs last 7

function getSecret(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. It is required to sign upload tokens."
    );
  }
  return Buffer.from(secret, "utf8");
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(padded, "base64");
}

export function signUploadToken(
  payload: Omit<UploadTokenPayload, "exp">,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string {
  const full: UploadTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64urlEncode(Buffer.from(JSON.stringify(full), "utf8"));
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export class InvalidUploadTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUploadTokenError";
  }
}

export function verifyUploadToken(token: string): UploadTokenPayload {
  if (typeof token !== "string" || !token.includes(".")) {
    throw new InvalidUploadTokenError("malformed token");
  }
  const [body, sig] = token.split(".", 2);
  if (!body || !sig) {
    throw new InvalidUploadTokenError("malformed token");
  }

  const expected = createHmac("sha256", getSecret()).update(body).digest();
  let provided: Buffer;
  try {
    provided = b64urlDecode(sig);
  } catch {
    throw new InvalidUploadTokenError("malformed signature");
  }
  if (provided.length !== expected.length) {
    throw new InvalidUploadTokenError("invalid signature");
  }
  if (!timingSafeEqual(provided, expected)) {
    throw new InvalidUploadTokenError("invalid signature");
  }

  let payload: UploadTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    throw new InvalidUploadTokenError("malformed payload");
  }

  if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
    throw new InvalidUploadTokenError("token expired");
  }

  return payload;
}
