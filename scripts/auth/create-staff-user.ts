#!/usr/bin/env tsx
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { ROLES, type Role } from '../../lib/auth/permissions'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import {
  findStaffProfile,
  listStaffProfiles,
  updateStaffRole,
  updateStaffStatus,
} from '../../lib/supabase/repositories/staff'

/**
 * `npm run auth:create-user -- --email=… --role=owner` — bootstrap a Studio account.
 *
 * THE ONE ACCOUNT THE STUDIO CANNOT CREATE ITSELF. `/studio/system/users` invites every other
 * member, but it requires a signed-in owner or admin to do it, so the FIRST owner has nowhere to
 * come from. That gap is what this script fills, and nothing else: once one owner can sign in,
 * every subsequent account belongs in the Studio, where the act is permission-checked and audited.
 *
 * WHY IT EXISTS RATHER THAN A SQL SNIPPET, and this is the whole point of the file. On 2026-09-12
 * the first owner was created by hand-writing `auth.users` — bcrypt via `extensions.crypt`, every
 * column filled in by eye. The password hash was correct and verified. Sign-in still failed with
 * "Those sign-in details were not accepted" for hours, because four columns were left NULL:
 *
 *     confirmation_token · recovery_token · email_change · email_change_token_new
 *
 * GoTrue scans those into non-nullable Go strings. A NULL fails the scan and the auth service
 * errors BEFORE it ever compares a password, so the login form reports bad credentials about an
 * account whose credentials are fine. `auth.admin.createUser()` sets all of them. Every column
 * GoTrue expects is GoTrue's to decide, and the only safe way to write that table is to ask it.
 *
 * THE PASSWORD NEVER COMES FROM argv. A password in `--password=` is in the shell history, in the
 * process table for every other user on the box, and in any shell trace. It is read from
 * STAFF_PASSWORD, or prompted for on stdin. It is never printed, and neither is its length.
 */

type Options = {
  readonly email: string
  readonly role: Role
  readonly displayName: string | null
  /** Leave the profile INVITED instead of activating it. */
  readonly invited: boolean
  /** Create a second owner even though an ACTIVE one already exists. */
  readonly force: boolean
}

const USAGE = `Usage:
  STAFF_PASSWORD=… npm run auth:create-user -- --email=<address> --role=<role> [options]

  --email=<address>        required
  --role=<role>            required — ${ROLES.join(' · ')}
  --display-name=<name>    optional
  --invited                leave the profile INVITED rather than ACTIVE
  --force                  create an owner even though an ACTIVE owner exists

The password is read from STAFF_PASSWORD, or prompted for if that is unset.
It is never accepted as a command-line argument.`

function fail(message: string): never {
  console.error(`✗ ${message}\n\n${USAGE}`)
  process.exit(1)
}

function parseArgs(argv: readonly string[]): Options {
  const value = (name: string): string | null => {
    const hit = argv.find((arg) => arg.startsWith(`--${name}=`))
    return hit === undefined ? null : hit.slice(name.length + 3)
  }

  /*
   * Refused rather than ignored. Silently dropping `--password=` would leave the caller believing
   * they had set one while the script prompted — and the secret would still be in their history.
   */
  if (argv.some((arg) => arg.startsWith('--password'))) {
    fail('--password is not accepted. Use the STAFF_PASSWORD environment variable or the prompt.')
  }

  const email = value('email')?.trim().toLowerCase() ?? null
  if (email === null || email === '') fail('--email is required')
  if (!email.includes('@')) fail(`--email does not look like an address: ${email}`)

  const role = value('role')?.trim() ?? null
  if (role === null) fail('--role is required')
  if (!(ROLES as readonly string[]).includes(role)) {
    fail(`--role must be one of ${ROLES.join(', ')} — got "${role}"`)
  }

  const displayName = value('display-name')?.trim() ?? null

  return {
    email,
    role: role as Role,
    displayName: displayName === '' ? null : displayName,
    invited: argv.includes('--invited'),
    force: argv.includes('--force'),
  }
}

/** From the environment, or prompted. Never echoed, never measured, never logged. */
async function readPassword(): Promise<string> {
  const fromEnv = process.env['STAFF_PASSWORD']
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv

  if (!process.stdin.isTTY) {
    fail('STAFF_PASSWORD is not set and stdin is not a terminal, so there is nothing to prompt.')
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr })
  try {
    return await new Promise<string>((resolve) => {
      rl.question('Password for the new account: ', resolve)
    })
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  /*
   * A SECOND OWNER IS ALMOST ALWAYS A MISTAKE — a bootstrap run repeated because the first one
   * seemed not to work. `enforce_last_owner` protects against having too FEW owners; nothing in the
   * database objects to too many, so the check belongs here.
   */
  if (options.role === 'owner' && !options.force) {
    const existing = await listStaffProfiles(admin)
    const owners = existing.filter((p) => p.role === 'owner' && p.status === 'ACTIVE')
    if (owners.length > 0) {
      fail(
        `an ACTIVE owner already exists (${owners.map((o) => o.email ?? o.user_id).join(', ')}).\n` +
          '  Invite further staff from /studio/system/users, where the act is permission-checked\n' +
          '  and audited. Repeat with --force only if you genuinely intend a second owner.',
      )
    }
  }

  const password = await readPassword()

  /*
   * `email_confirm: true` because there is no inbox round-trip in a bootstrap: without it
   * `email_confirmed_at` stays null and sign-in refuses an account that otherwise looks complete.
   */
  const { data, error } = await admin.auth.admin.createUser({
    email: options.email,
    password,
    email_confirm: true,
  })

  if (error) {
    // The status and the code, never the message: a GoTrue message can quote what it was given.
    fail(
      `the auth service refused to create the account ` +
        `(status ${String(error.status ?? 'none')}, code ${error.code ?? 'none'})`,
    )
  }

  const created = data.user
  if (!created) fail('the auth service reported success but returned no account')

  /*
   * `on_auth_user_created` (migration 0009) has already created the profile as INVITED/viewer, so
   * both calls below are updates. Role first, then status: if the second fails, what is left behind
   * is an account with the right role that cannot sign in — the safe half of the failure.
   *
   * `updatedBy` is the new account's own id. There is no acting session in a bootstrap, and naming
   * the account itself is honest about that; inventing another user's id would not be.
   */
  await updateStaffRole(admin, created.id, options.role, created.id)
  if (!options.invited) {
    await updateStaffStatus(admin, created.id, 'ACTIVE', created.id)
  }

  // Read back through the repository rather than trusting the writes: this is the assertion that
  // the trigger ran and the profile is really in the state the operator asked for.
  const profile = await findStaffProfile(admin, created.id)
  if (!profile) {
    fail(
      `the account was created but no staff_profiles row exists for it. ` +
        `The on_auth_user_created trigger did not run — check migration 0009 is applied.`,
    )
  }

  console.log(
    `✓ ${profile.email ?? options.email} created as ${profile.role} · ${profile.status}\n` +
      (profile.status === 'ACTIVE'
        ? '  Sign in at /studio/login, then manage everyone else from /studio/system/users.'
        : '  The profile is INVITED: activate it from /studio/system/users before it can sign in.'),
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
