#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import {
  elevateInvitedProfile,
  listStaffProfiles,
  updateStaffRole,
  updateStaffStatus,
  type StaffProfile,
} from '../../lib/supabase/repositories/staff'
import { decideAdminSync } from './admin-sync'
import type { BootstrapConfig } from '../../lib/auth/bootstrap'

/**
 * `npm run auth:sync-admin` — the Vercel environment IS the Studio owner's login (amendment A44).
 *
 * It runs inside `next build`, so the FIRST property is the one everything else is arranged around:
 * **IT NEVER FAILS A DEPLOYMENT.** Every path exits 0. A missing variable, an unreachable auth
 * service, a refusal, an error nobody anticipated — each is reported on stdout for the build log and
 * then swallowed. The alternative is a site that goes down because an account setting was wrong,
 * which is a far worse outcome than an owner whose password did not change.
 *
 * WHAT IT DOES, AND HOW IT DIFFERS FROM `auth:bootstrap`. Bootstrap is careful: it never touches an
 * existing password without `--reset-password`, because a step that reset the password on every
 * deploy would silently undo every password change made since. THIS script does exactly that, on
 * purpose, because that is what "the dashboard is the source of truth" means. The two scripts
 * therefore stay separate rather than becoming one with a flag: their defaults are opposites, and
 * the safe one must stay safe.
 *
 * WHAT IT WILL NOT DO. It will not mint a SECOND owner. If an ACTIVE owner exists at a different
 * address, it declines and says so — changing `STUDIO_ADMIN_EMAIL` to a new address is a decision
 * with consequences for `enforce_last_owner` and for who can sign in, and a build step is the wrong
 * place to take it. Use `/studio/system/users`, where the act is permission-checked and audited.
 *
 * IT PRINTS NO SECRET, NO PREFIX AND NO LENGTH (CLAUDE.md, D8). A Vercel build log is retained, is
 * readable by everyone with project access, and is pasted into issues.
 */

const ENV_PATH = '.env.local'

/** Every exit is 0; this only marks the lines an operator should read in a build log. */
function note(message: string): void {
  console.log(`· auth:sync-admin — ${message}`)
}

function done(message: string): void {
  console.log(`✓ auth:sync-admin — ${message}`)
}

type Admin = ReturnType<typeof createClient<Database>>

function profileFor(profiles: readonly StaffProfile[], email: string): StaffProfile | null {
  return profiles.find((profile) => (profile.email ?? '').toLowerCase() === email) ?? null
}

/**
 * Apply the environment to an account that already exists.
 *
 * THE PASSWORD IS SET EVERY TIME, unconditionally and without comparing it to anything: GoTrue
 * stores a bcrypt hash, so there is nothing to compare against without the plaintext, and a
 * conditional write would need this script to reason about a value it must never handle twice.
 * Setting it on every production deploy is also precisely the contract the owner asked for.
 */
async function applyToExisting(
  admin: Admin,
  existing: StaffProfile,
  config: BootstrapConfig,
): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(existing.user_id, {
    password: config.password,
  })
  if (error) {
    // The status and the code, never the message: a GoTrue message can quote what it was given.
    note(
      `the auth service refused the password change (status ${String(error.status ?? 'none')}, ` +
        `code ${error.code ?? 'none'}); the deployment continues`,
    )
    return
  }
  done(`password applied to ${config.email}`)

  if (existing.role !== config.role) {
    await updateStaffRole(admin, existing.user_id, config.role, existing.user_id)
    done(`role moved from ${existing.role} to ${config.role}`)
  }
  if (existing.status !== 'ACTIVE') {
    await updateStaffStatus(admin, existing.user_id, 'ACTIVE', existing.user_id)
    done(`status moved from ${existing.status} to ACTIVE`)
  }
}

/** Create the account the environment describes, when no profile carries that address. */
async function createFromEnvironment(admin: Admin, config: BootstrapConfig): Promise<void> {
  const { data, error } = await admin.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true,
  })
  if (error || !data.user) {
    note(
      `the auth service refused to create the account (status ${String(error?.status ?? 'none')}, ` +
        `code ${error?.code ?? 'none'}); the deployment continues`,
    )
    return
  }

  // Role first, then status: if the second write fails, what is left is an account with the right
  // role that cannot sign in — the safe half of the failure.
  await elevateInvitedProfile(admin, data.user.id, {
    role: config.role,
    displayName: config.displayName,
    invitedBy: data.user.id,
  })
  await updateStaffStatus(admin, data.user.id, 'ACTIVE', data.user.id)
  done(`created ${config.email} as ${config.role} · ACTIVE`)
}

async function main(): Promise<void> {
  // For a local run. On Vercel there is no `.env.local` and the variables are already in the
  // environment; this only makes `npm run auth:sync-admin` behave the same way on a laptop.
  if (existsSync(ENV_PATH)) {
    try {
      process.loadEnvFile(ENV_PATH)
    } catch {
      note(`could not read ${ENV_PATH}; continuing with the process environment alone`)
    }
  }

  const decision = decideAdminSync(process.env)
  if (!decision.run) {
    note(`nothing to do: ${decision.reason}`)
    return
  }

  const config = decision.config
  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const profiles = await listStaffProfiles(admin)

  /*
   * A SECOND ACTIVE OWNER IS NEVER MINTED BY A BUILD. `enforce_last_owner` guards against too FEW
   * owners; nothing in the database objects to too many, so the check belongs here — and a build
   * step is the wrong place to decide that the business has a new owner.
   */
  if (config.role === 'owner') {
    const others = profiles.filter(
      (profile) =>
        profile.role === 'owner' &&
        profile.status === 'ACTIVE' &&
        (profile.email ?? '').toLowerCase() !== config.email,
    )
    if (others.length > 0) {
      note(
        `an ACTIVE owner already exists at another address, so ${config.email} was NOT created. ` +
          `Invite further staff from /studio/system/users, where the act is permission-checked and audited`,
      )
      return
    }
  }

  const existing = profileFor(profiles, config.email)
  if (existing === null) {
    await createFromEnvironment(admin, config)
    return
  }
  await applyToExisting(admin, existing, config)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => {
      process.exit(0)
    })
    .catch((error: unknown) => {
      /*
       * THE WHOLE POINT OF THE FILE, IN FOUR LINES. Anything that reached here — a network failure,
       * a repository validation error, a Supabase outage — is reported and then forgiven, because
       * this runs inside a build and a deployment must not fall over an account setting.
       */
      note(
        `failed, and the deployment continues: ` +
          `${error instanceof Error ? error.name : 'unknown error'}`,
      )
      process.exit(0)
    })
}
