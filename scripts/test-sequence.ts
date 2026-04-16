/**
 * Smoke + race tests for src/lib/drive/sequence.ts.
 *
 * Run with: npx tsx scripts/test-sequence.ts
 *
 * Requires DATABASE_URL pointing at a Postgres with the schema applied.
 * Picks any existing user (the FK target) and uses unique session-folder
 * names so the tests never collide with real data. Cleans up after itself.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { users, photoSessionCounters } from "../src/lib/db/schema";
import {
  allocateSessionSeq,
  allocateSessionSeqBatch,
  cacheSessionFolderIds,
  getCachedSessionFolderIds,
} from "../src/lib/drive/sequence";
import { and, eq, like } from "drizzle-orm";

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

function assertDeepEq<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.error(
      `  FAIL ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`
    );
  }
}

const TEST_PREFIX = `__seq_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_`;

async function main() {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) {
    console.error("No users in DB. Log in once via the app and re-run.");
    process.exit(1);
  }
  const userId = user.id;
  console.log(`Using user ${userId}`);

  try {
    // ─── Sequential allocation ─────────────────────────────
    console.log("\nallocateSessionSeq (sequential)");
    const fA = `${TEST_PREFIX}seq`;
    assertEq(await allocateSessionSeq(userId, fA), 1, "first = 1");
    assertEq(await allocateSessionSeq(userId, fA), 2, "second = 2");
    assertEq(await allocateSessionSeq(userId, fA), 3, "third = 3");

    // ─── Independent folders ──────────────────────────────
    console.log("\nseparate folders have independent counters");
    const fB = `${TEST_PREFIX}other`;
    assertEq(await allocateSessionSeq(userId, fB), 1, "other folder starts at 1");

    // ─── Race (20 parallel) ───────────────────────────────
    console.log("\nrace (20 parallel allocateSessionSeq)");
    const fRace = `${TEST_PREFIX}race`;
    const raceResults = await Promise.all(
      Array.from({ length: 20 }, () => allocateSessionSeq(userId, fRace))
    );
    const sorted = [...raceResults].sort((a, b) => a - b);
    assertDeepEq(
      sorted,
      Array.from({ length: 20 }, (_, i) => i + 1),
      "20 parallel returns exactly {1..20}"
    );

    // ─── Batch allocation ─────────────────────────────────
    console.log("\nallocateSessionSeqBatch");
    const fBatch = `${TEST_PREFIX}batch`;
    assertDeepEq(
      await allocateSessionSeqBatch(userId, fBatch, 5),
      [1, 2, 3, 4, 5],
      "batch of 5 from fresh"
    );
    assertDeepEq(
      await allocateSessionSeqBatch(userId, fBatch, 3),
      [6, 7, 8],
      "next batch of 3 continues"
    );
    assertEq(
      await allocateSessionSeq(userId, fBatch),
      9,
      "single after batch continues"
    );

    // ─── Batch race ───────────────────────────────────────
    console.log("\nbatch race (5 parallel batches of 4 each)");
    const fBatchRace = `${TEST_PREFIX}batch_race`;
    const batchResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        allocateSessionSeqBatch(userId, fBatchRace, 4)
      )
    );
    const flat = batchResults.flat().sort((a, b) => a - b);
    assertDeepEq(
      flat,
      Array.from({ length: 20 }, (_, i) => i + 1),
      "5 parallel batches of 4 yield {1..20}"
    );
    // Also verify each batch returned 4 consecutive numbers
    const allConsecutive = batchResults.every(
      (b) => b.length === 4 && b[3] === b[0] + 3
    );
    assertEq(allConsecutive, true, "each batch is internally consecutive");

    // ─── Folder ID cache ──────────────────────────────────
    console.log("\nfolder ID cache");
    const fCache = `${TEST_PREFIX}cache`;
    await allocateSessionSeq(userId, fCache); // ensure row exists
    assertEq(
      await getCachedSessionFolderIds(userId, fCache),
      null,
      "no cache before caching"
    );
    await cacheSessionFolderIds(userId, fCache, {
      rawFolderId: "raw-abc-123",
      thumbFolderId: "thumb-xyz-789",
    });
    assertDeepEq(
      await getCachedSessionFolderIds(userId, fCache),
      { rawFolderId: "raw-abc-123", thumbFolderId: "thumb-xyz-789" },
      "cache returns stored IDs"
    );
    assertEq(
      await getCachedSessionFolderIds(userId, `${TEST_PREFIX}nonexistent`),
      null,
      "missing session returns null"
    );

    console.log(`\n${passed} passed, ${failed} failed`);
  } finally {
    // Remove every counter row we created.
    await db
      .delete(photoSessionCounters)
      .where(
        and(
          eq(photoSessionCounters.userId, userId),
          like(photoSessionCounters.sessionFolder, `${TEST_PREFIX}%`)
        )
      );
    console.log("cleaned up test rows");
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test-sequence fatal:", e);
  process.exit(1);
});
