#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import {
  BOOTSTRAP_VARIABLES,
  readBootstrapConfig,
  type BootstrapConfig,
} from '../../lib/auth/bootstrap'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import {
  elevateInvitedProfile,
  findStaffProfile,
  listStaffProfiles,
  updateStaffRole,
  updateStaffStatus,
  type StaffProfile,
} from '../../lib/supabase/repositories/staff'

/**
 * `npm run auth:bootstrap` — the first Studio account, from the environment, idempotently.
 *
 * THE SAME JOB AS `auth:create-user`, FOR A DIFFERENT CALLER. That script is a person at a
 * terminal: flags, a prompt, a decision per run. This one is a deployment — a CI step, a container
 * entrypoint, a `vercel env pull && npm run auth:bootstrap` on a laptop — where the configuration
 * already exists as environment variables and nobody is watching. Everything it can do, the other
 * can do; what it adds is that running it twice is safe and running it with nothing configured is a
 * no-op rather than a failure.
 *
 * WHAT "IDEMPOTENT" MEANS HERE, precisely, because the word is usually a promise nobody checks:
 *
 *   no account with that address   → create it, elevate it, activate it
 *   account exists, right state    → report it, write nothing
 *   account exists, wrong role     → move the role, say so
 *   account exists, not ACTIVE     → activate it, say so
 *   account exists, --reset-password → set the password, say so
 *
 * THE PASSWORD IS NEVER CHANGED WITHOUT `--reset-password`, and that is the single most important
 * line in the file. A bootstrap step wired into a deploy runs on every deploy; one that reset the
 * password each time would silently undo every password change anybody had made since, and would
 * do it on the schedule of the deploy rather than of a decision. The flag is how "recreate the
 * environment" and "I have lost the owner password" stay different requests.
 *
 * IT PRINTS NO SECRET, NO PREFIX AND NO LENGTH (CLAUDE.md, D8). It prints the address it acted on,
 * because an operator running a bootstrap needs to know which account it touched and has the value
 * in their own environment already.
 *
 * WHY THE SERVICE ROLE. `auth.users` is GoTrue's, and its admin API is the only correct way to
 * write it — `auth.admin.createUser()` fills in the four columns whose NULLs make an account with a
 * perfectly good password fail sign-in before the password is ever compared. `scripts/**` is on the
 * eslint allowlist for the service-role client for exactly this reason: there is no session here to
 * act on behalf of.
 */

/**
 * The file seventeen other operator scripts read, and this one now reads too.
 *
 * IT WAS MISSING, AND THE FAILURE IT CAUSED LOOKED LIKE SUCCESS. `tsx` loads no dotenv file and
 * `npm run` passes no `--env-file` (Node refuses that flag inside NODE_OPTIONS), so a person who had
 * done exactly what the documentation told them — `vercel env pull && npm run auth:bootstrap` —
 * saw `· STUDIO_ADMIN_EMAIL is not set … Nothing done.` and exit 0, with a correctly filled
 * `.env.local` sitting beside them. A silent, success-shaped no-op is the worst possible answer to
 * "create my administrator account": the operator concludes the account exists.
 *
 * The environment still wins. `loadEnvFile` does not overwrite a variable that is already set, so
 * `STUDIO_ADMIN_PASSWORD=… npm run auth:bootstrap` — the inline form the Studio guide shows — keeps
 * working and keeps taking precedence over anything in the file.
 */
const ENV_PATH = '.env.local'

function loadEnvFile(): void {
  if (!existsSync(ENV_PATH)) return
  try {
    process.loadEnvFile(ENV_PATH)
  } catch (error) {
    // The path and the reason, never a line of the file: it holds a service-role key and a password.
    console.error(
      `Could not read ${ENV_PATH}: ${error instanceof Error ? error.message : 'unknown'}`,
    )
    process.exit(1)
  }
}

type Options = {
  /** Report what would happen and write nothing. */
  readonly dryRun: boolean
  /** Set the password of an account that already exists. */
  readonly resetPassword: boolean
  /** Proceed even though a DIFFERENT account already holds an ACTIVE owner role. */
  readonly force: boolean
  /** Leave a newly created profile INVITED rather than ACTIVE. */
  readonly invited: boolean
}

const USAGE = `Usage:
  npm run auth:bootstrap [-- options]

Reads the account to create from the environment:
  ${BOOTSTRAP_VARIABLES.email}       required — the sign-in address
  ${BOOTSTRAP_VARIABLES.password}    required — never passed as an argument, never printed
  ${BOOTSTRAP_VARIABLES.role}        optional — defaults to owner
  ${BOOTSTRAP_VARIABLES.displayName}        optional — display name

Options:
  --dry-run          report what would happen and write nothing
  --reset-password   set the password of an account that already exists
  --force            proceed even though another ACTIVE owner exists
  --invited          leave a newly created profile INVITED rather than ACTIVE

With none of the variables set the script exits 0 and does nothing: a deployment that creates its
first owner some other way has not misconfigured anything.`

function fail(message: string): never {
  console.error(`✗ ${message}\n\n${USAGE}`)
  process.exit(1)
}

function parseArgs(argv: readonly string[]): Options {
  /*
   * Refused rather than ignored, exactly as `create-staff-user.ts` refuses it. A password in argv
   * is in the shell history, in the process table for every other user on the machine, and in any
   * shell trace — and silently dropping the flag would leave the caller believing they had set one.
   */
  if (argv.some((arg) => arg.startsWith('--password'))) {
    fail(
      `--password is not accepted. Put the password in ${BOOTSTRAP_VARIABLES.password}, which is ` +
        `where this script reads it from.`,
    )
  }

  const known = new Set(['--dry-run', '--reset-password', '--force', '--invited'])
  const unknown = argv.filter((arg) => !known.has(arg))
  if (unknown.length > 0) fail(`unrecognised argument: ${unknown.join(' ')}`)

  return {
    dryRun: argv.includes('--dry-run'),
    resetPassword: argv.includes('--reset-password'),
    force: argv.includes('--force'),
    invited: argv.includes('--invited'),
  }
}

/** The profile whose address matches, or null. `staff_profiles.email` is `citext`, and the config
 *  is lower-cased on the way out of `readBootstrapConfig`, so this comparison agrees with the
 *  database's own. */
function profileFor(profiles: readonly StaffProfile[], email: string): StaffProfile | null {
  return profiles.find((profile) => (profile.email ?? '').toLowerCase() === email) ?? null
}

type Admin = ReturnType<typeof createClient<Database>>

/**
 * Create the account, then move the profile the trigger already made.
 *
 * ROLE FIRST, THEN STATUS, as `create-staff-user.ts` does it and for the same reason: if the second
 * write fails, what is left behind is an account with the right role that cannot sign in — the safe
 * half of the failure. The reverse order leaves an ACTIVE viewer, which is an account that works
 * and does nothing.
 */
async function createAccount(
  admin: Admin,
  config: BootstrapConfig,
  options: Options,
): Promise<void> {
  /*
   * `email_confirm: true` because a bootstrap has no inbox round trip: without it
   * `email_confirmed_at` stays null and sign-in refuses an account that otherwise looks complete.
   */
  const { data, error } = await admin.auth.admin.createUser({
    email: config.email,
    password: config.password,
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
   * `created_by` and `updated_by` are the new account's own id. There is no acting session in a
   * bootstrap, and naming the account itself is honest about that; borrowing another user's id
   * would not be.
   */
  await elevateInvitedProfile(admin, created.id, {
    role: config.role,
    displayName: config.displayName,
    invitedBy: created.id,
  })
  if (!options.invited) await updateStaffStatus(admin, created.id, 'ACTIVE', created.id)

  // Read back through the repository rather than trusting the writes: this is the assertion that
  // the `on_auth_user_created` trigger ran and the profile is in the state that was asked for.
  const profile = await findStaffProfile(admin, created.id)
  if (!profile) {
    fail(
      `the account was created but no staff_profiles row exists for it. The ` +
        `on_auth_user_created trigger did not run — check migration 0009 is applied.`,
    )
  }

  console.log(`✓ created ${config.email} as ${profile.role} · ${profile.status}`)
  console.log(
    profile.status === 'ACTIVE'
      ? '  Sign in at /studio/login, then manage everyone else from /studio/system/users.'
      : '  The profile is INVITED: activate it from /studio/system/users before it can sign in.',
  )
}

/**
 * Bring an account that already exists into the state the environment describes.
 *
 * EVERY BRANCH IS REPORTED, INCLUDING THE ONE THAT DOES NOTHING. "Already correct" is the answer a
 * re-run should give, and a script that prints nothing on the happy path is one whose operator
 * cannot tell it from a script that did not run.
 */
async function reconcileAccount(
  admin: Admin,
  existing: StaffProfile,
  config: BootstrapConfig,
  options: Options,
): Promise<void> {
  let changed = false

  if (options.resetPassword) {
    const { error } = await admin.auth.admin.updateUserById(existing.user_id, {
      password: config.password,
    })
    if (error) {
      fail(
        `the auth service refused the password change ` +
          `(status ${String(error.status ?? 'none')}, code ${error.code ?? 'none'})`,
      )
    }
    console.log(`✓ password set for ${config.email}`)
    changed = true
  }

  if (existing.role !== config.role) {
    await updateStaffRole(admin, existing.user_id, config.role, existing.user_id)
    console.log(`✓ role moved from ${existing.role} to ${config.role}`)
    changed = true
  }

  if (existing.status !== 'ACTIVE' && !options.invited) {
    await updateStaffStatus(admin, existing.user_id, 'ACTIVE', existing.user_id)
    console.log(`✓ status moved from ${existing.status} to ACTIVE`)
    changed = true
  }

  if (!changed) {
    console.log(`✓ ${config.email} already exists as ${existing.role} · ${existing.status}`)
    console.log(
      `  Nothing to do. Re-run with --reset-password to set a new password for this account.`,
    )
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  // BEFORE reading the configuration, and the ordering is the whole point: the variables this
  // script decides everything from may live in the file rather than in the shell.
  loadEnvFile()

  const result = readBootstrapConfig(process.env)

  if (result.state === 'ABSENT') {
    console.log(
      `· ${BOOTSTRAP_VARIABLES.email} is not set, so there is no account to bootstrap. Nothing done.`,
    )
    return
  }

  if (result.state === 'INVALID') {
    fail(`the bootstrap environment is incomplete:\n  - ${result.problems.join('\n  - ')}`)
  }

  const config = result.config

  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const profiles = await listStaffProfiles(admin)
  const existing = profileFor(profiles, config.email)

  /*
   * A SECOND OWNER IS ALMOST ALWAYS A MISTAKE — a bootstrap re-run against a project that already
   * has one, usually because the first run seemed not to work. `enforce_last_owner` (migration
   * 0009) protects against too FEW owners; nothing in the database objects to too many, so the
   * check belongs here. It is scoped to a DIFFERENT address: an idempotent re-run for the SAME
   * owner is the normal case and must not be refused.
   */
  if (config.role === 'owner' && !options.force) {
    const others = profiles.filter(
      (profile) =>
        profile.role === 'owner' &&
        profile.status === 'ACTIVE' &&
        (profile.email ?? '').toLowerCase() !== config.email,
    )
    if (others.length > 0) {
      fail(
        `an ACTIVE owner already exists (${others.map((o) => o.email ?? o.user_id).join(', ')}).\n` +
          `  Invite further staff from /studio/system/users, where the act is permission-checked\n` +
          `  and audited. Re-run with --force only if a second owner is genuinely intended.`,
      )
    }
  }

  if (options.dryRun) {
    if (existing === null) {
      const status = options.invited ? 'INVITED' : 'ACTIVE'
      console.log(`· would create ${config.email} as ${config.role} · ${status}`)
      return
    }

    const steps = [
      options.resetPassword ? 'set the password' : null,
      existing.role === config.role ? null : `move the role to ${config.role}`,
      existing.status === 'ACTIVE' || options.invited ? null : 'activate it',
    ].filter((step): step is string => step !== null)

    console.log(
      `· ${config.email} exists as ${existing.role} · ${existing.status}; would ` +
        (steps.length === 0 ? 'change nothing' : steps.join(', ')),
    )
    return
  }

  if (existing === null) {
    await createAccount(admin, config, options)
    return
  }

  await reconcileAccount(admin, existing, config, options)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
