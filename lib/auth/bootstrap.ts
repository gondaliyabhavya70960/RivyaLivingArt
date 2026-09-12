import { ROLES, type Role } from './permissions'

/**
 * The first Studio account, described entirely by environment variables.
 *
 * WHY THIS IS A MODULE AND NOT A HANDFUL OF `process.env` READS IN A SCRIPT. Two reasons, and the
 * second is the one that matters. The first is that the rules — which variables are required, what
 * a missing role defaults to, what an unusable value does — are worth having in one place and worth
 * having under a test. The second is that this is the file which must never print what it read: a
 * bootstrap runs in CI, in a deploy log, on somebody's terminal with scrollback, and the password
 * it is handed is the credential to everything the Studio can reach. Every refusal below names the
 * VARIABLE and never the value, per CLAUDE.md and D8.
 *
 * IT READS NOTHING BY ITSELF. The environment is passed in, which is what makes it testable without
 * mutating the process's own — and a pure function that takes an environment is also a function
 * that cannot accidentally read a different variable than the one it documents.
 *
 * WHY AN ENVIRONMENT-DRIVEN BOOTSTRAP AT ALL, given `auth:create-user` already exists. That script
 * is an interactive act: flags, a prompt, a person reading its output. An environment is what a
 * deployment has — Vercel, a CI job, a container — and "the first owner exists" is a property of a
 * deployment rather than of an afternoon. Both paths end at the same two calls and the same
 * repository writes; this one can be re-run without arguments and without a terminal, and says so
 * when there is nothing to do.
 */

/** The variable names. D8 fixes them; amendment A43 added them. */
export const BOOTSTRAP_VARIABLES = {
  email: 'STUDIO_ADMIN_EMAIL',
  password: 'STUDIO_ADMIN_PASSWORD',
  role: 'STUDIO_ADMIN_ROLE',
  displayName: 'STUDIO_ADMIN_NAME',
} as const

/**
 * `owner`, and not `admin`, despite the variables being named for the job rather than the role.
 *
 * The account this exists to create is the one the Studio cannot create for itself, and that is
 * specifically the first OWNER: `/studio/system/users` can mint an admin the moment any owner can
 * sign in, and `system.owner.transfer` is the one permission no role but `owner` holds (D5). A
 * default of `admin` would leave a deployment whose bootstrap ran successfully still unable to
 * create an owner, which is the failure this whole path exists to prevent.
 */
export const DEFAULT_BOOTSTRAP_ROLE: Role = 'owner'

export type BootstrapConfig = {
  readonly email: string
  readonly password: string
  readonly role: Role
  readonly displayName: string | null
}

/**
 * Absent, unusable, or ready.
 *
 * `ABSENT` IS NOT A FAILURE and is the reason this is a three-way answer rather than a parse that
 * throws. A deployment that never set these variables has not misconfigured anything — it creates
 * its first owner some other way — and a bootstrap step that failed the build for it would teach
 * everybody to remove the step. `INVALID` is the case worth being loud about: somebody meant to
 * configure this and got it wrong, and the half-set shape (an email with no password) is exactly
 * what a silent skip would hide until the day nobody could sign in.
 */
export type BootstrapConfigResult =
  | { readonly state: 'READY'; readonly config: BootstrapConfig }
  | { readonly state: 'ABSENT' }
  | { readonly state: 'INVALID'; readonly problems: readonly string[] }

type Env = Readonly<Record<string, string | undefined>>

/** An unset variable and one set to the empty string are the same thing — `optionalEnv` treats them
 *  alike and a `.env` file full of `NAME=` lines is the ordinary reason for the second. */
function read(env: Env, name: string): string | null {
  const value = env[name]
  return value === undefined || value.trim() === '' ? null : value
}

/**
 * Read the bootstrap configuration out of an environment.
 *
 * NO MESSAGE BELOW CONTAINS A VALUE. Not the password, obviously; not its length, not a prefix, not
 * a "looks too short" hint that is a length by another name. And not the email either — it is
 * personal data, the caller can read their own environment, and a refusal that quotes an address
 * into a CI log is a copy of it in a place nobody thought about.
 */
export function readBootstrapConfig(env: Env): BootstrapConfigResult {
  const email = read(env, BOOTSTRAP_VARIABLES.email)
  const password = read(env, BOOTSTRAP_VARIABLES.password)
  const role = read(env, BOOTSTRAP_VARIABLES.role)
  const displayName = read(env, BOOTSTRAP_VARIABLES.displayName)

  // Nothing at all — including the optional two, because a lone STUDIO_ADMIN_ROLE is somebody
  // halfway through configuring this and should hear about it rather than be skipped.
  if (email === null && password === null && role === null && displayName === null) {
    return { state: 'ABSENT' }
  }

  const problems: string[] = []

  if (email === null) {
    problems.push(`${BOOTSTRAP_VARIABLES.email} is not set`)
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    problems.push(`${BOOTSTRAP_VARIABLES.email} is not an email address`)
  }

  if (password === null) {
    problems.push(`${BOOTSTRAP_VARIABLES.password} is not set`)
  }

  if (role !== null && !(ROLES as readonly string[]).includes(role.trim())) {
    // The ALLOWED set, which is public, rather than what was submitted, which is the caller's.
    problems.push(`${BOOTSTRAP_VARIABLES.role} must be one of ${ROLES.join(' · ')}`)
  }

  if (problems.length > 0) return { state: 'INVALID', problems }

  return {
    state: 'READY',
    config: {
      // Lower-cased, because `staff_profiles.email` is `citext` and GoTrue compares addresses
      // case-insensitively: a bootstrap written as `Owner@…` must not create a second account
      // beside the `owner@…` somebody invited later.
      email: (email as string).trim().toLowerCase(),
      password: password as string,
      role: role === null ? DEFAULT_BOOTSTRAP_ROLE : (role.trim() as Role),
      displayName: displayName === null ? null : displayName.trim(),
    },
  }
}
