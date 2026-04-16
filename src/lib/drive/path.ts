/**
 * Strict folder + filename convention for chikiluki-gallery uploads.
 *
 * Shared between client (uploader form preview) and server (upload route).
 * Plain TS, no external deps. The server treats the client as untrusted and
 * re-runs `validateSession` on every upload.
 *
 * Folder layout (under "Chikiluki Gallery/raw" and ".../thumbnails"):
 *
 *   raw/digital/{year}/{camera}/{YYYYMMDD_short-description}/{filename}
 *   raw/film/{year}/{camera}/{YYYYMMDD_stock_iso[_descriptive-words]}/{filename}
 *
 * Separator rules:
 *   - "_" between distinct fields
 *   - "-" between words within a field
 *   - camera is normalized to lowercase + hyphens
 *   - stock="x" means unknown, iso=0 means unknown
 *
 * Filename: `{level4_folder_name}_{N:04d}.{ext}` where N is server-assigned.
 */

// ─── Types ───────────────────────────────────────────────

export type Medium = "digital" | "film";

export type DigitalSession = {
  medium: "digital";
  year: number;
  camera: string; // normalized slug
  date: string; // "YYYYMMDD"
  description: string; // normalized slug
};

export type FilmSession = {
  medium: "film";
  year: number;
  camera: string; // normalized slug
  date: string; // "YYYYMMDD"
  stock: string; // normalized slug, or "x"
  iso: number; // 0..6400, 0 = unknown sentinel
  descriptors: string | null; // normalized slug, or null
};

export type Session = DigitalSession | FilmSession;

export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

const MAX_SLUG_LENGTH = 48;
const MIN_YEAR = 1900;
const MAX_ISO = 6400;

// ─── Errors ──────────────────────────────────────────────

export class InvalidSessionInputError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = "InvalidSessionInputError";
  }
}

// ─── Normalization ───────────────────────────────────────

/**
 * Normalize an arbitrary string into a URL-safe slug.
 *
 *   "Canon 500D"        → "canon-500d"
 *   "Ilford HP5+"       → "ilford-hp5"
 *   "Cumpleaños Maite!" → "cumpleanos-maite"
 *
 * Throws InvalidSessionInputError if the result is empty or > 48 chars.
 */
export function normalizeSlug(input: string, field = "value"): string {
  if (typeof input !== "string") {
    throw new InvalidSessionInputError(field, `${field} must be a string`);
  }

  const slug = input
    .normalize("NFKD")
    // Remove combining marks (accents)
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    // Replace whitespace runs with a single hyphen
    .replace(/\s+/g, "-")
    // Drop anything that is not [a-z0-9-]
    .replace(/[^a-z0-9-]/g, "")
    // Collapse repeated hyphens
    .replace(/-+/g, "-")
    // Strip leading/trailing hyphens
    .replace(/^-+|-+$/g, "");

  if (slug.length === 0) {
    throw new InvalidSessionInputError(
      field,
      `${field} is empty after normalization`
    );
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    throw new InvalidSessionInputError(
      field,
      `${field} is too long (max ${MAX_SLUG_LENGTH} chars after normalization)`
    );
  }

  return slug;
}

// ─── Field parsers ───────────────────────────────────────

export function parseYear(input: string | number, field = "year"): number {
  const n = typeof input === "number" ? input : parseInt(input, 10);
  if (!Number.isInteger(n)) {
    throw new InvalidSessionInputError(field, `${field} must be an integer`);
  }
  const maxYear = new Date().getUTCFullYear() + 1;
  if (n < MIN_YEAR || n > maxYear) {
    throw new InvalidSessionInputError(
      field,
      `${field} must be between ${MIN_YEAR} and ${maxYear}`
    );
  }
  return n;
}

/**
 * Accept "YYYY-MM-DD" or "YYYYMMDD". Validate that the components form a real
 * calendar date by round-tripping through Date.UTC.
 */
export function parseDate(
  input: string,
  field = "date"
): { year: number; yyyymmdd: string } {
  if (typeof input !== "string") {
    throw new InvalidSessionInputError(field, `${field} must be a string`);
  }

  const compact = input.replace(/-/g, "");
  if (!/^\d{8}$/.test(compact)) {
    throw new InvalidSessionInputError(
      field,
      `${field} must be YYYY-MM-DD or YYYYMMDD`
    );
  }

  const year = parseInt(compact.slice(0, 4), 10);
  const month = parseInt(compact.slice(4, 6), 10);
  const day = parseInt(compact.slice(6, 8), 10);

  // Round-trip: Date.UTC will silently overflow (e.g. month=2 day=30 → March 2)
  // so we re-extract the components and compare.
  const ts = Date.UTC(year, month - 1, day);
  const d = new Date(ts);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    throw new InvalidSessionInputError(field, `${field} is not a real date`);
  }

  // Also enforce the year window from parseYear to keep things consistent.
  parseYear(year, field);

  return { year, yyyymmdd: compact };
}

export function parseIso(input: string | number, field = "iso"): number {
  const n = typeof input === "number" ? input : parseInt(input, 10);
  if (!Number.isInteger(n)) {
    throw new InvalidSessionInputError(field, `${field} must be an integer`);
  }
  if (n < 0 || n > MAX_ISO) {
    throw new InvalidSessionInputError(
      field,
      `${field} must be between 0 and ${MAX_ISO} (0 = unknown)`
    );
  }
  return n;
}

// ─── Builders ────────────────────────────────────────────

export function buildLevel4Folder(session: Session): string {
  if (session.medium === "digital") {
    return `${session.date}_${session.description}`;
  }
  // Film
  const base = `${session.date}_${session.stock}_${session.iso}`;
  return session.descriptors ? `${base}_${session.descriptors}` : base;
}

export function buildStoredFilename(
  level4: string,
  seq: number,
  ext: string
): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new InvalidSessionInputError(
      "seq",
      "sequence number must be a positive integer"
    );
  }
  return `${level4}_${String(seq).padStart(4, "0")}.${ext}`;
}

// ─── File extension ──────────────────────────────────────

export function getExtensionFromFile(name: string): AllowedExtension {
  if (typeof name !== "string" || name.length === 0) {
    throw new InvalidSessionInputError("file", "file name is required");
  }
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) {
    throw new InvalidSessionInputError(
      "file",
      "file name has no extension"
    );
  }
  const ext = name.slice(dot + 1).toLowerCase();
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new InvalidSessionInputError(
      "file",
      `unsupported file extension ".${ext}" (allowed: ${ALLOWED_EXTENSIONS.join(", ")})`
    );
  }
  return ext as AllowedExtension;
}

// ─── Top-level validator ─────────────────────────────────

/**
 * Validate and normalize raw session metadata (from a form, FormData, JSON, …)
 * into a strongly-typed `Session`. Throws InvalidSessionInputError on any
 * invalid field; the upload route maps that to a 400 response.
 */
export function validateSession(raw: unknown): Session {
  if (!raw || typeof raw !== "object") {
    throw new InvalidSessionInputError("session", "session metadata is required");
  }

  const r = raw as Record<string, unknown>;

  const medium = r.medium;
  if (medium !== "digital" && medium !== "film") {
    throw new InvalidSessionInputError(
      "medium",
      "medium must be 'digital' or 'film'"
    );
  }

  const camera = normalizeSlug(asString(r.camera, "camera"), "camera");
  const { year, yyyymmdd } = parseDate(asString(r.date, "date"), "date");

  // Allow caller to also pass `year` explicitly; if so it must match the date.
  if (r.year !== undefined && r.year !== null && r.year !== "") {
    const explicitYear = parseYear(
      typeof r.year === "number" ? r.year : asString(r.year, "year"),
      "year"
    );
    if (explicitYear !== year) {
      throw new InvalidSessionInputError(
        "year",
        `year (${explicitYear}) does not match date (${year})`
      );
    }
  }

  if (medium === "digital") {
    const description = normalizeSlug(
      asString(r.description, "description"),
      "description"
    );
    return {
      medium: "digital",
      year,
      camera,
      date: yyyymmdd,
      description,
    };
  }

  // Film
  const stockRaw = asString(r.stock, "stock").trim();
  const stock =
    stockRaw === "" || stockRaw.toLowerCase() === "x"
      ? "x"
      : normalizeSlug(stockRaw, "stock");

  const iso = parseIso(
    typeof r.iso === "number" ? r.iso : asString(r.iso, "iso"),
    "iso"
  );

  let descriptors: string | null = null;
  if (r.descriptors !== undefined && r.descriptors !== null) {
    const s = String(r.descriptors).trim();
    if (s.length > 0) {
      descriptors = normalizeSlug(s, "descriptors");
    }
  }

  return {
    medium: "film",
    year,
    camera,
    date: yyyymmdd,
    stock,
    iso,
    descriptors,
  };
}

// ─── Internal helpers ────────────────────────────────────

function asString(v: unknown, field: string): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  throw new InvalidSessionInputError(field, `${field} is required`);
}
