/**
 * Studio copy, as typed constants.
 *
 * WHY THIS FILE EXISTS AT ALL, GIVEN THE "no copy in JSX" RULE. The rule's real requirement is
 * that changing wording never requires a code change, and its permanent home is `global_content`.
 * That table does not exist until Phase 08 and nothing seeds it until Phase 09, yet the login page
 * has to render in Phase 04 — before any session, and therefore before any Studio editing surface.
 * Inventing a `site_settings`-style key/value table here would contradict `DATA_MODEL.md`, which
 * records deliberately that no such table exists. So the wording lives here, under the keys it will
 * carry into the database, and the swap is a change to one function body rather than to call sites.
 *
 * THE PHASE 09 SWAP. Every entry declares the `global_content` row it becomes: group `STUDIO_HELP`,
 * key `contentKey`. When those rows are seeded, `t()` reads a request-scoped map loaded from
 * `global_content` and falls back to `value` when a row is missing or disabled — the login page
 * renders before a session exists, so its rows are read through the anonymous policy
 * (`status = 'PUBLISHED'` and `is_enabled`). Nothing in `app/(studio)/**` changes.
 *
 * PROVENANCE. The heading, body and button are SEED §38 verbatim and are `fact_classification =
 * 'BRAND_COPY'` carrying `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` when seeded: they name
 * the business and describe its scope, which only the owner can confirm. The remaining strings are
 * interface mechanics — labels, a required marker, failure states — written here because the
 * specifications do not supply them. None of them asserts a business fact, and the failure states
 * are deliberately incurious: they never say whether an account exists.
 */

/** One string of record, with the address it takes when the copy moves into the CMS. */
type StudioStringEntry = {
  /** The wording. SEED §38 verbatim where the specification supplies it. */
  readonly value: string
  /** The `global_content` key this becomes in Phase 09, inside the `STUDIO_HELP` group. */
  readonly contentKey: `studio_help.${string}`
}

/**
 * Keys are dotted and namespaced by surface (`studio.login.*`) so a later surface — the shell, the
 * users page — extends this object without renaming anything. The `satisfies` keeps every entry
 * shaped alike while `as const` preserves the literal key union that types `t()`.
 */
export const STUDIO_STRINGS = {
  /** The document title. Distinct key from the heading because a `<title>` and an `<h1>` diverge
   *  the moment the browser tab needs a suffix, even though today they read the same. */
  'studio.login.pageTitle': {
    value: 'Rivya Studio',
    contentKey: 'studio_help.login_page_title',
  },
  /** SEED §38 heading, verbatim. */
  'studio.login.heading': {
    value: 'Rivya Studio',
    contentKey: 'studio_help.login_heading',
  },
  /** SEED §38 body, verbatim. */
  'studio.login.body': {
    value: 'Manage the collection, website, media, enquiries and research workspace.',
    contentKey: 'studio_help.login_body',
  },
  'studio.login.emailLabel': {
    value: 'Email',
    contentKey: 'studio_help.login_email_label',
  },
  'studio.login.passwordLabel': {
    value: 'Password',
    contentKey: 'studio_help.login_password_label',
  },
  /** DESIGN_SYSTEM §7.4 marks a required field with the word, never an asterisk alone. */
  'studio.login.requiredLabel': {
    value: 'Required',
    contentKey: 'studio_help.login_required_label',
  },
  /** SEED §38 button, verbatim. There is no sign-up counterpart, by §38 and by D4. */
  'studio.login.submitButton': {
    value: 'Sign In',
    contentKey: 'studio_help.login_button',
  },
  /**
   * The generic sign-in failure. One message for every rejected attempt — wrong password, unknown
   * address, unconfirmed account — because a message that distinguishes them is an account
   * enumeration oracle for anyone willing to submit a list of addresses.
   */
  'studio.login.errorSignIn': {
    value:
      'Those sign-in details were not accepted. Check the email address and password, then try again.',
    contentKey: 'studio_help.login_error_generic',
  },
  /** Submitted values that fail validation before any credential is checked. SEED §49 generic. */
  'studio.login.errorFields': {
    value: 'Please check the highlighted fields and try again.',
    contentKey: 'studio_help.login_error_fields',
  },
  /** Shown when middleware sent a signed-out request here from a Studio route it could not serve. */
  'studio.login.noticeExpired': {
    value: 'Your session has ended. Sign in again to continue.',
    contentKey: 'studio_help.login_notice_expired',
  },
  /**
   * Authenticated, but not staff. The distinction matters to the person reading it: their password
   * was correct and repeating it will not help. It states the invitation route rather than offering
   * a self-service one, because there is no public sign-up (STUDIO_GUIDE §2.1).
   */
  'studio.login.noAccessHeading': {
    value: 'This account does not have Studio access.',
    contentKey: 'studio_help.login_no_access_heading',
  },
  'studio.login.noAccessBody': {
    value:
      'You are signed in, but this account has no active staff profile. Studio access is granted by invitation from an owner or an admin.',
    contentKey: 'studio_help.login_no_access_body',
  },
  'studio.login.signOutButton': {
    value: 'Sign Out',
    contentKey: 'studio_help.login_sign_out_button',
  },
  // ---------------------------------------------------------------------------------------------
  // studio.users.* — /studio/system/users
  // ---------------------------------------------------------------------------------------------
  // Interface mechanics only. Nothing here asserts a business fact, and no message names a person:
  // the table renders addresses from `staff_profiles`, while these strings stay about the mechanism.
  // The refusal messages say what to do next rather than what went wrong, because the two refusals
  // this page can produce are both recoverable by one specific action.

  'studio.users.pageTitle': {
    value: 'Staff and access',
    contentKey: 'studio_help.users_page_title',
  },
  'studio.users.heading': {
    value: 'Staff and access',
    contentKey: 'studio_help.users_heading',
  },
  'studio.users.body': {
    value:
      'Everyone who can sign in to Studio, the role they hold and whether their account is active.',
    contentKey: 'studio_help.users_body',
  },

  'studio.users.tableCaption': {
    value: 'Staff accounts, with the role and the account state of each.',
    contentKey: 'studio_help.users_table_caption',
  },
  'studio.users.columnPerson': {
    value: 'Person',
    contentKey: 'studio_help.users_column_person',
  },
  'studio.users.columnRole': {
    value: 'Role',
    contentKey: 'studio_help.users_column_role',
  },
  'studio.users.columnStatus': {
    value: 'Status',
    contentKey: 'studio_help.users_column_status',
  },
  'studio.users.columnLastSeen': {
    value: 'Last seen',
    contentKey: 'studio_help.users_column_last_seen',
  },
  'studio.users.columnAccount': {
    value: 'Account',
    contentKey: 'studio_help.users_column_account',
  },
  'studio.users.emptyTable': {
    value: 'No staff accounts yet.',
    contentKey: 'studio_help.users_empty_table',
  },
  'studio.users.noDisplayName': {
    value: 'No name set',
    contentKey: 'studio_help.users_no_display_name',
  },
  'studio.users.noEmail': {
    value: 'No email address',
    contentKey: 'studio_help.users_no_email',
  },
  'studio.users.neverSeen': {
    value: 'Not yet signed in',
    contentKey: 'studio_help.users_never_seen',
  },

  /** Composed with the row's email address to name the control a row's select belongs to. */
  'studio.users.roleControlLabel': {
    value: 'Role for',
    contentKey: 'studio_help.users_role_control_label',
  },
  'studio.users.roleSubmit': {
    value: 'Save role',
    contentKey: 'studio_help.users_role_submit',
  },
  'studio.users.suspendButton': {
    value: 'Suspend',
    contentKey: 'studio_help.users_suspend_button',
  },
  /** An invited account has never been active, so it is activated rather than reactivated. */
  'studio.users.activateButton': {
    value: 'Activate',
    contentKey: 'studio_help.users_activate_button',
  },
  'studio.users.reactivateButton': {
    value: 'Reactivate',
    contentKey: 'studio_help.users_reactivate_button',
  },

  'studio.users.inviteHeading': {
    value: 'Invite a staff member',
    contentKey: 'studio_help.users_invite_heading',
  },
  'studio.users.inviteBody': {
    value:
      'Studio accounts exist by invitation only; there is no public sign-up. The invitation email carries a link that lets them set a password. Activate the account once they have accepted.',
    contentKey: 'studio_help.users_invite_body',
  },
  'studio.users.inviteEmailLabel': {
    value: 'Email',
    contentKey: 'studio_help.users_invite_email_label',
  },
  'studio.users.inviteEmailHelp': {
    value: 'The address the invitation is sent to.',
    contentKey: 'studio_help.users_invite_email_help',
  },
  'studio.users.inviteNameLabel': {
    value: 'Display name',
    contentKey: 'studio_help.users_invite_name_label',
  },
  'studio.users.inviteNameHelp': {
    value: 'Optional. How they are listed in this table.',
    contentKey: 'studio_help.users_invite_name_help',
  },
  'studio.users.inviteRoleLabel': {
    value: 'Role',
    contentKey: 'studio_help.users_invite_role_label',
  },
  'studio.users.inviteRoleHelp': {
    value: 'The role they start with. It can be changed at any time.',
    contentKey: 'studio_help.users_invite_role_help',
  },
  'studio.users.inviteSubmit': {
    value: 'Send Invitation',
    contentKey: 'studio_help.users_invite_submit',
  },
  /** DESIGN_SYSTEM §7.4 marks a required field with the word, never an asterisk alone. */
  'studio.users.requiredLabel': {
    value: 'Required',
    contentKey: 'studio_help.users_required_label',
  },

  // The six D5 roles, in the order lib/auth/permissions.ts declares them.
  'studio.users.roleOwner': {
    value: 'Owner',
    contentKey: 'studio_help.users_role_owner',
  },
  'studio.users.roleAdmin': {
    value: 'Administrator',
    contentKey: 'studio_help.users_role_admin',
  },
  'studio.users.roleEditor': {
    value: 'Editor',
    contentKey: 'studio_help.users_role_editor',
  },
  'studio.users.roleMerchandiser': {
    value: 'Merchandiser',
    contentKey: 'studio_help.users_role_merchandiser',
  },
  'studio.users.roleResearcher': {
    value: 'Researcher',
    contentKey: 'studio_help.users_role_researcher',
  },
  'studio.users.roleViewer': {
    value: 'Viewer',
    contentKey: 'studio_help.users_role_viewer',
  },

  // The three `staff_profiles.status` values.
  'studio.users.statusInvited': {
    value: 'Invited',
    contentKey: 'studio_help.users_status_invited',
  },
  'studio.users.statusActive': {
    value: 'Active',
    contentKey: 'studio_help.users_status_active',
  },
  'studio.users.statusSuspended': {
    value: 'Suspended',
    contentKey: 'studio_help.users_status_suspended',
  },

  'studio.users.noticeInvited': {
    value: 'Invitation sent. Activate the account once they have accepted it.',
    contentKey: 'studio_help.users_notice_invited',
  },
  'studio.users.noticeRoleChanged': {
    value: 'Role updated.',
    contentKey: 'studio_help.users_notice_role_changed',
  },
  'studio.users.noticeActivated': {
    value: 'Account activated. They can sign in to Studio.',
    contentKey: 'studio_help.users_notice_activated',
  },
  'studio.users.noticeSuspended': {
    value: 'Account suspended. They can no longer sign in.',
    contentKey: 'studio_help.users_notice_suspended',
  },
  /**
   * The `enforce_last_owner` refusal, said in the words of the person reading it. The database
   * hint is "Promote another staff member to owner first"; this is that hint, not a paraphrase.
   */
  'studio.users.noticeLastOwner': {
    value:
      'This is the last active owner. Promote another staff member to owner first, then demote or suspend this one.',
    contentKey: 'studio_help.users_notice_last_owner',
  },
  /** Refused because `system.owner.transfer` is held by `owner` alone (permission matrix D5). */
  'studio.users.noticeOwnerGrant': {
    value: 'Only an owner can grant the owner role.',
    contentKey: 'studio_help.users_notice_owner_grant',
  },
  'studio.users.noticeEmailInUse': {
    value:
      'That address already has a Studio account. Change its role in the table above rather than inviting it again.',
    contentKey: 'studio_help.users_notice_email_in_use',
  },
  'studio.users.noticeInvalid': {
    value: 'That request was not valid. Check the email address and the role, then try again.',
    contentKey: 'studio_help.users_notice_invalid',
  },
} as const satisfies Record<string, StudioStringEntry>

/** Every key this module resolves. A typo is a compile error, not a blank space on the page. */
export type StudioStringKey = keyof typeof STUDIO_STRINGS

/**
 * Resolve one Studio string.
 *
 * Synchronous on purpose. Phase 09 replaces this body with a lookup against a request-scoped map
 * of `global_content` rows loaded once per render, keeping the signature — an async accessor would
 * force every call site into `await`, which is exactly the churn this indirection exists to avoid.
 */
export function t(key: StudioStringKey): string {
  return STUDIO_STRINGS[key].value
}

/**
 * The `global_content` key a string will be seeded under. Phase 09's seed module reads this rather
 * than restating the mapping, so the two cannot drift.
 */
export function studioContentKey(key: StudioStringKey): string {
  return STUDIO_STRINGS[key].contentKey
}
