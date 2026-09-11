#!/usr/bin/env tsx
/**
 * sheets:sync — run one export definition from the command line, or every scheduled one that is
 * due.
 *
 *   npm run sheets:sync -- --definition=research-products
 *   npm run sheets:sync -- --definition=research-products --dry-run   # builds rows, counts, writes nothing
 *   npm run sheets:sync -- --due                                       # what the hourly cron would run
 *
 * THE FLAG IS CHECKED FIRST, from the feature_flags table: with google_sheets off the command
 * refuses with FLAG_OFF and makes no network call. A dry run records a SKIPPED run row with the
 * row and cell counts, which is the paper trail the phase document asks for. Credentials come
 * from GOOGLE_SERVICE_ACCOUNT_JSON in the environment and are never printed.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import { listFeatureFlags } from '../../lib/supabase/repositories/flags'
import {
  getDefinitionBySlug,
  listScheduledDefinitions,
} from '../../lib/supabase/repositories/sheets'
import { runDefinition } from '../../lib/sheets/run'
import { isDue } from '../../lib/sheets/schedule'
import { SheetsError } from '../../lib/sheets/errors'

const ENV_PATH = '.env.local'

export interface SyncCliOptions {
  readonly definition?: string
  readonly dryRun: boolean
  readonly due: boolean
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: SyncCliOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let definition: string | undefined
  let dryRun = false
  let due = false
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg === '--due') {
      due = true
      continue
    }
    if (arg.startsWith('--definition=')) {
      definition = arg.slice('--definition='.length)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(definition))
        return { ok: false, error: `--definition must be a slug, not ${definition}` }
      continue
    }
    return { ok: false, error: `unknown argument ${arg}` }
  }
  if (definition === undefined && !due) {
    return { ok: false, error: 'give --definition=<slug> or --due' }
  }
  if (definition !== undefined && due) {
    return { ok: false, error: '--definition and --due are exclusive' }
  }
  return { ok: true, value: { ...(definition === undefined ? {} : { definition }), dryRun, due } }
}

async function main(): Promise<void> {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH)
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(2)
  }
  const options = parsed.value

  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const flags = await listFeatureFlags(admin)
  const flagEnabled = flags.some((row) => row.key === 'google_sheets' && row.is_enabled)
  if (!flagEnabled) {
    console.error('google_sheets is off. Nothing was written and no network call was made.')
    process.exit(3)
  }

  const now = new Date()
  const targets = options.due
    ? (await listScheduledDefinitions(admin)).filter((definition) =>
        isDue(
          definition.schedule,
          now,
          definition.last_run_at === null ? null : new Date(definition.last_run_at),
        ),
      )
    : [await getDefinitionBySlug(admin, options.definition ?? '')].filter(
        (definition) => definition !== null,
      )

  if (targets.length === 0) {
    console.log(
      options.due ? 'nothing is due' : `no definition with slug ${options.definition ?? ''}`,
    )
    return
  }

  let failed = 0
  for (const definition of targets) {
    try {
      const result = await runDefinition(admin, {
        definitionId: definition.id,
        trigger: 'CLI',
        actor: { userId: null, role: null },
        flagEnabled: true,
        dryRun: options.dryRun,
      })
      console.log(
        `${result.slug.padEnd(24)} ${result.status.padEnd(10)} rows=${String(result.rowCount)} cells=${String(result.cellCount)} attempts=${String(result.attempts)} ${result.errorCode ?? ''}${result.paused ? ' PAUSED' : ''}`,
      )
      if (result.status === 'FAILED') failed += 1
    } catch (error) {
      failed += 1
      console.error(
        `${definition.slug}: ${error instanceof SheetsError ? `${error.code} — ${error.message}` : 'failed'}`,
      )
    }
  }
  process.exit(failed > 0 ? 1 : 0)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof SheetsError ? error.message : 'sheets:sync failed')
    process.exit(1)
  })
}
