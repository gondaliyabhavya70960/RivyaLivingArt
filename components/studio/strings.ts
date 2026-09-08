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
  /** Shown when `proxy.ts` sent a signed-out request here from a Studio route it could not serve. */
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

  /* ---------------------------------------------------------------- navigation (Phase 05) */
  /**
   * Sidebar labels, one per D4 group and leaf.
   *
   * These are interface mechanics, not marketing copy: they name a destination. They live here
   * for the same reason as everything above — so Phase 09 can move them into `global_content`
   * without touching `lib/auth/studio-nav.ts`, which holds the route map and must never hold
   * wording. The manifest refers to them by key only.
   */
  'studio.nav.overview': {
    value: 'Overview',
    contentKey: 'studio_help.nav_overview',
  },
  'studio.nav.catalog': {
    value: 'Catalog',
    contentKey: 'studio_help.nav_catalog',
  },
  'studio.nav.catalog.products': {
    value: 'Products',
    contentKey: 'studio_help.nav_catalog_products',
  },
  'studio.nav.catalog.categories': {
    value: 'Categories',
    contentKey: 'studio_help.nav_catalog_categories',
  },
  'studio.nav.catalog.collections': {
    value: 'Collections',
    contentKey: 'studio_help.nav_catalog_collections',
  },
  'studio.nav.catalog.materials': {
    value: 'Materials',
    contentKey: 'studio_help.nav_catalog_materials',
  },
  'studio.nav.catalog.relationships': {
    value: 'Relationships',
    contentKey: 'studio_help.nav_catalog_relationships',
  },
  'studio.nav.catalog.customization-forms': {
    value: 'Customization forms',
    contentKey: 'studio_help.nav_catalog_customization_forms',
  },
  'studio.nav.catalog.bulk': {
    value: 'Bulk',
    contentKey: 'studio_help.nav_catalog_bulk',
  },
  'studio.nav.merchandising': {
    value: 'Merchandising',
    contentKey: 'studio_help.nav_merchandising',
  },
  'studio.nav.merchandising.homepage': {
    value: 'Homepage',
    contentKey: 'studio_help.nav_merchandising_homepage',
  },
  'studio.nav.merchandising.store': {
    value: 'Store',
    contentKey: 'studio_help.nav_merchandising_store',
  },
  'studio.nav.merchandising.featured': {
    value: 'Featured',
    contentKey: 'studio_help.nav_merchandising_featured',
  },
  'studio.nav.merchandising.scheduling': {
    value: 'Scheduling',
    contentKey: 'studio_help.nav_merchandising_scheduling',
  },
  'studio.nav.content': {
    value: 'Content',
    contentKey: 'studio_help.nav_content',
  },
  'studio.nav.content.pages': {
    value: 'Pages',
    contentKey: 'studio_help.nav_content_pages',
  },
  'studio.nav.content.homepage': {
    value: 'Homepage',
    contentKey: 'studio_help.nav_content_homepage',
  },
  'studio.nav.content.portfolio': {
    value: 'Portfolio',
    contentKey: 'studio_help.nav_content_portfolio',
  },
  'studio.nav.content.journal': {
    value: 'Journal',
    contentKey: 'studio_help.nav_content_journal',
  },
  'studio.nav.content.testimonials': {
    value: 'Testimonials',
    contentKey: 'studio_help.nav_content_testimonials',
  },
  'studio.nav.content.faqs': {
    value: 'FAQs',
    contentKey: 'studio_help.nav_content_faqs',
  },
  'studio.nav.content.navigation': {
    value: 'Navigation',
    contentKey: 'studio_help.nav_content_navigation',
  },
  'studio.nav.content.footer': {
    value: 'Footer',
    contentKey: 'studio_help.nav_content_footer',
  },
  'studio.nav.content.seo': {
    value: 'SEO',
    contentKey: 'studio_help.nav_content_seo',
  },
  'studio.nav.media': {
    value: 'Media',
    contentKey: 'studio_help.nav_media',
  },
  'studio.nav.media.all': {
    value: 'All media',
    contentKey: 'studio_help.nav_media_all',
  },
  'studio.nav.media.images': {
    value: 'Images',
    contentKey: 'studio_help.nav_media_images',
  },
  'studio.nav.media.videos': {
    value: 'Videos',
    contentKey: 'studio_help.nav_media_videos',
  },
  'studio.nav.media.models': {
    value: '3D models',
    contentKey: 'studio_help.nav_media_models',
  },
  'studio.nav.media.documents': {
    value: 'Documents',
    contentKey: 'studio_help.nav_media_documents',
  },
  'studio.nav.media.higgsfield': {
    value: 'Higgsfield',
    contentKey: 'studio_help.nav_media_higgsfield',
  },
  'studio.nav.media.brand': {
    value: 'Brand',
    contentKey: 'studio_help.nav_media_brand',
  },
  'studio.nav.inquiries': {
    value: 'Inquiries',
    contentKey: 'studio_help.nav_inquiries',
  },
  'studio.nav.inquiries.all': {
    value: 'All enquiries',
    contentKey: 'studio_help.nav_inquiries_all',
  },
  'studio.nav.inquiries.product': {
    value: 'Product',
    contentKey: 'studio_help.nav_inquiries_product',
  },
  'studio.nav.inquiries.commission': {
    value: 'Commission',
    contentKey: 'studio_help.nav_inquiries_commission',
  },
  'studio.nav.inquiries.consultation': {
    value: 'Consultation',
    contentKey: 'studio_help.nav_inquiries_consultation',
  },
  'studio.nav.inquiries.quote': {
    value: 'Quote',
    contentKey: 'studio_help.nav_inquiries_quote',
  },
  'studio.nav.research': {
    value: 'Research',
    contentKey: 'studio_help.nav_research',
  },
  'studio.nav.research.dashboard': {
    value: 'Dashboard',
    contentKey: 'studio_help.nav_research_dashboard',
  },
  'studio.nav.research.sources': {
    value: 'Sources',
    contentKey: 'studio_help.nav_research_sources',
  },
  'studio.nav.research.scrape': {
    value: 'Scrape',
    contentKey: 'studio_help.nav_research_scrape',
  },
  'studio.nav.research.jobs': {
    value: 'Jobs',
    contentKey: 'studio_help.nav_research_jobs',
  },
  'studio.nav.research.runs': {
    value: 'Runs',
    contentKey: 'studio_help.nav_research_runs',
  },
  'studio.nav.research.changes': {
    value: 'Changes',
    contentKey: 'studio_help.nav_research_changes',
  },
  'studio.nav.research.explorer': {
    value: 'Explorer',
    contentKey: 'studio_help.nav_research_explorer',
  },
  'studio.nav.research.large-format': {
    value: 'Large format',
    contentKey: 'studio_help.nav_research_large_format',
  },
  'studio.nav.research.compare': {
    value: 'Compare',
    contentKey: 'studio_help.nav_research_compare',
  },
  'studio.nav.research.similarity': {
    value: 'Similarity',
    contentKey: 'studio_help.nav_research_similarity',
  },
  'studio.nav.research.opportunities': {
    value: 'Opportunities',
    contentKey: 'studio_help.nav_research_opportunities',
  },
  'studio.nav.research.shortlist': {
    value: 'Shortlist',
    contentKey: 'studio_help.nav_research_shortlist',
  },
  'studio.nav.research.confirmed': {
    value: 'Confirmed',
    contentKey: 'studio_help.nav_research_confirmed',
  },
  'studio.nav.research.sheets': {
    value: 'Sheets',
    contentKey: 'studio_help.nav_research_sheets',
  },
  'studio.nav.operations': {
    value: 'Operations',
    contentKey: 'studio_help.nav_operations',
  },
  'studio.nav.operations.workflows': {
    value: 'Workflows',
    contentKey: 'studio_help.nav_operations_workflows',
  },
  'studio.nav.operations.data-quality': {
    value: 'Data quality',
    contentKey: 'studio_help.nav_operations_data_quality',
  },
  'studio.nav.operations.imports': {
    value: 'Imports',
    contentKey: 'studio_help.nav_operations_imports',
  },
  'studio.nav.operations.exports': {
    value: 'Exports',
    contentKey: 'studio_help.nav_operations_exports',
  },
  'studio.nav.operations.audit': {
    value: 'Audit log',
    contentKey: 'studio_help.nav_operations_audit',
  },
  'studio.nav.operations.logs': {
    value: 'System logs',
    contentKey: 'studio_help.nav_operations_logs',
  },
  'studio.nav.system': {
    value: 'System',
    contentKey: 'studio_help.nav_system',
  },
  'studio.nav.system.users': {
    value: 'Users',
    contentKey: 'studio_help.nav_system_users',
  },
  'studio.nav.system.settings': {
    value: 'Settings',
    contentKey: 'studio_help.nav_system_settings',
  },
  'studio.nav.system.integrations': {
    value: 'Integrations',
    contentKey: 'studio_help.nav_system_integrations',
  },
  'studio.nav.system.environment': {
    value: 'Environment',
    contentKey: 'studio_help.nav_system_environment',
  },
  'studio.nav.system.documentation': {
    value: 'Documentation',
    contentKey: 'studio_help.nav_system_documentation',
  },
  'studio.nav.system.flags': {
    value: 'Feature flags',
    contentKey: 'studio_help.nav_system_flags',
  },

  /* --------------------------------------------------------------------- shell (Phase 05) */
  'studio.shell.productName': {
    value: 'Rivya Studio',
    contentKey: 'studio_help.shell_product_name',
  },
  'studio.shell.skipToContent': {
    value: 'Skip to content',
    contentKey: 'studio_help.shell_skip_to_content',
  },
  'studio.shell.primaryNavLabel': {
    value: 'Studio sections',
    contentKey: 'studio_help.shell_primary_nav_label',
  },
  'studio.shell.signOut': {
    value: 'Sign out',
    contentKey: 'studio_help.shell_sign_out',
  },
  /** Shown in place of a name for an account that has neither a display name nor an email. */
  'studio.shell.unnamedAccount': {
    value: 'Staff account',
    contentKey: 'studio_help.shell_unnamed_account',
  },
  /* ---------------------------------------------------------------- stub notice (Phase 05) */
  /**
   * The words a not-yet-built surface shows.
   *
   * NEVER "Coming Soon" — SEED §55 forbids it, and rightly: it promises a date nobody has set. The
   * notice names the phase that will build the surface, which is a checkable statement about this
   * project rather than a reassurance.
   */
  'studio.stub.heading': {
    value: 'Not built yet',
    contentKey: 'studio_help.stub_heading',
  },
  'studio.stub.body': {
    value:
      'This section of the Studio has a route and a permission, so navigation never dead-ends, but nothing reads or writes here yet.',
    contentKey: 'studio_help.stub_body',
  },
  /** Interpolated with the phase number by StudioPage. */
  'studio.stub.owningPhase': {
    value: 'Built in phase',
    contentKey: 'studio_help.stub_owning_phase',
  },
  /** A page under /studio that is not in the navigation manifest. Should be unreachable. */
  'studio.stub.unregisteredRoute': {
    value:
      'This route is not in the Studio navigation manifest, so nothing can link to it and no permission governs it.',
    contentKey: 'studio_help.stub_unregistered_route',
  },
  'studio.shell.breadcrumbLabel': {
    value: 'Breadcrumb',
    contentKey: 'studio_help.shell_breadcrumb_label',
  },

  /* ------------------------------------------------------------ dashboard cards (Phase 05) */
  'studio.card.products': {
    value: 'Products',
    contentKey: 'studio_help.card_products',
  },
  'studio.card.productsPublished': {
    value: 'Published products',
    contentKey: 'studio_help.card_products_published',
  },
  'studio.card.productsDraft': {
    value: 'Draft products',
    contentKey: 'studio_help.card_products_draft',
  },
  'studio.card.collections': {
    value: 'Collections',
    contentKey: 'studio_help.card_collections',
  },
  'studio.card.mediaAssets': {
    value: 'Media assets',
    contentKey: 'studio_help.card_media_assets',
  },
  'studio.card.productsLargeFormat': {
    value: 'Large-format products',
    contentKey: 'studio_help.card_products_large_format',
  },
  'studio.card.portfolioProjects': {
    value: 'Portfolio projects',
    contentKey: 'studio_help.card_portfolio_projects',
  },
  'studio.card.journalArticles': {
    value: 'Journal articles',
    contentKey: 'studio_help.card_journal_articles',
  },
  'studio.card.inquiriesOpen': {
    value: 'Open enquiries',
    contentKey: 'studio_help.card_inquiries_open',
  },
  'studio.card.inquiriesCommission': {
    value: 'Commission enquiries',
    contentKey: 'studio_help.card_inquiries_commission',
  },
  'studio.card.scraperRuns': {
    value: 'Scraper runs',
    contentKey: 'studio_help.card_scraper_runs',
  },
  'studio.card.competitorProductsNew': {
    value: 'New competitor products',
    contentKey: 'studio_help.card_competitor_products_new',
  },
  'studio.card.competitorProductsChanged': {
    value: 'Changed competitor products',
    contentKey: 'studio_help.card_competitor_products_changed',
  },
  'studio.card.productsAwaitingReview': {
    value: 'Awaiting review',
    contentKey: 'studio_help.card_products_awaiting_review',
  },
  'studio.card.productsShortlisted': {
    value: 'Shortlisted products',
    contentKey: 'studio_help.card_products_shortlisted',
  },
  'studio.card.productsConfirmed': {
    value: 'Confirmed products',
    contentKey: 'studio_help.card_products_confirmed',
  },
  'studio.card.mediaMissing': {
    value: 'Missing media',
    contentKey: 'studio_help.card_media_missing',
  },
  'studio.card.higgsfieldPending': {
    value: 'Higgsfield assets pending',
    contentKey: 'studio_help.card_higgsfield_pending',
  },
  'studio.card.dataQualityErrors': {
    value: 'Data quality errors',
    contentKey: 'studio_help.card_data_quality_errors',
  },
  'studio.card.systemHealth': {
    value: 'System health',
    contentKey: 'studio_help.card_system_health',
  },
  /* --------------------------------------------------------------- overview page (Phase 05) */
  'studio.overview.tabOverview': {
    value: 'Overview',
    contentKey: 'studio_help.overview_tab_overview',
  },
  'studio.overview.tabAnalytics': {
    value: 'Analytics',
    contentKey: 'studio_help.overview_tab_analytics',
  },
  'studio.overview.tabActivity': {
    value: 'Activity',
    contentKey: 'studio_help.overview_tab_activity',
  },
  'studio.overview.tabsLabel': {
    value: 'Overview sections',
    contentKey: 'studio_help.overview_tabs_label',
  },
  /** Shown on a card whose table exists but whose count could not be read. Never rendered as 0. */
  'studio.card.unreadable': {
    value: 'Could not be read',
    contentKey: 'studio_help.card_unreadable',
  },
  /** Shown on a card whose table does not exist yet, followed by the phase number. */
  'studio.card.unavailable': {
    value: 'Available from phase',
    contentKey: 'studio_help.card_unavailable',
  },
  'studio.activity.empty': {
    value: 'Nothing has been changed in the Studio yet.',
    contentKey: 'studio_help.activity_empty',
  },
  'studio.activity.failed': {
    value: 'The activity feed could not be read. This is not the same as nothing having happened.',
    contentKey: 'studio_help.activity_failed',
  },
  'studio.analytics.stub': {
    value: 'Analytics arrives in phase 37. Nothing is measured here yet, so no figure is shown.',
    contentKey: 'studio_help.analytics_stub',
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
