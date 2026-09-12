#!/usr/bin/env tsx
/**
 * BIND MEDIA, AND NOTHING ELSE.
 *
 * WHY THIS EXISTS AND `seed:content` IS NOT ENOUGH. The content runner has two guards that stand
 * between a filled `MEDIA_BINDINGS` map and a section that shows a picture, and both of them are
 * correct:
 *
 *   1. `promotedByAHuman` (rule 5c) returns BEFORE the media-rebind branch. A seeded section is
 *      `DRAFT`; the launch routes were published by a person on 2026-09-12. So the sections that
 *      are actually LIVE are precisely the ones the runner will refuse to touch — the guard reads
 *      "a human shipped this row" and stands down, which is what it is for.
 *   2. `media_slot_key` is in `fields`, so it is inside the content hash. Adding a binding changes
 *      the hash, which takes the row off the rebind path and onto the ordinary update path — the
 *      one the first guard has already returned from.
 *
 * The result is a deadlock that is nobody's bug: `content/seed/media-bindings.ts` can be filled
 * perfectly and the live site still renders the SEED §47 fallback well on every band.
 *
 * SO THIS WRITES THREE COLUMNS AND REFUSES TO WRITE ANY OTHER. `media_desktop_id`,
 * `media_mobile_id`, `media_slot_key`. It never touches copy, never touches `status`, never touches
 * the seed hash, and never inserts a row — a binding for a section that does not exist is reported,
 * not created. That is what makes it safe to run against a database whose rows a person owns:
 * choosing a photograph is not the same act as publishing a sentence, and D10's concern is with
 * the sentence.
 *
 * AN ASSET THAT IS NOT IN `media_assets` FAILS THE RUN, by name. The rule is the seed runner's own
 * and the reason is the same: a binding naming an asset that is not there is a typo or a manifest
 * renumbering, not a gap. A GAP IS A MISSING ENTRY, and a gap is left alone — this script writes
 * nothing for a section with no binding, so a slot nobody has curated keeps its honest empty frame
 * rather than acquiring the nearest available picture.
 *
 * `--dry-run` IS THE POINT OF THE SCRIPT AS MUCH AS THE WRITE IS. Filling this map is an editorial
 * decision across a dozen pages, and the plan should be readable before it lands.
 *
 * Usage:
 *   npm run seed:bind-media -- --dry-run     print the plan, write nothing
 *   npm run seed:bind-media                  apply it
 */
import pg from 'pg'

import { seedModules } from '../../content/seed'
import type { SeedRecord } from '../../content/seed/types'

const dryRun = process.argv.includes('--dry-run')

const connectionString = process.env.DATABASE_URL
if (connectionString === undefined || connectionString === '') {
  console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
  process.exit(1)
}

/** The only columns this script is allowed to write. Anything else is the content runner's. */
const MEDIA_COLUMNS = ['media_desktop_id', 'media_mobile_id', 'media_slot_key'] as const

type Plan = {
  readonly seedKey: string
  readonly table: string
  readonly assignments: Record<string, string | null>
  readonly assets: Record<string, string>
}

/** Every seeded record that binds a picture, in module order. */
function boundRecords(): SeedRecord[] {
  return seedModules.flatMap((module) =>
    module.records.filter(
      (record) =>
        Object.keys(record.media ?? {}).length > 0 ||
        typeof record.fields['media_slot_key'] === 'string',
    ),
  )
}

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString })
  await client.connect()

  const records = boundRecords()
  if (records.length === 0) {
    console.log(
      'No seeded record binds a picture. `content/seed/media-bindings.ts` is empty — that is the\n' +
        'curation this script exists to apply, and it is outstanding rather than blocked.',
    )
    await client.end()
    return
  }

  const plans: Plan[] = []
  const missingAssets: string[] = []
  const missingRows: string[] = []

  for (const record of records) {
    const assignments: Record<string, string | null> = {}
    const assets: Record<string, string> = {}

    const slotKey = record.fields['media_slot_key']
    if (typeof slotKey === 'string') assignments['media_slot_key'] = slotKey

    for (const [column, rivyaAssetId] of Object.entries(record.media ?? {})) {
      const found = await client.query<{ id: string }>(
        'select id from media_assets where rivya_asset_id = $1 limit 1',
        [rivyaAssetId],
      )
      const id = found.rows[0]?.id
      if (id === undefined) {
        missingAssets.push(`${record.seedKey}: ${column} → ${rivyaAssetId}`)
        continue
      }
      assignments[column] = id
      assets[column] = rivyaAssetId
    }

    if (Object.keys(assignments).length === 0) continue

    const exists = await client.query(`select 1 from ${record.table} where seed_key = $1 limit 1`, [
      record.seedKey,
    ])
    if (exists.rowCount === 0) {
      missingRows.push(`${record.seedKey} (${record.table})`)
      continue
    }

    plans.push({ seedKey: record.seedKey, table: record.table, assignments, assets })
  }

  for (const plan of plans) {
    const columns = Object.keys(plan.assignments)
    const described = columns
      .map((column) =>
        column === 'media_slot_key'
          ? `slot=${String(plan.assignments[column])}`
          : `${column.replace('media_', '').replace('_id', '')}=${plan.assets[column] ?? '—'}`,
      )
      .join('  ')
    console.log(`  ${plan.seedKey.padEnd(38)} ${described}`)
  }

  /*
   * A MISSING ASSET IS A FAILURE AND A MISSING ROW IS NOT, and the difference is which end is
   * wrong. An asset the manifest does not have means the binding names something that does not
   * exist — a typo, or a family renumbered by a manifest rebuild. A row that is not in the database
   * means this database has not been seeded yet, which is a state, not a mistake.
   */
  if (missingRows.length > 0) {
    console.log(
      `\n  ${String(missingRows.length)} section(s) not in this database — run seed:content first:`,
    )
    for (const row of missingRows) console.log(`    ${row}`)
  }

  if (missingAssets.length > 0) {
    console.error(
      `\n  ${String(missingAssets.length)} binding(s) name an asset this database does not have:`,
    )
    for (const asset of missingAssets) console.error(`    ${asset}`)
    console.error(
      '\n  Run the Higgsfield migration (docs/media/MEDIA_GUIDE.md), or fix the binding.',
    )
    await client.end()
    process.exit(1)
  }

  if (dryRun) {
    console.log(`\n  --dry-run: ${String(plans.length)} row(s) would be bound. Nothing written.`)
    await client.end()
    return
  }

  let written = 0
  for (const plan of plans) {
    const columns = Object.keys(plan.assignments).filter((column) =>
      (MEDIA_COLUMNS as readonly string[]).includes(column),
    )
    if (columns.length === 0) continue
    const sets = columns.map((column, index) => `"${column}" = $${String(index + 1)}`)
    const values = columns.map((column) => plan.assignments[column] ?? null)
    await client.query(
      `update ${plan.table} set ${sets.join(', ')} where seed_key = $${String(columns.length + 1)}`,
      [...values, plan.seedKey],
    )
    written += 1
  }

  console.log(`\n  bound ${String(written)} row(s). No copy, status or seed hash was touched.`)
  await client.end()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
