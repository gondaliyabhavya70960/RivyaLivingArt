#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { ALT_TEXT } from '../../content/media/alt-text'
import { altTextWarnings } from '../../lib/media/alt-text-quality'
import type { Database } from '../../lib/supabase/database.types'
import { listAltTextByAssetId, updateMediaAsset } from '../../lib/supabase/repositories/media'
import { publicEnv, serverEnv } from '../../lib/supabase/env'

/**
 * `npm run media:rewrite-alt-text -- [--apply] [--id=RIVYA-ASSET-ID]` — Phase 43.
 *
 * Carries the reviewed values in `content/media/alt-text.ts` into `media_assets.alt_text`, matching
 * on `rivya_asset_id`.
 *
 * A DRY RUN BY DEFAULT, like every other write this project ships from a terminal. It prints which
 * assets would change and what the value would become, and writes nothing until `--apply`. Alt text
 * is the field a sighted reviewer never sees change, which makes a silent mass update exactly the
 * wrong shape for it.
 *
 * IT REFUSES A VALUE THAT FAILS THE LINTER rather than writing it and leaving the gate to complain
 * afterwards. `check-alt-text.mjs` and this script share `altTextWarnings`, so a value that would
 * fail CI cannot reach the database through here.
 *
 * `owner_verification` IS NOT TOUCHED, and that is the point of the whole exercise being reviewable:
 * every one of the 250 stays `OWNER_VERIFICATION_REQUIRED` until an editor approves it in the
 * Studio's alt-text queue. A script that flipped it would be asserting that somebody had looked at
 * 250 pictures.
 *
 * THE SERVICE ROLE, because this runs from a terminal with no session and writes a column an
 * editor's own policies do allow — but there is no editor here to attribute it to. `updated_by`
 * stays null, which reads correctly in the Studio as "changed by a script".
 */

const ENV_PATH = '.env.local'

export interface RewriteOptions {
  readonly apply: boolean
  readonly only: string | undefined
}

export function parseArgs(argv: readonly string[]): RewriteOptions | { readonly error: string } {
  let apply = false
  let only: string | undefined
  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true
      continue
    }
    if (arg.startsWith('--id=')) {
      only = arg.slice('--id='.length)
      continue
    }
    return { error: `Unrecognised argument: ${arg}` }
  }
  return { apply, only }
}

async function main(): Promise<void> {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH)
  const parsed = parseArgs(process.argv.slice(2))
  if ('error' in parsed) {
    console.error(parsed.error)
    process.exit(2)
  }

  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const wanted = Object.entries(ALT_TEXT).filter(
    ([id]) => parsed.only === undefined || id === parsed.only,
  )

  const refused = wanted.filter(([, value]) => altTextWarnings(value).length > 0)
  if (refused.length > 0) {
    console.error(
      `✗ ${String(refused.length)} value(s) fail the SEED §43 rules and none was written:`,
    )
    for (const [id, value] of refused.slice(0, 10)) {
      console.error(`    ${id.padEnd(28)} ${altTextWarnings(value).join(', ')}`)
      console.error(`    ${' '.repeat(28)} ${value.slice(0, 90)}`)
    }
    process.exit(1)
  }

  /*
   * THROUGH THE REPOSITORY, not through the client directly. `npm run db:check-data-layer` refuses
   * a `.from(` anywhere outside `lib/supabase/repositories/**`, scripts included, because the Zod
   * schema and the error mapping live there — and a script that queried directly would be the one
   * caller with no schema behind it.
   */
  const rows = await listAltTextByAssetId(admin)
  const byAssetId = new Map(rows.map((row) => [row.rivya_asset_id, row]))

  let changed = 0
  let unchanged = 0
  let missing = 0

  for (const [assetId, value] of wanted) {
    const row = byAssetId.get(assetId)
    if (row === undefined) {
      missing += 1
      continue
    }
    if (row.alt_text === value) {
      unchanged += 1
      continue
    }
    changed += 1
    if (!parsed.apply) {
      console.log(`  ${assetId}`)
      console.log(`    was: ${row.alt_text.slice(0, 90)}`)
      console.log(`    now: ${value.slice(0, 90)}`)
      continue
    }
    // `null` actor: this is a script, and `updated_by` naming nobody reads correctly in the Studio
    // as "changed by a script" rather than falsely attributing 250 edits to whoever ran it.
    await updateMediaAsset(admin, row.id, { alt_text: value }, null)
  }

  console.log(
    parsed.apply
      ? `\n✓ ${String(changed)} asset(s) rewritten, ${String(unchanged)} already current` +
          (missing > 0 ? `, ${String(missing)} not in the database yet` : '') +
          '. owner_verification untouched: every one still needs an editor.'
      : `\nDRY RUN: ${String(changed)} asset(s) would change, ${String(unchanged)} already current` +
          (missing > 0 ? `, ${String(missing)} not in the database yet` : '') +
          '.\nRepeat with --apply to write.',
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
