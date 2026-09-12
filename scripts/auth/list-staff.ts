#!/usr/bin/env tsx
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

function formatRow(profile: StaffProfile): string {
  const lastSeen =
    profile.last_seen_at === null ? 'never signed in' : `last seen ${profile.last_seen_at}`
  const name = profile.display_name === null ? '' : ` (${profile.display_name})`
  return `  ${(profile.email ?? '— no address —').padEnd(36)} ${profile.role.padEnd(14)} ${profile.status.padEnd(10)} ${lastSeen}${name}`
}

async function main(): Promise<void> {
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
    '\nOnly an ACTIVE profile can sign in. A forgotten password is reset at /studio/forgot-password.',
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
