#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import {
  RETENTION_MONTHS,
  anonymiseExpired,
  eraseEnquirer,
  exportEnquirerData,
} from '../../lib/inquiries/pii'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'

/**
 * `npm run ops:anonymise-inquiries -- [--apply] [--months=24] [--email=…] [--phone=…] [--export]`
 * — Phase 41.
 *
 * Three jobs behind one command, because they are three shapes of the same act:
 *
 *   (no identifier)            the scheduled retention pass: everything untouched for 24 months.
 *   --email / --phone          one enquirer, on request.
 *   --email / --phone --export print what is held rather than erase it (a subject access request).
 *
 * IT REFUSES TO WRITE WITHOUT `--apply`, AND THAT IS THE MOST IMPORTANT LINE IN THE FILE. An erasure
 * cannot be undone; matching is by contact detail rather than by a stable id; and a mistyped phone
 * number could match a different person entirely. So the default is a dry run that prints exactly
 * which reference codes would be touched, and the operator repeats the command with `--apply` once
 * they have read the list. `--apply` on its own, with no identifier, runs the retention pass — which
 * is the one case where the set is defined by a date rather than by somebody's typing.
 *
 * IT PRINTS REFERENCE CODES AND NEVER CONTACT DETAILS. A reference code identifies the enquiry to the
 * studio without naming the enquirer, and a terminal is a place text gets pasted into tickets and
 * chat. The one exception is `--export`, whose entire purpose is to produce the person's own data for
 * them — and it writes JSON to stdout, so it is redirected to a file rather than read in a scrollback.
 *
 * THE SERVICE ROLE, NECESSARILY. There is no session here: it runs from a terminal or a scheduled
 * job, and the rows belong to nobody who could authorise the write.
 */

const ENV_PATH = '.env.local'

export interface AnonymiseOptions {
  readonly apply: boolean
  readonly months: number
  readonly email: string | undefined
  readonly phone: string | undefined
  readonly exportOnly: boolean
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: AnonymiseOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let apply = false
  let months = RETENTION_MONTHS
  let email: string | undefined
  let phone: string | undefined
  let exportOnly = false

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true
      continue
    }
    if (arg === '--export') {
      exportOnly = true
      continue
    }
    if (arg.startsWith('--months=')) {
      const raw = arg.slice('--months='.length)
      const parsed = Number.parseInt(raw, 10)
      /*
       * A FLOOR OF ONE MONTH, not zero. `--months=0` would match every row in the table, which is
       * the accident this floor exists to refuse — and the retention policy is a MINIMUM of 24
       * months, so a shorter window is only ever a test or a mistake.
       */
      if (!Number.isInteger(parsed) || parsed < 1) {
        return {
          ok: false,
          error: `--months must be a whole number of months, at least 1, not ${raw}`,
        }
      }
      months = parsed
      continue
    }
    if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length)
      continue
    }
    if (arg.startsWith('--phone=')) {
      phone = arg.slice('--phone='.length)
      continue
    }
    return { ok: false, error: `Unrecognised argument: ${arg}` }
  }

  if (exportOnly && email === undefined && phone === undefined) {
    return { ok: false, error: '--export needs --email or --phone: there is no bulk export' }
  }

  return { ok: true, value: { apply, months, email, phone, exportOnly } }
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

  const identifier = {
    ...(options.email !== undefined && { email: options.email }),
    ...(options.phone !== undefined && { phone: options.phone }),
  }
  const named = options.email !== undefined || options.phone !== undefined

  if (options.exportOnly) {
    const data = await exportEnquirerData(admin, identifier)
    // JSON to stdout, so it is redirected to a file and handed over rather than read here.
    console.log(JSON.stringify(data, null, 2))
    return
  }

  const outcome = named
    ? await eraseEnquirer(admin, identifier, { dryRun: !options.apply })
    : await anonymiseExpired(admin, {
        now: new Date(),
        months: options.months,
        dryRun: !options.apply,
      })

  const what = named ? 'enquirer' : `enquiries untouched for ${String(options.months)} month(s)`

  if (outcome.matched === 0) {
    console.log(`Nothing to do: no ${what} matched.`)
    return
  }

  for (const reference of outcome.references) console.log(`  ${reference}`)

  console.log(
    options.apply
      ? `\n${String(outcome.erased)} of ${String(outcome.matched)} row(s) anonymised. Contact fields cleared; every row, status and timestamp kept.`
      : `\nDRY RUN: ${String(outcome.matched)} row(s) would be anonymised and nothing was written.\n` +
          'Read the reference codes above, then repeat with --apply.',
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
