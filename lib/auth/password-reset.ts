import 'server-only'

import { optionalEnv } from '../env'
import { logSystem } from '../logging/system-log'
import { createClient } from '../supabase/server'

/**
 * Losing a password, and getting back in — the two halves of it, in one module.
 *
 * WHY IT IS NOT INSIDE THE PAGES THAT USE IT. Three surfaces take part in one flow: the form that
 * asks for the email (`/studio/forgot-password`), the link the email carries
 * (`/api/auth/confirm`), and the form that sets the new password (`/studio/reset-password`). Each
 * of them has to agree about where the link returns to and what an auth-service refusal means, and
 * three copies of that agreement is three places for it to drift — the failure being a recovery
 * link that lands somewhere the application does not serve, which nobody notices until somebody is
 * locked out and in a hurry.
 *
 * NO SERVICE ROLE ANYWHERE IN HERE, deliberately. Both operations are things the auth server will
 * do for an anonymous or a recovery-session caller with the publishable key: requesting a recovery
 * email needs no privilege at all, and setting the password needs exactly the session the link just
 * established. Reaching for `lib/supabase/admin.ts` would turn "let this person set their own
 * password" into "let this code set anybody's", which is a different and much larger capability
 * than the feature needs.
 *
 * IT NEVER SAYS WHETHER AN ACCOUNT EXISTS. `requestPasswordReset` returns the same value for an
 * address with an account, an address without one, and an address the auth service refused. A form
 * that answers differently is an account-enumeration oracle a stranger can query from the open
 * internet, and staff addresses are the first half of a credential-stuffing list.
 */

/** Where a recovery link comes back to. A route handler, because the link is a GET carrying a token
 *  that has to be exchanged for a session before any page can render anything useful. */
export const RECOVERY_CONFIRM_PATH = '/api/auth/confirm'

/** Where that route sends somebody once the token has been accepted. */
export const RESET_PASSWORD_PATH = '/studio/reset-password'

/** Where somebody asks for a link in the first place. */
export const FORGOT_PASSWORD_PATH = '/studio/forgot-password'

/**
 * The absolute URL the recovery email should return to, or `null`.
 *
 * BUILT FROM `NEXT_PUBLIC_SITE_URL` AND FROM NOTHING ELSE — not from the `Host` header of the
 * request that asked. A host header is a value the caller chose: deriving the return address from
 * it means a request carrying `Host: attacker.example` produces an email, sent by us, whose link
 * hands the recovery token to that host. Supabase's own redirect allowlist is a second wall in
 * front of that, but a wall configured in a dashboard is not a reason to aim at it.
 *
 * A MISSING VARIABLE IS NOT AN ERROR HERE. Omitting `redirectTo` makes GoTrue fall back to the
 * project's own Site URL, which on a configured deployment is the same address. `requiredEnv` would
 * instead take the whole reset flow down on a deployment where the fallback is correct.
 */
export function recoveryReturnUrl(): string | null {
  const site = optionalEnv('NEXT_PUBLIC_SITE_URL')
  if (site === null) return null
  try {
    return new URL(RECOVERY_CONFIRM_PATH, site).toString()
  } catch {
    // A malformed NEXT_PUBLIC_SITE_URL is a deployment fault, but not one worth refusing a
    // password reset over: the fallback above is still a working link.
    return null
  }
}

/**
 * Ask the auth service to email a recovery link.
 *
 * ALWAYS RESOLVES, AND ALWAYS THE SAME WAY. The caller renders one notice — "if that address has an
 * account, a link is on its way" — whatever happened here, so there is nothing for this function to
 * return. A refusal is recorded on the SECURITY channel instead, where the owner can see that the
 * auth service is rejecting requests without the form telling a stranger anything.
 *
 * THE ADDRESS IS NEVER LOGGED. Not in the success path, not in the failure path, not in a `context`
 * field. An email address is personal data and a system log is read by more people, for longer,
 * than the mailbox it names.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = await createClient()
  const returnUrl = recoveryReturnUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    ...(returnUrl === null ? {} : { redirectTo: returnUrl }),
  })

  if (error) {
    /*
     * The status and the code, never the message: a GoTrue message can quote the address it was
     * given, and this string is on its way to a table somebody reads in the Studio.
     */
    await logSystem({
      level: 'SECURITY',
      channel: 'AUTH',
      event: 'auth.password_reset.refused',
      message: 'The auth service refused a password-reset request',
      context: {
        status: error.status ?? null,
        code: error.code ?? null,
        // Whether a return URL was configured, never what it was. A reset flow that silently falls
        // back to the project Site URL is the one that is hardest to diagnose from the outside.
        redirect_configured: returnUrl !== null,
      },
    })
  }
}

/**
 * What setting a new password can come back as.
 *
 * `NO_SESSION` and `WEAK_PASSWORD` are told apart because the two need opposite advice: one person
 * has to request a fresh link, the other has to choose a different password. `SAME_PASSWORD` is
 * GoTrue's own refusal and is kept distinct for the same reason — "that is the password you already
 * have" is actionable and "something went wrong" is not.
 */
export type SetPasswordOutcome = 'UPDATED' | 'WEAK_PASSWORD' | 'SAME_PASSWORD' | 'NO_SESSION'

/**
 * Set the password of whoever holds the current session.
 *
 * THE SESSION IS THE AUTHORISATION, and it is the only one there is. `updateUser` acts on the
 * caller's own account and cannot be pointed at another, which is why this needs no permission
 * check and no user id argument: there is no id to get wrong. A recovery link establishes exactly
 * that session and nothing more — it is not a Studio session, and it grants no access to any page
 * on its own, because every Studio page resolves its staff profile separately.
 *
 * A SUSPENDED OR INVITED PROFILE MAY STILL SET A PASSWORD. Nothing is gained by refusing: the
 * password is the auth account's, and `getStaffSession()` admits only ACTIVE profiles, so the new
 * password opens precisely as much as the old one did — nothing.
 */
export async function setPasswordForCurrentSession(password: string): Promise<SetPasswordOutcome> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'NO_SESSION'

  const { error } = await supabase.auth.updateUser({ password })

  if (!error) return 'UPDATED'

  /*
   * THE AUTH SERVER OWNS THE PASSWORD POLICY, so this reads its answer rather than restating the
   * policy here. A minimum length duplicated in the application is a rule that silently disagrees
   * with the configured one the day somebody raises it in the dashboard — refusing passwords the
   * project accepts, or accepting ones it does not and reporting the refusal as a fault.
   */
  if (error.code === 'weak_password' || error.status === 422) return 'WEAK_PASSWORD'
  if (error.code === 'same_password') return 'SAME_PASSWORD'
  if (error.status === 401 || error.code === 'session_not_found') return 'NO_SESSION'

  throw new Error(
    `the auth service refused the password change ` +
      `(status ${String(error.status ?? 'none')}, code ${error.code ?? 'none'})`,
    { cause: error },
  )
}
