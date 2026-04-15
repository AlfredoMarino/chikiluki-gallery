/**
 * Race test for allocateSessionSeq.
 *
 * Run with: npx tsx scripts/test-sequence.ts
 *
 * Spawns 20 parallel allocateSessionSeq calls against a unique test session
 * folder, then asserts the returned numbers are exactly {1..20} with no
 * duplicates. Requires DATABASE_URL and a real user row.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { users, photoSessionCounters } from "../src/lib/db/schema";
import { allocateSessionSeq } from "../src/lib/drive/sequence";
import { eq, and } from "drizzle-orm";

const N = 20;

async function main() {
  // Grab any existing user for the FK; the plan is run after initial login.
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) {
    console.error("No users in DB. Log in once via the app and re-run.");
    process.exit(1);
  }

  const sessionFolder = `__test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const promises = Array.from({ length: N }, () =>
      allocateSessionSeq(user.id, sessionFolder)
    );
    const results = await Promise.all(promises);

    results.sort((a, b) => a - b);
    const expected = Array.from({ length: N }, (_, i) => i + 1);
    const ok =
      results.length === N && results.every((v, i) => v === expected[i]);

    if (ok) {
      console.log(`ok  ${N} parallel allocations returned ${results.join(",")}`);
    } else {
      console.error(`FAIL expected ${expected.join(",")}`);
      console.error(`     got      ${results.join(",")}`);
      process.exit(1);
    }
  } finally {
    // Clean up the test counter row so we don't leak garbage.
    await db
      .delete(photoSessionCounters)
      .where(
        and(
          eq(photoSessionCounters.userId, user.id),
          eq(photoSessionCounters.sessionFolder, sessionFolder)
        )
      );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
