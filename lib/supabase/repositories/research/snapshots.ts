import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'

type Client = SupabaseClient<Database>

/**
 * Where a fetched page body is kept.
 *
 * SUPABASE STORAGE, IN A PRIVATE BUCKET, AND NOT CLOUDINARY. Cloudinary is Rivya's MEDIA
 * pipeline: everything in it is intended to be transformed and served from a public CDN URL, which
 * is precisely wrong for a competitor's HTML. Putting a snapshot there would publish somebody
 * else's page from a Rivya origin — a copyright and a reputational problem created by choosing the
 * convenient store. D6 draws that line for media; this is the other side of it.
 *
 * IT ALSO COSTS NOTHING NEW. The bucket lives in the Supabase project this repository already
 * uses, under the service-role key already in D8, so the snapshot store needs no new vendor, no
 * new credential and no new line in the environment.
 *
 * THE BUCKET IS PRIVATE AND HAS NO PUBLIC URL. Nothing serves these objects; they are read back
 * only by Phase 29's change detection, through the service role. `.storage.from(...)` is a bucket
 * handle rather than a table query, but it lives in the repository layer for the same reason every
 * other Supabase call does: one place that talks to the platform, so one place to audit.
 */

export const SNAPSHOT_BUCKET = 'research-snapshots'

/**
 * Store one gzipped snapshot.
 *
 * IT RETURNS NULL RATHER THAN THROWING WHEN STORAGE REFUSES. A snapshot is evidence, and evidence
 * is worth having — but a bucket that is missing or full must not fail the fetch that produced it.
 * The `research_fetches` row still records the URL, the status, the hash and the byte count, which
 * is most of what the snapshot was for; losing the body degrades Phase 29's diff to "the hash
 * changed" rather than losing the run. Failing the item instead would mean a storage
 * misconfiguration silently halting every research run, which is a far worse trade.
 */
export async function storeSnapshot(
  admin: Client,
  input: { readonly key: string; readonly body: Buffer },
): Promise<string | null> {
  const { error } = await admin.storage.from(SNAPSHOT_BUCKET).upload(input.key, input.body, {
    contentType: 'application/gzip',
    // A content-addressed key means an identical page produces an identical key. Upserting makes
    // a re-fetch of unchanged content a no-op rather than a conflict.
    upsert: true,
  })
  if (error !== null) return null
  return input.key
}

/** Remove one snapshot object. Called by the pruner BEFORE it clears the row's key. */
export async function deleteSnapshot(admin: Client, key: string): Promise<boolean> {
  const { error } = await admin.storage.from(SNAPSHOT_BUCKET).remove([key])
  return error === null
}

/** Read a snapshot back. Phase 29's change detection is the only caller this is built for. */
export async function readSnapshot(admin: Client, key: string): Promise<Blob | null> {
  const { data, error } = await admin.storage.from(SNAPSHOT_BUCKET).download(key)
  if (error !== null) return null
  return data
}
