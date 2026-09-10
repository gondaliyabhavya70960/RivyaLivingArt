import 'server-only'

import type { Database } from '@/lib/supabase/database.types'
import {
  clearSnapshotKey,
  listExpiredSnapshots,
} from '@/lib/supabase/repositories/research/fetches'
import { deleteSnapshot } from '@/lib/supabase/repositories/research/snapshots'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Snapshot retention: 180 days, swept by the same cron that writes them.
 *
 * THE OBJECT GOES FIRST AND THE KEY SECOND, AND THE ORDER IS THE WHOLE DESIGN. Clearing the row
 * first would lose the only pointer to the object, which then sits in the bucket forever — a
 * retention policy that produces a slowly growing bill nobody can explain, and a store of third
 * parties' page bodies that outlives the policy that was supposed to remove it. Doing it this way
 * round, a crash between the two steps leaves a row whose object is already gone; the next sweep
 * tries to delete it again, the delete is a no-op, and the key is cleared. Idempotent in the safe
 * direction.
 *
 * THE FETCH ROW ITSELF IS NEVER DELETED. It is the record that Rivya made a request to somebody
 * else's server — the URL, the time, the status, the robots decision — and that record is the
 * evidence the whole politeness posture rests on. What expires is the BODY, which is the part that
 * is both large and somebody else's.
 *
 * BOUNDED PER TICK. Five hundred objects, then stop. A first sweep after a long backlog must not
 * spend the whole invocation deleting, because the invocation's real job is fetching and a
 * retention window is not an emergency.
 */

type Client = SupabaseClient<Database>

export const SNAPSHOT_RETENTION_DAYS = 180

/** How many snapshots one tick will remove. */
export const PRUNE_BATCH = 500

export async function pruneSnapshots(admin: Client, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const expired = await listExpiredSnapshots(admin, cutoff, PRUNE_BATCH)

  let removed = 0
  for (const row of expired) {
    const gone = await deleteSnapshot(admin, row.storage_key)
    // A FAILED DELETE LEAVES THE KEY IN PLACE so the next sweep tries again. Clearing it anyway
    // would turn a transient storage error into a permanently orphaned object.
    if (!gone) continue
    await clearSnapshotKey(admin, row.id)
    removed += 1
  }
  return removed
}
