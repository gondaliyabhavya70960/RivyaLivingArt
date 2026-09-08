import 'server-only'

import { createAdminClient } from '../supabase/admin'
import { elevateInvitedProfile } from '../supabase/repositories/staff'
import type { Role } from './permissions'

/**
 * Staff provisioning — the only code path in the application that creates an account.
 *
 * WHY THIS FILE HOLDS THE SERVICE ROLE. Creating an `auth.users` row is not something a session
 * can do at any privilege level: GoTrue's admin API is the only way in, and it authenticates with
 * the service-role key. Public sign-up is disabled at the project level (PHASE-00-04 §PHASE 04),
 * so an invitation issued here is the single route to a Studio account, by design rather than by
 * accident of configuration.
 *
 * WHY IT IS A MODULE AND NOT INLINE IN THE PAGE. `eslint.config.mjs` names the small set of files
 * permitted to import `lib/supabase/admin.ts`, and a page under `app/(studio)/**` is deliberately
 * not one of them: a surface that renders is a surface where a service-role client is one careless
 * query away from bypassing RLS on something unrelated. Pushing the invitation behind this
 * function keeps the allowlist entry precise — one file, one reason, one exported operation.
 *
 * THE CALLER STILL CHECKS THE PERMISSION. Nothing here asks who is calling; RLS is not the check
 * on a service-role client, so the check has to be the caller's. Every call site runs through
 * `withPermission('system.users.manage', ...)` first, and the `invitedBy` argument is the session
 * id that check returned — never a value from the request.
 */

/**
 * What happened, for the two outcomes an interface has to tell apart. Anything else throws: an
 * auth service that is refusing invitations for a reason nobody anticipated is a fault to surface,
 * not a state to render.
 *
 * The new account's id travels with the success case so the caller's audit row can name the record
 * it created. The refusal carries `null` rather than omitting the field, because a union whose
 * members have the same keys is one a caller can read without narrowing first.
 */
export type InviteResult =
  { outcome: 'INVITED'; userId: string } | { outcome: 'EMAIL_IN_USE'; userId: null }

export type StaffInvite = {
  /** Already trimmed, lowercased and schema-validated by the caller. */
  email: string
  /** The role the account starts with. The caller decides whether this session may grant it. */
  role: Role
  displayName: string | null
  /** `user_id` of the owner or admin issuing the invitation, from the checked session. */
  invitedBy: string
  /**
   * Absolute URL the invitation link returns to once accepted. Omitted, GoTrue falls back to the
   * project's own Site URL, which is the right behaviour on a deployment that has one configured.
   */
  redirectTo?: string | undefined
}

/**
 * An address that already has an account is an ordinary outcome, not a fault.
 *
 * GoTrue reports it as `email_exists` (some versions: `user_already_exists`) with HTTP 422. The
 * status is checked as well as the code because the code was added later than the status, and a
 * project on an older auth image would otherwise surface a duplicate invitation as a 500.
 */
function isEmailInUse(status: number | undefined, code: string | undefined): boolean {
  return code === 'email_exists' || code === 'user_already_exists' || status === 422
}

/**
 * Invite one staff member, and give the new profile the role it was invited for.
 *
 * Two steps, in this order and not the other one. `handle_new_auth_user` (migration 0009) creates
 * the profile as INVITED/viewer the moment the auth user exists, so the profile is a fact by the
 * time the invitation call returns and the second step is an update rather than an insert. That
 * ordering is what makes least privilege the default even if this function fails halfway: a
 * half-provisioned account is a viewer who has been invited, never an owner nobody meant to make.
 *
 * The account stays INVITED. Nothing here activates it, because `getStaffSession()` admits only
 * ACTIVE profiles and activation is a second, separately audited decision by a human who can see
 * that the invitation was accepted.
 */
export async function inviteStaffMember(invite: StaffInvite): Promise<InviteResult> {
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.inviteUserByEmail(invite.email, {
    ...(invite.redirectTo === undefined ? {} : { redirectTo: invite.redirectTo }),
  })

  if (error) {
    if (isEmailInUse(error.status, error.code)) return { outcome: 'EMAIL_IN_USE', userId: null }
    // The status and the code, never the message: a GoTrue message can quote the address it was
    // given, and this string is on its way to a log and to withPermission's audit summary.
    throw new Error(
      `the auth service refused the invitation (status ${error.status ?? 'none'}, code ${error.code ?? 'none'})`,
      { cause: error },
    )
  }

  const invited = data.user
  if (!invited) {
    throw new Error('the auth service accepted the invitation but returned no account')
  }

  // Through the repository. The `on_auth_user_created` trigger has already created this row as
  // INVITED/viewer, so an invitation ELEVATES an existing row rather than inserting one — inserting
  // here would race the trigger.
  //
  // elevateInvitedProfile throws NotFoundError when no row came back, which means the trigger did
  // not run: the account exists in `auth.users` with nothing in `staff_profiles`, and no policy or
  // session will ever resolve it. Loud, because the silent version is an invitation that arrives
  // and then admits nobody.
  await elevateInvitedProfile(admin, invited.id, {
    role: invite.role,
    displayName: invite.displayName,
    invitedBy: invite.invitedBy,
  })

  return { outcome: 'INVITED', userId: invited.id }
}
