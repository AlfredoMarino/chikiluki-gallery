/**
 * Smoke tests for src/lib/drive/path.ts
 *
 * Run with: npx tsx scripts/test-path.ts
 *
 * No test framework — just plain assertions. Exits non-zero on failure so it
 * can be wired into CI later if needed.
 */
import {
  normalizeSlug,
  parseYear,
  parseDate,
  parseIso,
  buildLevel4Folder,
  buildStoredFilename,
  validateSession,
  getExtensionFromFile,
  InvalidSessionInputError,
  type Session,
} from "../src/lib/drive/path";

let passed = 0;
let failed = 0;

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual === expected) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.error(
      `  FAIL ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`
    );
  }
}

function assertThrows(fn: () => unknown, field: string, label: string) {
  try {
    fn();
    failed++;
    console.error(`  FAIL ${label} — expected throw but got value`);
  } catch (e) {
    if (e instanceof InvalidSessionInputError && e.field === field) {
      passed++;
      console.log(`  ok  ${label}`);
    } else {
      failed++;
      console.error(
        `  FAIL ${label} — wrong error: ${e instanceof Error ? `${e.name}/${(e as InvalidSessionInputError).field}: ${e.message}` : String(e)}`
      );
    }
  }
}

// ─── normalizeSlug ───────────────────────────────────────
console.log("\nnormalizeSlug");
assertEq(normalizeSlug("Canon 500D"), "canon-500d", "Canon 500D");
assertEq(normalizeSlug("Ilford HP5+"), "ilford-hp5", "Ilford HP5+");
assertEq(
  normalizeSlug("Cumpleaños Maite!"),
  "cumpleanos-maite",
  "accents stripped"
);
assertEq(
  normalizeSlug("  multiple   spaces  "),
  "multiple-spaces",
  "whitespace collapsed"
);
assertEq(normalizeSlug("a---b"), "a-b", "hyphens collapsed");
assertEq(normalizeSlug("--leading-trailing--"), "leading-trailing", "trim hyphens");
assertThrows(() => normalizeSlug(""), "value", "empty string rejected");
assertThrows(() => normalizeSlug("!!!"), "value", "all symbols rejected");
assertThrows(
  () => normalizeSlug("a".repeat(60)),
  "value",
  "too long rejected"
);

// ─── parseYear ───────────────────────────────────────────
console.log("\nparseYear");
assertEq(parseYear(2025), 2025, "2025 ok");
assertEq(parseYear("2026"), 2026, "string '2026' ok");
assertThrows(() => parseYear(1800), "year", "1800 rejected");
assertThrows(() => parseYear(9999), "year", "9999 rejected");
assertThrows(() => parseYear("nope"), "year", "non-numeric rejected");

// ─── parseDate ───────────────────────────────────────────
console.log("\nparseDate");
assertEq(parseDate("2025-05-15").yyyymmdd, "20250515", "YYYY-MM-DD");
assertEq(parseDate("20250515").yyyymmdd, "20250515", "YYYYMMDD");
assertEq(parseDate("2025-05-15").year, 2025, "year extracted");
assertThrows(() => parseDate("2025-02-30"), "date", "Feb 30 rejected");
assertThrows(() => parseDate("2025-13-01"), "date", "month 13 rejected");
assertThrows(() => parseDate("not-a-date"), "date", "garbage rejected");
assertThrows(() => parseDate("20250515x"), "date", "extra chars rejected");

// ─── parseIso ────────────────────────────────────────────
console.log("\nparseIso");
assertEq(parseIso(0), 0, "0 = unknown sentinel");
assertEq(parseIso(400), 400, "400 ok");
assertEq(parseIso("3200"), 3200, "string ok");
assertThrows(() => parseIso(-1), "iso", "negative rejected");
assertThrows(() => parseIso(10000), "iso", "10000 rejected");

// ─── getExtensionFromFile ────────────────────────────────
console.log("\ngetExtensionFromFile");
assertEq(getExtensionFromFile("photo.jpg"), "jpg", ".jpg");
assertEq(getExtensionFromFile("PHOTO.JPEG"), "jpeg", ".JPEG → jpeg");
assertEq(getExtensionFromFile("a.b.png"), "png", "multi-dot uses last");
assertThrows(() => getExtensionFromFile(""), "file", "empty rejected");
assertThrows(() => getExtensionFromFile("noext"), "file", "no ext rejected");
assertThrows(
  () => getExtensionFromFile("photo.webp"),
  "file",
  ".webp rejected"
);
assertThrows(
  () => getExtensionFromFile("photo.avif"),
  "file",
  ".avif rejected"
);
assertThrows(
  () => getExtensionFromFile("scan.tiff"),
  "file",
  ".tiff rejected"
);

// ─── buildLevel4Folder ───────────────────────────────────
console.log("\nbuildLevel4Folder");
const digital: Session = {
  medium: "digital",
  year: 2025,
  camera: "canon-500d",
  date: "20250515",
  description: "birthday-party",
};
assertEq(
  buildLevel4Folder(digital),
  "20250515_birthday-party",
  "digital level4"
);

const film: Session = {
  medium: "film",
  year: 2025,
  camera: "canon-prima-ii",
  date: "20250515",
  stock: "ilford-hp5",
  iso: 400,
  descriptors: "street-madrid",
};
assertEq(
  buildLevel4Folder(film),
  "20250515_ilford-hp5_400_street-madrid",
  "film level4 with descriptors"
);

const filmNoDesc: Session = { ...film, descriptors: null };
assertEq(
  buildLevel4Folder(filmNoDesc),
  "20250515_ilford-hp5_400",
  "film level4 without descriptors"
);

const filmUnknown: Session = {
  ...film,
  stock: "x",
  iso: 0,
  descriptors: null,
};
assertEq(
  buildLevel4Folder(filmUnknown),
  "20250515_x_0",
  "film level4 unknown stock+iso"
);

// ─── buildStoredFilename ─────────────────────────────────
console.log("\nbuildStoredFilename");
assertEq(
  buildStoredFilename("20250515_kodak_400", 7, "jpg"),
  "20250515_kodak_400_0007.jpg",
  "padded seq"
);
assertEq(
  buildStoredFilename("20250515_birthday-party", 1234, "png"),
  "20250515_birthday-party_1234.png",
  "4-digit seq"
);
assertThrows(
  () => buildStoredFilename("x", 0, "jpg"),
  "seq",
  "seq=0 rejected"
);

// ─── validateSession round-trip ──────────────────────────
console.log("\nvalidateSession");
const digRT = validateSession({
  medium: "digital",
  year: 2025,
  camera: "Canon 500D",
  date: "2025-05-15",
  description: "birthday party",
});
assertEq(digRT.medium, "digital", "digital medium");
assertEq(digRT.camera, "canon-500d", "digital camera normalized");
assertEq(
  buildLevel4Folder(digRT),
  "20250515_birthday-party",
  "digital round-trip level4"
);

const filmRT = validateSession({
  medium: "film",
  camera: "Canon Prima II",
  date: "20250515",
  stock: "Ilford HP5",
  iso: 400,
  descriptors: "street madrid",
});
assertEq(filmRT.medium, "film", "film medium");
assertEq(filmRT.camera, "canon-prima-ii", "film camera normalized");
assertEq(
  buildLevel4Folder(filmRT),
  "20250515_ilford-hp5_400_street-madrid",
  "film round-trip level4"
);

const filmUnknownRT = validateSession({
  medium: "film",
  camera: "Holga",
  date: "2025-05-15",
  stock: "",
  iso: 0,
});
assertEq(
  buildLevel4Folder(filmUnknownRT),
  "20250515_x_0",
  "film unknown stock empty string → x"
);

assertThrows(
  () =>
    validateSession({
      medium: "digital",
      camera: "📷",
      date: "2025-05-15",
      description: "x",
    }),
  "camera",
  "emoji-only camera rejected"
);

assertThrows(
  () =>
    validateSession({
      medium: "digital",
      camera: "canon",
      date: "2025-05-15",
      description: "",
    }),
  "description",
  "empty description rejected"
);

assertThrows(
  () =>
    validateSession({
      medium: "film",
      camera: "canon",
      date: "2025-05-15",
      stock: "kodak",
      iso: -1,
    }),
  "iso",
  "iso=-1 rejected"
);

assertThrows(
  () =>
    validateSession({
      medium: "digital",
      year: 2024,
      camera: "canon",
      date: "2025-05-15",
      description: "x",
    }),
  "year",
  "year/date mismatch rejected"
);

// ─── summary ─────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
