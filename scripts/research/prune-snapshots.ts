#!/usr/bin/env tsx
/**
 * research:prune-snapshots — remove fetch snapshots past the 180-day retention window.
 *
 * THE CRON DOES THIS ON EVERY TICK. This is the manual path: the one a person runs after a backlog,
 * with a dry run first so they can see how much is about to go. Same function underneath, so there
 * is no second implementation of the retention rule to drift from the first.
 *
 *   npx tsx scripts/research/prune-snapshots.ts            # report only
 *   npx tsx scripts/research/prune-snapshots.ts --apply    # delete
 *
 * DRY RUN IS THE DEFAULT AND `--apply` IS THE FLAG, not the other way round. This deletes objects
 * from a bucket, and the difference between the two modes is whether somebody's evidence survives
 * a mistyped command.
 */
import { createAdminClient } from '../../lib/supabase/admin'
import { listExpiredSnapshots } from '../../lib/supabase/repositories/research/fetches'
import { pruneSnapshots, SNAPSHOT_RETENTION_DAYS } from '../../lib/scraper/workflows/prune'

const apply = process.argv.includes('--apply')

async function main(): Promise<void> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const expired = await listExpiredSnapshots(admin, cutoff, 1000)
  console.log(`\n▸ ${expired.length} snapshot(s) older than ${SNAPSHOT_RETENTION_DAYS} days`)
  console.log(`  cutoff: ${cutoff.toISOString()}`)

  if (expired.length === 0) {
    console.log('\n✓ nothing to prune\n')
    return
  }

  if (!apply) {
    for (const row of expired.slice(0, 10)) console.log(`    ${row.storage_key}`)
    if (expired.length > 10) console.log(`    … and ${expired.length - 10} more`)
    console.log('\n  Nothing was deleted. Pass --apply to remove them.\n')
    return
  }

  const removed = await pruneSnapshots(admin)
  console.log(`\n✓ ${removed} snapshot(s) removed\n`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
