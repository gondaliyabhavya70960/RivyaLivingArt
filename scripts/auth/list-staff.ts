#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import { listStaffProfiles, type StaffProfile } from '../../lib/supabase/repositories/staff'

/**
 * `npm run auth:list-users` — which addresses can sign in, and as what.
 *
 * THE OTHER HALF OF "I CANNOT GET IN". A forgotten password has a self-service answer:
 * `/studio/forgot-password` emails a link. A forgotten *address* cannot have one, and the reason is
 * worth stating because the absence looks like an oversight. The sign-in ID is the email address —
 * `staff_profiles` holds no username — so a self-service "which address is my account?" form would
 * have to accept some other identifier and reply with an address, which is an account-enumeration
 * oracle on a public page. There is no shape of that feature which is safe to expose.
 *
 * So it is answered here instead, behind the service-role key: by an owner or admin at
 * `/studio/system/users`, or by whoever holds the deployment's environment, running this. Both
 * require an existing credential, which is exactly the property the public form could not have.
 *
 * IT PRINTS ADDRESSES, DELIBERATELY, AND THAT IS THE WHOLE POINT — the caller already holds the key
 * that can read every row in the database. It prints no password material of any kind, because
 * there is none to print: GoTrue stores a bcrypt hash and this script never reads `auth.users`.
 */

/** Same file, same rule, as `scripts/auth/bootstrap-admin.ts` and seventeen others: read
 *  `.env.local` if it is there, and let anything already in the shell win. */
const ENV_PATH = '.env.local'

function loadEnvFile(): void {
  if (!existsSync(ENV_PATH)) return
  try {
    process.loadEnvFile(ENV_PATH)
  } catch (error) {
    console.error(
      `Could not read ${ENV_PATH}: ${error instanceof Error ? error.message : 'unknown'}`,
    )
    process.exit(1)
  }
}

/**
 * THIS NO LONGER PRINTS `last_seen_at`, AND THE REASON IS THAT NOTHING WRITES IT.
 *
 * The column exists (migration 0009) and is read in two places — here, and the Studio's user list —
 * and is written by no code path and no trigger anywhere in the repository or the database. So the
 * first version of this script printed "never signed in" beside every account, forever, including
 * accounts signing in daily. That is worse than printing nothing: the operator asking "has anyone
 * ever got into this Studio?" would have been told "no" by a column that can only ever say no.
 *
 * The honest answer to that question is an `audit_logs` row — `app/(studio)/studio/login/page.tsx`
 * writes `auth.signin` / SUCCESS once a staff session resolves — so the footer points there instead
 * of inventing a second unreliable signal. Populating the column is a separate change with its own
 * write path and its own audit consequences; leaving it unread is this script's business.
 */
function formatRow(profile: StaffProfile): string {
  const name = profile.display_name === null ? '' : ` (${profile.display_name})`
  return `  ${(profile.email ?? '— no address —').padEnd(36)} ${profile.role.padEnd(14)} ${profile.status.padEnd(10)}${name}`
}

async function main(): Promise<void> {
  loadEnvFile()

  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const profiles = await listStaffProfiles(admin)

  if (profiles.length === 0) {
    console.log('No staff profiles exist. Create the first owner with `npm run auth:bootstrap`.')
    return
  }

  console.log(`${profiles.length} staff profile${profiles.length === 1 ? '' : 's'}:\n`)
  // ACTIVE first, then by role, then by address: the person running this is usually looking for an
  // account that can sign in today, and a suspended row at the top is a wrong answer that reads
  // like a right one.
  const ordered = [...profiles].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1
    if (a.role !== b.role) return a.role.localeCompare(b.role)
    return (a.email ?? '').localeCompare(b.email ?? '')
  })
  for (const profile of ordered) console.log(formatRow(profile))
  console.log(
    '\nOnly an ACTIVE profile can sign in. A forgotten password is reset at /studio/forgot-password.\n' +
      'Whether anyone HAS signed in is not shown here and cannot be: `staff_profiles.last_seen_at`\n' +
      'is never written by anything. The record of a successful sign-in is an `audit_logs` row with\n' +
      "action 'auth.signin'.",
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
