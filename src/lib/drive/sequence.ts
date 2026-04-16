import { db } from "@/lib/db";
import { photoSessionCounters } from "@/lib/db/schema";
import { sql, and, eq } from "drizzle-orm";

/**
 * Allocate the next sequence number for a session folder.
 *
 * Race-safe via a single Postgres atomic upsert. Concurrent uploads to the
 * same session always get distinct, monotonically increasing numbers.
 *
 * NOTE: gaps are possible. If an upload fails after allocating a sequence
 * number (e.g. Drive 5xx), that number stays burned. The result is filenames
 * like `_0001, _0003, _0004` with `_0002` missing. This is by design.
 */
export async function allocateSessionSeq(
  userId: string,
  sessionFolder: string
): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO photo_session_counters (user_id, session_folder, next_seq, updated_at)
    VALUES (${userId}, ${sessionFolder}, 2, NOW())
    ON CONFLICT (user_id, session_folder)
    DO UPDATE SET
      next_seq = photo_session_counters.next_seq + 1,
      updated_at = NOW()
    RETURNING next_seq - 1 AS seq
  `);

  const row = result.rows[0] as { seq: number | string } | undefined;
  if (!row) {
    throw new Error("allocateSessionSeq: upsert returned no row");
  }
  return Number(row.seq);
}

/**
 * Allocate N consecutive sequence numbers in a single atomic upsert.
 *
 * Returns an array `[start, start+1, …, start+count-1]`. This is the
 * preferred path for batch uploads (user clicks "Guardar" on 36 photos):
 * single DB round-trip, guaranteed-consecutive numbers in drop order,
 * no interleaving with concurrent uploads to the same session.
 *
 * Same gap caveat as the single version: if some uploads in the batch fail,
 * their sequence numbers stay burned.
 */
export async function allocateSessionSeqBatch(
  userId: string,
  sessionFolder: string,
  count: number
): Promise<number[]> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("allocateSessionSeqBatch: count must be >= 1");
  }

  const result = await db.execute(sql`
    INSERT INTO photo_session_counters (user_id, session_folder, next_seq, updated_at)
    VALUES (${userId}, ${sessionFolder}, ${count + 1}, NOW())
    ON CONFLICT (user_id, session_folder)
    DO UPDATE SET
      next_seq = photo_session_counters.next_seq + ${count},
      updated_at = NOW()
    RETURNING next_seq - ${count} AS start
  `);

  const row = result.rows[0] as { start: number | string } | undefined;
  if (!row) {
    throw new Error("allocateSessionSeqBatch: upsert returned no row");
  }
  const start = Number(row.start);
  return Array.from({ length: count }, (_, i) => start + i);
}

/**
 * Cache the resolved Drive folder IDs on the counter row so that subsequent
 * uploads to the same session skip the ~10-call `ensureSessionFolders` walk.
 *
 * Always called after a successful allocateSessionSeq (which guarantees the
 * row exists), so we use UPDATE rather than another upsert.
 */
export async function cacheSessionFolderIds(
  userId: string,
  sessionFolder: string,
  ids: { rawFolderId: string; thumbFolderId: string }
): Promise<void> {
  await db
    .update(photoSessionCounters)
    .set({
      driveFolderId: ids.rawFolderId,
      driveThumbFolderId: ids.thumbFolderId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(photoSessionCounters.userId, userId),
        eq(photoSessionCounters.sessionFolder, sessionFolder)
      )
    );
}

/**
 * Look up cached Drive folder IDs for a session, if they exist.
 * Returns null on the first upload to a session (counter row doesn't exist
 * yet) or if the row exists but the IDs haven't been cached yet.
 */
export async function getCachedSessionFolderIds(
  userId: string,
  sessionFolder: string
): Promise<{ rawFolderId: string; thumbFolderId: string } | null> {
  const [row] = await db
    .select({
      driveFolderId: photoSessionCounters.driveFolderId,
      driveThumbFolderId: photoSessionCounters.driveThumbFolderId,
    })
    .from(photoSessionCounters)
    .where(
      and(
        eq(photoSessionCounters.userId, userId),
        eq(photoSessionCounters.sessionFolder, sessionFolder)
      )
    );

  if (!row || !row.driveFolderId || !row.driveThumbFolderId) {
    return null;
  }
  return {
    rawFolderId: row.driveFolderId,
    thumbFolderId: row.driveThumbFolderId,
  };
}
