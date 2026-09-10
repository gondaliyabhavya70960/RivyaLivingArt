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
  'studio.nav.content.journalCategories': {
    value: 'Journal categories',
    contentKey: 'studio_help.nav_content_journal_categories',
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
  'studio.activity.emptyHeading': {
    value: 'No activity yet',
    contentKey: 'studio_help.activity_empty_heading',
  },
  'studio.activity.failedHeading': {
    value: 'The feed could not be read',
    contentKey: 'studio_help.activity_failed_heading',
  },
  /* ------------------------------------------------------- page states (Phase 05, SEED 45/46) */
  'studio.state.loading': {
    value: 'Loading',
    contentKey: 'studio_help.state_loading',
  },
  'studio.state.notFoundHeading': {
    value: 'That page is not here',
    contentKey: 'studio_help.state_not_found_heading',
  },
  'studio.state.notFoundBody': {
    value:
      'The link may be out of date, or the record may have been removed. Nothing has been changed.',
    contentKey: 'studio_help.state_not_found_body',
  },
  'studio.state.errorHeading': {
    value: 'Something interrupted this page',
    contentKey: 'studio_help.state_error_heading',
  },
  'studio.state.errorBody': {
    value: 'The page could not be loaded. Nothing you were doing has been saved or changed.',
    contentKey: 'studio_help.state_error_body',
  },
  /** Precedes the error digest, which is what correlates this screen with the server log. */
  'studio.state.errorReference': {
    value: 'Reference',
    contentKey: 'studio_help.state_error_reference',
  },
  'studio.state.tryAgain': {
    value: 'Try again',
    contentKey: 'studio_help.state_try_again',
  },
  'studio.state.backToOverview': {
    value: 'Back to the Overview',
    contentKey: 'studio_help.state_back_to_overview',
  },
  /* ------------------------------------------------------------ command palette (Phase 05) */
  'studio.command.groupRoutes': {
    value: 'Go to',
    contentKey: 'studio_help.command_group_routes',
  },
  'studio.command.label': {
    value: 'Search the Studio',
    contentKey: 'studio_help.command_label',
  },
  'studio.command.placeholder': {
    value: 'Type to search',
    contentKey: 'studio_help.command_placeholder',
  },
  'studio.command.noResults': {
    value: 'Nothing matched that.',
    contentKey: 'studio_help.command_no_results',
  },
  /** Shown when a provider hit its time budget, so results are not presented as complete. */
  'studio.command.incomplete': {
    value: 'Some results are missing — a search took too long.',
    contentKey: 'studio_help.command_incomplete',
  },
  'studio.command.close': {
    value: 'Close search',
    contentKey: 'studio_help.command_close',
  },
  /* ------------------------------------------------- command palette groups (Phase 23) */
  /*
   * ONE GROUP PER INDEXED ENTITY TYPE. The palette's route provider answers "where do I go"; these
   * eight answer "where is this record". They are Studio chrome, so they live here as constants
   * like every other Studio string — the public site's rule that copy must come from the database
   * does not apply to an interface that has to render before any content exists.
   *
   * THE RESEARCH GROUPS ARE NOT HERE. Phases 25, 26 and 28 register their own providers against
   * `research_search_documents` and bring their own group names with them. Naming them now would
   * put a research identifier in a file the public search path can reach.
   */
  'studio.command.groupProducts': {
    value: 'Pieces',
    contentKey: 'studio_help.command_group_products',
  },
  'studio.command.groupCategories': {
    value: 'Categories',
    contentKey: 'studio_help.command_group_categories',
  },
  'studio.command.groupCollections': {
    value: 'Collections',
    contentKey: 'studio_help.command_group_collections',
  },
  'studio.command.groupMaterials': {
    value: 'Materials',
    contentKey: 'studio_help.command_group_materials',
  },
  'studio.command.groupPortfolio': {
    value: 'Projects',
    contentKey: 'studio_help.command_group_portfolio',
  },
  'studio.command.groupJournal': {
    value: 'Journal',
    contentKey: 'studio_help.command_group_journal',
  },
  'studio.command.groupMedia': {
    value: 'Media',
    contentKey: 'studio_help.command_group_media',
  },
  'studio.command.groupInquiries': {
    value: 'Enquiries',
    contentKey: 'studio_help.command_group_inquiries',
  },
  /* --------------------------------------------- the relationship workspace (Phase 23) */
  /*
   * THE RULE REASONS ARE NOT HERE. Those four sentences describe what a rule OBSERVED about the
   * catalogue, so an editor may reword them — they are seeded `global_content` rows read at render
   * time. What is here is the workspace's own furniture: panel names, control labels, and the
   * sentence shown when a piece has no connections yet. Studio chrome, like every other string in
   * this file.
   */
  'studio.relationships.pickerLabel': {
    value: 'Choose a piece',
    contentKey: 'studio_help.relationships_picker_label',
  },
  'studio.relationships.edgesHeading': {
    value: 'Connections',
    contentKey: 'studio_help.relationships_edges_heading',
  },
  'studio.relationships.suggestionsHeading': {
    value: 'Suggestions',
    contentKey: 'studio_help.relationships_suggestions_heading',
  },
  'studio.relationships.coverageHeading': {
    value: 'Coverage',
    contentKey: 'studio_help.relationships_coverage_heading',
  },
  'studio.relationships.accept': {
    value: 'Accept',
    contentKey: 'studio_help.relationships_accept',
  },
  'studio.relationships.dismiss': {
    value: 'Dismiss',
    contentKey: 'studio_help.relationships_dismiss',
  },
  'studio.relationships.remove': {
    value: 'Remove',
    contentKey: 'studio_help.relationships_remove',
  },
  'studio.relationships.inverse': {
    value: 'Two-way',
    contentKey: 'studio_help.relationships_inverse',
  },
  'studio.relationships.fromRule': {
    value: 'Accepted from a suggestion',
    contentKey: 'studio_help.relationships_from_rule',
  },
  'studio.relationships.emptyHeading': {
    value: 'No connections yet',
    contentKey: 'studio_help.relationships_empty_heading',
  },
  'studio.relationships.emptyBody': {
    value:
      'This piece renders the "More in {Category}" fallback until somebody makes a connection. That is a correct page, not a broken one.',
    contentKey: 'studio_help.relationships_empty_body',
  },
  'studio.relationships.noSuggestionsHeading': {
    value: 'Nothing to suggest',
    contentKey: 'studio_help.relationships_no_suggestions_heading',
  },
  'studio.relationships.noSuggestionsBody': {
    value:
      'The four rules found nothing, or everything they found is already connected or already dismissed.',
    contentKey: 'studio_help.relationships_no_suggestions_body',
  },
  'studio.relationships.pickHeading': {
    value: 'Choose a piece to see its connections',
    contentKey: 'studio_help.relationships_pick_heading',
  },
  'studio.relationships.pickBody': {
    value: 'Every published piece is listed. Suggestions are computed when you open one.',
    contentKey: 'studio_help.relationships_pick_body',
  },
  'studio.shell.searchHint': {
    value: 'Press Ctrl-K or Cmd-K to search',
    contentKey: 'studio_help.shell_search_hint',
  },
  /**
   * The deployment-environment badge. Rendered for every environment EXCEPT production, so its
   * ABSENCE means "this is the real site" — a badge that is always there stops being read.
   */
  'studio.shell.envPreview': {
    value: 'Preview',
    contentKey: 'studio_help.shell_env_preview',
  },
  'studio.shell.envDevelopment': {
    value: 'Development',
    contentKey: 'studio_help.shell_env_development',
  },
  'studio.shell.collapseSidebar': {
    value: 'Collapse navigation',
    contentKey: 'studio_help.shell_collapse_sidebar',
  },
  'studio.shell.expandSidebar': {
    value: 'Show navigation',
    contentKey: 'studio_help.shell_expand_sidebar',
  },
  'studio.shell.pinnedHeading': {
    value: 'Pinned',
    contentKey: 'studio_help.shell_pinned_heading',
  },
  'studio.page.pin': {
    value: 'Pin to the sidebar',
    contentKey: 'studio_help.page_pin',
  },
  'studio.page.unpin': {
    value: 'Unpin',
    contentKey: 'studio_help.page_unpin',
  },

  // --- Media Manager (Phase 06) -----------------------------------------------------------------
  // FEAT §13's six sections. Five are a `kind`; AI Assets is a filter on `source = 'HIGGSFIELD'`
  // across IMAGE and VIDEO, which is why its page is Phase 07's and has no string here.
  'studio.media.tableCaption': {
    value: 'Media assets',
    contentKey: 'studio_help.media_table_caption',
  },
  'studio.media.colPreview': {
    value: 'Preview',
    contentKey: 'studio_help.media_col_preview',
  },
  'studio.media.colName': {
    value: 'Name',
    contentKey: 'studio_help.media_col_name',
  },
  'studio.media.colFolder': {
    value: 'Folder',
    contentKey: 'studio_help.media_col_folder',
  },
  'studio.media.colSource': {
    value: 'Source',
    contentKey: 'studio_help.media_col_source',
  },
  'studio.media.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.media_col_status',
  },
  'studio.media.colAdded': {
    value: 'Added',
    contentKey: 'studio_help.media_col_added',
  },
  'studio.media.emptyHeading': {
    value: 'No assets here yet',
    contentKey: 'studio_help.media_empty_heading',
  },
  'studio.media.emptyBody': {
    value: 'Upload one, or import the existing Higgsfield library from the AI Assets page.',
    contentKey: 'studio_help.media_empty_body',
  },
  'studio.media.filteredHeading': {
    value: 'No assets match this filter',
    contentKey: 'studio_help.media_filtered_heading',
  },
  'studio.media.filteredBody': {
    value: 'Clear the search to see everything in this section.',
    contentKey: 'studio_help.media_filtered_body',
  },
  'studio.media.searchLabel': {
    value: 'Search by name',
    contentKey: 'studio_help.media_search_label',
  },
  'studio.media.searchAction': {
    value: 'Search',
    contentKey: 'studio_help.media_search_action',
  },

  // --- The uploader -----------------------------------------------------------------------------
  // Alt text is required BEFORE the upload, not after. See MediaUploader's header: an asset saved
  // without one cannot be published, and chasing it later is how a library fills with rows nobody
  // can use.
  /** DESIGN_SYSTEM §7.4 marks a required field with the word, never an asterisk alone. */
  'studio.media.requiredLabel': {
    value: 'Required',
    contentKey: 'studio_help.media_required_label',
  },
  'studio.media.upload.heading': {
    value: 'Upload an asset',
    contentKey: 'studio_help.media_upload_heading',
  },
  'studio.media.upload.fileLabel': {
    value: 'File',
    contentKey: 'studio_help.media_upload_file_label',
  },
  'studio.media.upload.altLabel': {
    value: 'Alt text',
    contentKey: 'studio_help.media_upload_alt_label',
  },
  'studio.media.upload.altHelp': {
    value: 'Describe what is visible, for someone who cannot see it. Required before upload.',
    contentKey: 'studio_help.media_upload_alt_help',
  },
  'studio.media.upload.folderLabel': {
    value: 'Folder',
    contentKey: 'studio_help.media_upload_folder_label',
  },
  'studio.media.upload.sourceLabel': {
    value: 'Source',
    contentKey: 'studio_help.media_upload_source_label',
  },
  'studio.media.upload.sourceHelp': {
    value:
      'Where this asset came from. There is no default — an unstated source would be a claim nobody made.',
    contentKey: 'studio_help.media_upload_source_help',
  },
  'studio.media.upload.action': {
    value: 'Upload',
    contentKey: 'studio_help.media_upload_action',
  },
  'studio.media.upload.busy': {
    value: 'Uploading…',
    contentKey: 'studio_help.media_upload_busy',
  },
  'studio.media.upload.progress': {
    value: 'Upload progress',
    contentKey: 'studio_help.media_upload_progress',
  },
  'studio.media.upload.done': {
    value: 'Uploaded. The asset is saved as a draft.',
    contentKey: 'studio_help.media_upload_done',
  },
  'studio.media.upload.needAlt': {
    value: 'Write the alt text before uploading.',
    contentKey: 'studio_help.media_upload_need_alt',
  },
  'studio.media.upload.needFile': {
    value: 'Choose a file.',
    contentKey: 'studio_help.media_upload_need_file',
  },
  'studio.media.upload.tooLarge': {
    value: 'That file is larger than this kind allows.',
    contentKey: 'studio_help.media_upload_too_large',
  },
  'studio.media.upload.wrongType': {
    value: 'That file type is not accepted here.',
    contentKey: 'studio_help.media_upload_wrong_type',
  },
  'studio.media.upload.refused': {
    value: 'The upload was refused. Nothing was saved.',
    contentKey: 'studio_help.media_upload_refused',
  },
  'studio.media.upload.failed': {
    value: 'The upload did not finish. Nothing was saved.',
    contentKey: 'studio_help.media_upload_failed',
  },
  // --- 3D models (Phase 21) ------------------------------------------------------------------------
  // The inspector's sentences, the drawer's labels and the preview viewer's chrome. The public
  // viewer reads its words from `global_content`; the Studio preview is a Studio surface and reads
  // them here, so the two can be reworded independently.
  'studio.models.list.caption': {
    value: '3D models',
    contentKey: 'studio_help.models_list_caption',
  },
  'studio.models.col.name': {
    value: 'Model',
    contentKey: 'studio_help.models_col_name',
  },
  'studio.models.col.format': {
    value: 'Format',
    contentKey: 'studio_help.models_col_format',
  },
  'studio.models.col.size': {
    value: 'Size',
    contentKey: 'studio_help.models_col_size',
  },
  'studio.models.col.triangles': {
    value: 'Triangles',
    contentKey: 'studio_help.models_col_triangles',
  },
  'studio.models.col.textures': {
    value: 'Textures',
    contentKey: 'studio_help.models_col_textures',
  },
  'studio.models.col.poster': {
    value: 'Poster',
    contentKey: 'studio_help.models_col_poster',
  },
  'studio.models.col.association': {
    value: 'Shown on',
    contentKey: 'studio_help.models_col_association',
  },
  'studio.models.col.status': {
    value: 'Status',
    contentKey: 'studio_help.models_col_status',
  },
  'studio.models.inspectAction': {
    value: 'Inspect',
    contentKey: 'studio_help.models_inspect_action',
  },
  'studio.models.notInspected': {
    value: 'Not yet inspected',
    contentKey: 'studio_help.models_not_inspected',
  },
  'studio.models.posterMissing': {
    value: 'No poster',
    contentKey: 'studio_help.models_poster_missing',
  },
  'studio.models.posterSet': {
    value: 'Set',
    contentKey: 'studio_help.models_poster_set',
  },
  'studio.models.associatedProduct': {
    value: 'Product',
    contentKey: 'studio_help.models_associated_product',
  },
  'studio.models.associatedProject': {
    value: 'Project',
    contentKey: 'studio_help.models_associated_project',
  },
  'studio.models.unassociated': {
    value: 'Nowhere yet',
    contentKey: 'studio_help.models_unassociated',
  },
  'studio.models.empty.title': {
    value: 'No 3D models',
    contentKey: 'studio_help.models_empty_title',
  },
  'studio.models.empty.body': {
    value:
      'Upload a GLB or GLTF of an object that exists. The manifest holds none, and none will be generated.',
    contentKey: 'studio_help.models_empty_body',
  },
  'studio.models.emptyFiltered.title': {
    value: 'No models match',
    contentKey: 'studio_help.models_empty_filtered_title',
  },
  'studio.models.emptyFiltered.body': {
    value: 'Clear the search to see every model.',
    contentKey: 'studio_help.models_empty_filtered_body',
  },
  'studio.models.upload.checking': {
    value: 'Checking the file…',
    contentKey: 'studio_help.models_upload_checking',
  },
  'studio.models.upload.rejectedHeading': {
    value: 'The file was refused. Nothing was uploaded.',
    contentKey: 'studio_help.models_upload_rejected_heading',
  },
  'studio.models.upload.warningsHeading': {
    value: 'Accepted, with warnings:',
    contentKey: 'studio_help.models_upload_warnings_heading',
  },
  'studio.models.upload.done': {
    value: 'Uploaded and inspected. Format, size, triangles and textures were read from the file.',
    contentKey: 'studio_help.models_upload_done',
  },
  'studio.models.rejected': {
    value: 'The model was refused and the upload discarded',
    contentKey: 'studio_help.models_rejected',
  },
  'studio.models.fetchFailed': {
    value: 'The uploaded file could not be read back for inspection. Nothing was saved.',
    contentKey: 'studio_help.models_fetch_failed',
  },
  'studio.models.reject.wrongFormat': {
    value: 'The file is not the format its name says.',
    contentKey: 'studio_help.models_reject_wrong_format',
  },
  'studio.models.reject.unparseable': {
    value: 'The file could not be parsed as glTF 2.0.',
    contentKey: 'studio_help.models_reject_unparseable',
  },
  'studio.models.reject.tooLarge': {
    value: '{{detail}} is over the 15 MB ceiling.',
    contentKey: 'studio_help.models_reject_too_large',
  },
  'studio.models.reject.compressionRequired': {
    value: '{{detail}} without Draco or meshopt compression; compression is required above 5 MB.',
    contentKey: 'studio_help.models_reject_compression_required',
  },
  'studio.models.reject.tooManyTriangles': {
    value: '{{detail}} triangles is over the 250,000 ceiling.',
    contentKey: 'studio_help.models_reject_too_many_triangles',
  },
  'studio.models.reject.textureTooLarge': {
    value: 'A texture is {{detail}} px on a side; 2048 is the ceiling.',
    contentKey: 'studio_help.models_reject_texture_too_large',
  },
  'studio.models.reject.externalResources': {
    value:
      'The file references buffers or images outside itself. Embed them and upload a single file that contains everything it needs.',
    contentKey: 'studio_help.models_reject_external_resources',
  },
  'studio.models.warn.large': {
    value: '{{detail}} is over the 8 MB budget; it will load slowly on a phone.',
    contentKey: 'studio_help.models_warn_large',
  },
  'studio.models.warn.manyTriangles': {
    value: '{{detail}} triangles is over the 150,000 budget.',
    contentKey: 'studio_help.models_warn_many_triangles',
  },
  'studio.models.warn.manyTextures': {
    value: '{{detail}} textures; more than four is unusual for one object.',
    contentKey: 'studio_help.models_warn_many_textures',
  },
  'studio.models.drawer.title': {
    value: 'Model',
    contentKey: 'studio_help.models_drawer_title',
  },
  'studio.models.drawer.close': {
    value: 'Close',
    contentKey: 'studio_help.models_drawer_close',
  },
  'studio.models.meta.heading': {
    value: 'From the file',
    contentKey: 'studio_help.models_meta_heading',
  },
  'studio.models.meta.help': {
    value: 'Read by the inspector, never typed. Re-inspect after replacing the file.',
    contentKey: 'studio_help.models_meta_help',
  },
  'studio.models.meta.format': {
    value: 'Format',
    contentKey: 'studio_help.models_meta_format',
  },
  'studio.models.meta.size': {
    value: 'Size',
    contentKey: 'studio_help.models_meta_size',
  },
  'studio.models.meta.triangles': {
    value: 'Triangles',
    contentKey: 'studio_help.models_meta_triangles',
  },
  'studio.models.meta.textures': {
    value: 'Textures',
    contentKey: 'studio_help.models_meta_textures',
  },
  'studio.models.meta.variants': {
    value: 'Finish variants in the file',
    contentKey: 'studio_help.models_meta_variants',
  },
  'studio.models.meta.none': {
    value: '—',
    contentKey: 'studio_help.models_meta_none',
  },
  'studio.models.meta.reinspect': {
    value: 'Re-inspect from the file',
    contentKey: 'studio_help.models_meta_reinspect',
  },
  'studio.models.meta.reinspected': {
    value: 'Metadata refreshed from the file.',
    contentKey: 'studio_help.models_meta_reinspected',
  },
  'studio.models.stills.heading': {
    value: 'Poster and thumbnail',
    contentKey: 'studio_help.models_stills_heading',
  },
  'studio.models.stills.poster': {
    value: 'Poster',
    contentKey: 'studio_help.models_stills_poster',
  },
  'studio.models.stills.posterHelp': {
    value:
      'What the page shows until the visitor asks for the viewer. Required before the model can be shown anywhere. An image, never the model.',
    contentKey: 'studio_help.models_stills_poster_help',
  },
  'studio.models.stills.thumbnail': {
    value: 'Thumbnail',
    contentKey: 'studio_help.models_stills_thumbnail',
  },
  'studio.models.stills.thumbnailHelp': {
    value: 'Optional. Shown in Studio lists.',
    contentKey: 'studio_help.models_stills_thumbnail_help',
  },
  'studio.models.settings.heading': {
    value: 'Viewer settings',
    contentKey: 'studio_help.models_settings_heading',
  },
  'studio.models.settings.help': {
    value: 'Leave a field empty to let the viewer fit the model itself.',
    contentKey: 'studio_help.models_settings_help',
  },
  'studio.models.settings.exposure': {
    value: 'Exposure',
    contentKey: 'studio_help.models_settings_exposure',
  },
  'studio.models.settings.lighting': {
    value: 'Lighting preset',
    contentKey: 'studio_help.models_settings_lighting',
  },
  'studio.models.settings.environment': {
    value: 'Environment preset',
    contentKey: 'studio_help.models_settings_environment',
  },
  'studio.models.settings.autoRotate': {
    value: 'Auto-rotate',
    contentKey: 'studio_help.models_settings_auto_rotate',
  },
  'studio.models.settings.autoRotateHelp': {
    value: 'Off under reduced motion regardless.',
    contentKey: 'studio_help.models_settings_auto_rotate_help',
  },
  'studio.models.settings.minDistance': {
    value: 'Closest distance',
    contentKey: 'studio_help.models_settings_min_distance',
  },
  'studio.models.settings.maxDistance': {
    value: 'Farthest distance',
    contentKey: 'studio_help.models_settings_max_distance',
  },
  'studio.models.settings.cameraPosition': {
    value: 'Camera position (x, y, z)',
    contentKey: 'studio_help.models_settings_camera_position',
  },
  'studio.models.settings.cameraTarget': {
    value: 'Camera target (x, y, z)',
    contentKey: 'studio_help.models_settings_camera_target',
  },
  'studio.models.settings.fov': {
    value: 'Field of view',
    contentKey: 'studio_help.models_settings_fov',
  },
  'studio.models.settings.invalid': {
    value: 'One of the settings is out of range.',
    contentKey: 'studio_help.models_settings_invalid',
  },
  'studio.models.preview.heading': {
    value: 'Preview',
    contentKey: 'studio_help.models_preview_heading',
  },
  'studio.models.preview.open': {
    value: 'Open preview',
    contentKey: 'studio_help.models_preview_open',
  },
  'studio.models.preview.help': {
    value: 'The live viewer, with the settings above. Change a value and it reloads.',
    contentKey: 'studio_help.models_preview_help',
  },
  'studio.models.labels.heading': {
    value: 'Finish labels',
    contentKey: 'studio_help.models_labels_heading',
  },
  'studio.models.labels.help': {
    value:
      "One label per finish the file declares. A label that names a material is a product fact: it needs the owner's verification before the material name reaches a visitor.",
    contentKey: 'studio_help.models_labels_help',
  },
  'studio.models.labels.none': {
    value: 'This model declares no finish variants.',
    contentKey: 'studio_help.models_labels_none',
  },
  'studio.models.labels.key': {
    value: 'Key in the file',
    contentKey: 'studio_help.models_labels_key',
  },
  'studio.models.labels.label': {
    value: 'Label',
    contentKey: 'studio_help.models_labels_label',
  },
  'studio.models.labels.material': {
    value: 'Material',
    contentKey: 'studio_help.models_labels_material',
  },
  'studio.models.labels.noMaterial': {
    value: '— none —',
    contentKey: 'studio_help.models_labels_no_material',
  },
  'studio.models.labels.verification': {
    value: 'Verification',
    contentKey: 'studio_help.models_labels_verification',
  },
  'studio.models.labels.verify.NOT_REQUIRED': {
    value: 'Not required',
    contentKey: 'studio_help.models_labels_verify_not_required',
  },
  'studio.models.labels.verify.OWNER_VERIFICATION_REQUIRED': {
    value: 'Awaiting the owner',
    contentKey: 'studio_help.models_labels_verify_required',
  },
  'studio.models.labels.verify.VERIFIED': {
    value: 'Verified by the owner',
    contentKey: 'studio_help.models_labels_verify_verified',
  },
  'studio.models.labels.materialNeedsVerification': {
    value: "A label with a material cannot be 'Not required'.",
    contentKey: 'studio_help.models_labels_material_needs_verification',
  },
  'studio.models.labels.verifyRefused': {
    value: 'Only the owner or an admin may mark a label verified.',
    contentKey: 'studio_help.models_labels_verify_refused',
  },
  'studio.models.association.heading': {
    value: 'Shown on',
    contentKey: 'studio_help.models_association_heading',
  },
  'studio.models.association.help': {
    value: 'A model appears on one product page or one project page. It needs a poster first.',
    contentKey: 'studio_help.models_association_help',
  },
  'studio.models.association.none': {
    value: 'Nowhere',
    contentKey: 'studio_help.models_association_none',
  },
  'studio.models.association.product': {
    value: 'A product',
    contentKey: 'studio_help.models_association_product',
  },
  'studio.models.association.project': {
    value: 'A project',
    contentKey: 'studio_help.models_association_project',
  },
  'studio.models.association.pick': {
    value: 'Choose',
    contentKey: 'studio_help.models_association_pick',
  },
  'studio.models.association.needsPoster': {
    value: 'Set a poster before showing this model on a page.',
    contentKey: 'studio_help.models_association_needs_poster',
  },
  'studio.models.association.productRefused': {
    value: 'Attaching a model to a product needs catalogue write access.',
    contentKey: 'studio_help.models_association_product_refused',
  },
  'studio.models.save': {
    value: 'Save',
    contentKey: 'studio_help.models_save',
  },
  'studio.models.saved': {
    value: 'Saved.',
    contentKey: 'studio_help.models_saved',
  },
  'studio.models.expired': {
    value: 'Your session has expired. Sign in again.',
    contentKey: 'studio_help.models_expired',
  },
  'studio.models.forbidden': {
    value: 'You do not have permission to do that.',
    contentKey: 'studio_help.models_forbidden',
  },
  'studio.models.failed': {
    value: 'That change could not be saved.',
    contentKey: 'studio_help.models_failed',
  },
  'studio.models.viewer.inspect': {
    value: 'Open in the viewer',
    contentKey: 'studio_help.models_viewer_inspect',
  },
  'studio.models.viewer.name': {
    value: '{{title}} in 3D',
    contentKey: 'studio_help.models_viewer_name',
  },
  'studio.models.viewer.description': {
    value:
      'Drag to orbit, scroll to zoom, drag with the right button to pan. Arrow keys orbit, Shift with arrows pans, plus and minus zoom, R resets, F fullscreen, M inspects the finish, D shows dimensions.',
    contentKey: 'studio_help.models_viewer_description',
  },
  'studio.models.viewer.loading': {
    value: 'Loading model, {{percent}}%',
    contentKey: 'studio_help.models_viewer_loading',
  },
  'studio.models.viewer.failed': {
    value: 'The model could not be loaded in the preview.',
    contentKey: 'studio_help.models_viewer_failed',
  },
  'studio.models.viewer.reset': {
    value: 'Reset view',
    contentKey: 'studio_help.models_viewer_reset',
  },
  'studio.models.viewer.fullscreen': {
    value: 'Fullscreen',
    contentKey: 'studio_help.models_viewer_fullscreen',
  },
  'studio.models.viewer.exitFullscreen': {
    value: 'Exit fullscreen',
    contentKey: 'studio_help.models_viewer_exit_fullscreen',
  },
  'studio.models.viewer.close': {
    value: 'Close preview',
    contentKey: 'studio_help.models_viewer_close',
  },
  'studio.models.viewer.materialToggle': {
    value: 'Inspect finish',
    contentKey: 'studio_help.models_viewer_material_toggle',
  },
  'studio.models.viewer.materialHeading': {
    value: 'Finish',
    contentKey: 'studio_help.models_viewer_material_heading',
  },
  'studio.models.viewer.variants': {
    value: 'Finish options',
    contentKey: 'studio_help.models_viewer_variants',
  },
  'studio.models.viewer.dimensionsToggle': {
    value: 'Show dimensions',
    contentKey: 'studio_help.models_viewer_dimensions_toggle',
  },
  'studio.models.viewer.dimensionsHeading': {
    value: 'Dimensions',
    contentKey: 'studio_help.models_viewer_dimensions_heading',
  },
  'studio.models.viewer.lighting': {
    value: 'Lighting',
    contentKey: 'studio_help.models_viewer_lighting',
  },
  'studio.models.viewer.environment': {
    value: 'Environment',
    contentKey: 'studio_help.models_viewer_environment',
  },
  'studio.models.viewer.lighting.studio-soft': {
    value: 'Studio, soft',
    contentKey: 'studio_help.models_viewer_lighting_studio_soft',
  },
  'studio.models.viewer.lighting.gallery-directional': {
    value: 'Gallery, directional',
    contentKey: 'studio_help.models_viewer_lighting_gallery_directional',
  },
  'studio.models.viewer.lighting.daylight-window': {
    value: 'Daylight from a window',
    contentKey: 'studio_help.models_viewer_lighting_daylight_window',
  },
  'studio.models.viewer.lighting.low-key': {
    value: 'Low key',
    contentKey: 'studio_help.models_viewer_lighting_low_key',
  },
  'studio.models.viewer.environment.neutral-room': {
    value: 'Neutral room',
    contentKey: 'studio_help.models_viewer_environment_neutral_room',
  },
  'studio.models.viewer.environment.dark-gallery': {
    value: 'Dark gallery',
    contentKey: 'studio_help.models_viewer_environment_dark_gallery',
  },
  'studio.models.viewer.environment.warm-interior': {
    value: 'Warm interior',
    contentKey: 'studio_help.models_viewer_environment_warm_interior',
  },
  'studio.models.viewer.conceptNotice': {
    value: 'Concept model — not a photograph of a delivered piece.',
    contentKey: 'studio_help.models_viewer_concept_notice',
  },
  // --- The Higgsfield tracker (Phase 07) ---------------------------------------------------------
  // The concept banner is the load-bearing string on this surface, not a caption. Every asset here
  // is `is_concept = true`: AI-generated art direction for a studio whose delivered work has not
  // been photographed. An owner who forgot that could send a client a render of a table that has
  // never been built, which is the precise class of fabricated business fact D10 exists to stop —
  // so the warning sits above the grid on every tab, and is not dismissible.
  'studio.higgsfield.conceptBanner': {
    value: 'Concept media. Never presented as completed, delivered Rivya work.',
    contentKey: 'studio_help.higgsfield_concept_banner',
  },

  'studio.higgsfield.tabInventory': {
    value: 'Inventory',
    contentKey: 'studio_help.higgsfield_tab_inventory',
  },
  'studio.higgsfield.tabFamilies': {
    value: 'Families',
    contentKey: 'studio_help.higgsfield_tab_families',
  },
  'studio.higgsfield.tabGaps': {
    value: 'Gaps',
    contentKey: 'studio_help.higgsfield_tab_gaps',
  },

  'studio.higgsfield.cardTotal': {
    value: 'In the manifest',
    contentKey: 'studio_help.higgsfield_card_total',
  },
  'studio.higgsfield.cardMigrated': {
    value: 'Migrated',
    contentKey: 'studio_help.higgsfield_card_migrated',
  },
  'studio.higgsfield.cardPending': {
    value: 'Not yet migrated',
    contentKey: 'studio_help.higgsfield_card_pending',
  },
  'studio.higgsfield.cardGaps': {
    value: 'Unfilled slots',
    contentKey: 'studio_help.higgsfield_card_gaps',
  },

  'studio.higgsfield.inventoryCaption': {
    value: 'Higgsfield assets',
    contentKey: 'studio_help.higgsfield_inventory_caption',
  },
  'studio.higgsfield.colAsset': {
    value: 'Asset ID',
    contentKey: 'studio_help.higgsfield_col_asset',
  },
  'studio.higgsfield.colFamily': {
    value: 'Family',
    contentKey: 'studio_help.higgsfield_col_family',
  },
  'studio.higgsfield.colPage': {
    value: 'Page',
    contentKey: 'studio_help.higgsfield_col_page',
  },
  'studio.higgsfield.colRatio': {
    value: 'Ratio',
    contentKey: 'studio_help.higgsfield_col_ratio',
  },
  'studio.higgsfield.colState': {
    value: 'State',
    contentKey: 'studio_help.higgsfield_col_state',
  },
  'studio.higgsfield.colCount': {
    value: 'Assets',
    contentKey: 'studio_help.higgsfield_col_count',
  },
  'studio.higgsfield.colSlot': {
    value: 'Slot',
    contentKey: 'studio_help.higgsfield_col_slot',
  },
  'studio.higgsfield.colNeeds': {
    value: 'What is needed',
    contentKey: 'studio_help.higgsfield_col_needs',
  },

  /** Shown against a manifest row that has no `media_assets` row yet. */
  'studio.higgsfield.stateUnmigrated': {
    value: 'Not migrated',
    contentKey: 'studio_help.higgsfield_state_unmigrated',
  },
  'studio.higgsfield.stateMigrated': {
    value: 'In the library',
    contentKey: 'studio_help.higgsfield_state_migrated',
  },

  'studio.higgsfield.familiesCaption': {
    value: 'Families in the manifest',
    contentKey: 'studio_help.higgsfield_families_caption',
  },
  'studio.higgsfield.gapsCaption': {
    value: 'Declared slots by page',
    contentKey: 'studio_help.higgsfield_gaps_caption',
  },

  /** The four slot states. Each renders its own word — colour is never the only signal. */
  'studio.higgsfield.slotFilled': {
    value: 'Filled',
    contentKey: 'studio_help.higgsfield_slot_filled',
  },
  'studio.higgsfield.slotCovered': {
    value: 'Coverable',
    contentKey: 'studio_help.higgsfield_slot_covered',
  },
  'studio.higgsfield.slotThin': {
    value: 'Thin',
    contentKey: 'studio_help.higgsfield_slot_thin',
  },
  'studio.higgsfield.slotGap': {
    value: 'Gap',
    contentKey: 'studio_help.higgsfield_slot_gap',
  },

  /** Why a gap exists, and what closing it would mean. The two are not interchangeable. */
  'studio.higgsfield.needsGeneration': {
    value: 'Nothing in the library fits. Needs a new generation.',
    contentKey: 'studio_help.higgsfield_needs_generation',
  },
  'studio.higgsfield.needsEmptyState': {
    value: 'Deliberately empty until the owner confirms real work. Never generated.',
    contentKey: 'studio_help.higgsfield_needs_empty_state',
  },
  'studio.higgsfield.needsThin': {
    value: 'Too few assets to fill this surface without repeating one.',
    contentKey: 'studio_help.higgsfield_needs_thin',
  },
  'studio.higgsfield.needsBinding': {
    value: 'Assets exist. Nothing is bound to this slot yet.',
    contentKey: 'studio_help.higgsfield_needs_binding',
  },
  'studio.higgsfield.needsNothing': {
    value: 'Bound.',
    contentKey: 'studio_help.higgsfield_needs_nothing',
  },
  'studio.higgsfield.missingRatios': {
    value: 'No candidate is natively',
    contentKey: 'studio_help.higgsfield_missing_ratios',
  },

  'studio.higgsfield.orphanHeading': {
    value: 'Families no slot uses',
    contentKey: 'studio_help.higgsfield_orphan_heading',
  },
  'studio.higgsfield.orphanBody': {
    value: 'These assets are in the library and no declared surface shows them.',
    contentKey: 'studio_help.higgsfield_orphan_body',
  },

  'studio.higgsfield.emptyHeading': {
    value: 'The manifest is empty',
    contentKey: 'studio_help.higgsfield_empty_heading',
  },
  'studio.higgsfield.emptyBody': {
    value: 'Rebuild it with the manifest script, then reload this page.',
    contentKey: 'studio_help.higgsfield_empty_body',
  },

  // FEAT §34's inventory columns. "Product" and "Collection" from §34 are not here: no Higgsfield
  // asset is bound to either until Phase 09, and two permanently blank columns would be worse than
  // the Family/Section substitution PHASE-05-09 §07 makes in their place.
  'studio.higgsfield.colType': {
    value: 'Type',
    contentKey: 'studio_help.higgsfield_col_type',
  },
  'studio.higgsfield.colSection': {
    value: 'Section',
    contentKey: 'studio_help.higgsfield_col_section',
  },
  'studio.higgsfield.colPurpose': {
    value: 'Purpose',
    contentKey: 'studio_help.higgsfield_col_purpose',
  },
  'studio.higgsfield.colSource': {
    value: 'Source',
    contentKey: 'studio_help.higgsfield_col_source',
  },
  'studio.higgsfield.colModel': {
    value: 'Model',
    contentKey: 'studio_help.higgsfield_col_model',
  },
  'studio.higgsfield.colPrompt': {
    value: 'Prompt',
    contentKey: 'studio_help.higgsfield_col_prompt',
  },
  'studio.higgsfield.colUsed': {
    value: 'Used',
    contentKey: 'studio_help.higgsfield_col_used',
  },
  'studio.higgsfield.colLocation': {
    value: 'Cloudinary location',
    contentKey: 'studio_help.higgsfield_col_location',
  },
  'studio.higgsfield.colPlacement': {
    value: 'CMS placement',
    contentKey: 'studio_help.higgsfield_col_placement',
  },

  'studio.higgsfield.typeImage': {
    value: 'Image',
    contentKey: 'studio_help.higgsfield_type_image',
  },
  'studio.higgsfield.typeVideo': {
    value: 'Video',
    contentKey: 'studio_help.higgsfield_type_video',
  },
  'studio.higgsfield.usedYes': {
    value: 'Yes',
    contentKey: 'studio_help.higgsfield_used_yes',
  },
  'studio.higgsfield.usedNo': {
    value: 'No',
    contentKey: 'studio_help.higgsfield_used_no',
  },
  /** Said plainly rather than left blank: a blank cell reads as missing data, not as a finding. */
  'studio.higgsfield.purposeNone': {
    value: 'Unclassified family',
    contentKey: 'studio_help.higgsfield_purpose_none',
  },
  'studio.higgsfield.placementNone': {
    value: 'Not placed',
    contentKey: 'studio_help.higgsfield_placement_none',
  },

  'studio.higgsfield.filterLabel': {
    value: 'Filter the inventory',
    contentKey: 'studio_help.higgsfield_filter_label',
  },
  'studio.higgsfield.filterApply': {
    value: 'Apply filters',
    contentKey: 'studio_help.higgsfield_filter_apply',
  },
  'studio.higgsfield.filterAll': {
    value: 'All',
    contentKey: 'studio_help.higgsfield_filter_all',
  },
  'studio.higgsfield.filterActive': {
    value: 'Filters applied:',
    contentKey: 'studio_help.higgsfield_filter_active',
  },
  'studio.higgsfield.filterType': {
    value: 'Type',
    contentKey: 'studio_help.higgsfield_filter_type',
  },
  'studio.higgsfield.filteredHeading': {
    value: 'No assets match these filters',
    contentKey: 'studio_help.higgsfield_filtered_heading',
  },
  'studio.higgsfield.filteredBody': {
    value: 'Clear a filter to see more of the library.',
    contentKey: 'studio_help.higgsfield_filtered_body',
  },

  /** The Gaps tab's one action. It copies markdown; it never edits the plan — see CopyBriefButton. */
  'studio.higgsfield.copyBrief': {
    value: 'Copy brief to master plan',
    contentKey: 'studio_help.higgsfield_copy_brief',
  },
  'studio.higgsfield.copyBriefDone': {
    value: 'Copied. Paste it into HIGGSFIELD_MASTER_ASSET_PLAN.md §6.1.',
    contentKey: 'studio_help.higgsfield_copy_brief_done',
  },
  'studio.higgsfield.copyBriefFailed': {
    value: 'Could not copy. Nothing was placed on the clipboard.',
    contentKey: 'studio_help.higgsfield_copy_brief_failed',
  },

  // --- The asset drawer -------------------------------------------------------------------------
  // There is deliberately NO regenerate control here, and `scripts/media/assert-no-regeneration.ts`
  // keeps it that way. An asset in the manifest already exists; re-generating it spends credits to
  // replace something with a different picture, orphans the ledger entry keyed on the old
  // generation id, and breaks any CMS binding that pointed at it.
  'studio.higgsfield.drawerClose': {
    value: 'Close',
    contentKey: 'studio_help.higgsfield_drawer_close',
  },
  'studio.higgsfield.drawerPrompt': {
    value: 'Generation prompt',
    contentKey: 'studio_help.higgsfield_drawer_prompt',
  },
  'studio.higgsfield.drawerAlt': {
    value: 'Draft alt text',
    contentKey: 'studio_help.higgsfield_drawer_alt',
  },
  'studio.higgsfield.drawerModel': {
    value: 'Model',
    contentKey: 'studio_help.higgsfield_drawer_model',
  },
  'studio.higgsfield.drawerGenerationId': {
    value: 'Generation ID',
    contentKey: 'studio_help.higgsfield_drawer_generation_id',
  },
  'studio.higgsfield.drawerPublicId': {
    value: 'Cloudinary public ID',
    contentKey: 'studio_help.higgsfield_drawer_public_id',
  },
  'studio.higgsfield.drawerDimensions': {
    value: 'Requested dimensions',
    contentKey: 'studio_help.higgsfield_drawer_dimensions',
  },
  /** Why the drawer says "requested". See `toMediaAssetRow` — Cloudinary is authoritative for the
   *  stored file, and the manifest records what was asked for, which differs on several videos. */
  'studio.higgsfield.drawerDimensionsHelp': {
    value: 'What the generation was asked for. The stored file may differ.',
    contentKey: 'studio_help.higgsfield_drawer_dimensions_help',
  },
  // -------------------------------------------------------------------------------------------
  // Phase 08 — the content editor.
  //
  // EVERY ONE OF THESE IS INTERFACE MECHANICS, not marketing copy: labels, column headings, the
  // wording of a refusal. None asserts a business fact, so none is seeded
  // `OWNER_VERIFICATION_REQUIRED`. The public section renderers get their strings from
  // `global_content` instead (`lib/cms/strings.ts`) and ship no fallbacks at all — Studio chrome
  // has to render before any content exists, and the public site has no such excuse.
  // -------------------------------------------------------------------------------------------
  'studio.content.pages.title': {
    value: 'Pages',
    contentKey: 'studio_help.content_pages_title',
  },
  'studio.content.pages.description': {
    value: 'Every page on the site, and the blocks each one is built from.',
    contentKey: 'studio_help.content_pages_description',
  },
  'studio.content.pages.emptyHeading': {
    value: 'No pages yet',
    contentKey: 'studio_help.content_pages_empty_heading',
  },
  'studio.content.pages.emptyBody': {
    value: 'Pages arrive with the content seed. Run it, or add one here.',
    contentKey: 'studio_help.content_pages_empty_body',
  },
  'studio.content.pages.colPath': {
    value: 'Path',
    contentKey: 'studio_help.content_pages_col_path',
  },
  'studio.content.pages.colTitle': {
    value: 'Title',
    contentKey: 'studio_help.content_pages_col_title',
  },
  'studio.content.pages.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.content_pages_col_status',
  },
  'studio.content.pages.colKind': {
    value: 'Kind',
    contentKey: 'studio_help.content_pages_col_kind',
  },
  'studio.content.pages.colUpdated': {
    value: 'Updated',
    contentKey: 'studio_help.content_pages_col_updated',
  },
  'studio.content.pages.caption': {
    value: 'Pages, with their status and address.',
    contentKey: 'studio_help.content_pages_caption',
  },
  'studio.content.pages.systemPath': {
    value: 'No public address',
    contentKey: 'studio_help.content_pages_system_path',
  },
  'studio.content.navigation.caption': {
    value: 'Menu items, with the address each one resolves to.',
    contentKey: 'studio_help.content_navigation_caption',
  },
  'studio.content.navigation.emptyHeading': {
    value: 'No menu items yet',
    contentKey: 'studio_help.content_navigation_empty_heading',
  },
  'studio.content.navigation.emptyBody': {
    value: 'The header, mobile and footer menus are seeded by the content seed.',
    contentKey: 'studio_help.content_navigation_empty_body',
  },
  'studio.content.navigation.colMenu': {
    value: 'Menu',
    contentKey: 'studio_help.content_navigation_col_menu',
  },
  'studio.content.navigation.colLabel': {
    value: 'Label',
    contentKey: 'studio_help.content_navigation_col_label',
  },
  'studio.content.navigation.colHref': {
    value: 'Address',
    contentKey: 'studio_help.content_navigation_col_href',
  },
  'studio.content.navigation.colResolves': {
    value: 'Resolves',
    contentKey: 'studio_help.content_navigation_col_resolves',
  },
  'studio.content.navigation.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.content_navigation_col_status',
  },
  'studio.content.navigation.resolved': {
    value: 'Yes',
    contentKey: 'studio_help.content_navigation_resolved',
  },
  'studio.content.navigation.unknown': {
    value: 'No route',
    contentKey: 'studio_help.content_navigation_unknown',
  },
  'studio.content.navigation.external': {
    value: 'External',
    contentKey: 'studio_help.content_navigation_external',
  },
  'studio.content.navigation.heading': {
    value: 'Heading only',
    contentKey: 'studio_help.content_navigation_heading',
  },
  'studio.content.navigation.hidden': {
    value: 'Hidden',
    contentKey: 'studio_help.content_navigation_hidden',
  },
  'studio.content.pages.colOnSite': {
    value: 'On site',
    contentKey: 'studio_help.content_pages_col_on_site',
  },
  'studio.content.pages.viewLive': {
    value: 'View',
    contentKey: 'studio_help.content_pages_view_live',
  },
  'studio.content.pages.viewDraft': {
    value: 'Preview draft',
    contentKey: 'studio_help.content_pages_view_draft',
  },
  'studio.content.page.backLabel': {
    value: 'All pages',
    contentKey: 'studio_help.content_page_back_label',
  },
  'studio.content.page.previewLabel': {
    value: 'Preview',
    contentKey: 'studio_help.content_page_preview_label',
  },
  'studio.content.page.sectionsHeading': {
    value: 'Sections',
    contentKey: 'studio_help.content_page_sections_heading',
  },
  'studio.content.page.emptyHeading': {
    value: 'This page has no blocks yet',
    contentKey: 'studio_help.content_page_empty_heading',
  },
  'studio.content.page.emptyBody': {
    value: 'Add a block to start building the page.',
    contentKey: 'studio_help.content_page_empty_body',
  },
  'studio.content.page.addLabel': {
    value: 'Add a block',
    contentKey: 'studio_help.content_page_add_label',
  },
  'studio.content.page.addHeading': {
    value: 'Which block?',
    contentKey: 'studio_help.content_page_add_heading',
  },
  'studio.content.page.plannedHeading': {
    value: 'Not built yet',
    contentKey: 'studio_help.content_page_planned_heading',
  },
  'studio.content.page.plannedBody': {
    value: 'These blocks are in the catalogue but have no renderer, so they cannot be added.',
    contentKey: 'studio_help.content_page_planned_body',
  },
  'studio.content.section.editLabel': {
    value: 'Edit',
    contentKey: 'studio_help.content_section_edit_label',
  },
  'studio.content.section.deleteLabel': {
    value: 'Remove',
    contentKey: 'studio_help.content_section_delete_label',
  },
  'studio.content.section.deleteConfirmTitle': {
    value: 'Remove this block?',
    contentKey: 'studio_help.content_section_delete_confirm_title',
  },
  'studio.content.section.deleteConfirmBody': {
    value:
      'The block and its copy come off the page. Its history is kept, but the block is not put back by restoring it.',
    contentKey: 'studio_help.content_section_delete_confirm_body',
  },
  'studio.content.section.moveUpLabel': {
    value: 'Move up',
    contentKey: 'studio_help.content_section_move_up_label',
  },
  'studio.content.section.moveDownLabel': {
    value: 'Move down',
    contentKey: 'studio_help.content_section_move_down_label',
  },
  'studio.content.section.hiddenLabel': {
    value: 'Hidden',
    contentKey: 'studio_help.content_section_hidden_label',
  },
  'studio.content.section.noRenderer': {
    value: 'No renderer in this build — the public site skips this block.',
    contentKey: 'studio_help.content_section_no_renderer',
  },
  'studio.content.section.saveLabel': {
    value: 'Save',
    contentKey: 'studio_help.content_section_save_label',
  },
  'studio.content.section.cancelLabel': {
    value: 'Cancel',
    contentKey: 'studio_help.content_section_cancel_label',
  },
  'studio.content.section.closeLabel': {
    value: 'Close',
    contentKey: 'studio_help.content_section_close_label',
  },
  'studio.content.section.copyHeading': {
    value: 'Copy',
    contentKey: 'studio_help.content_section_copy_heading',
  },
  'studio.content.section.mediaHeading': {
    value: 'Media',
    contentKey: 'studio_help.content_section_media_heading',
  },
  'studio.content.section.blockHeading': {
    value: 'Block settings',
    contentKey: 'studio_help.content_section_block_heading',
  },
  'studio.content.section.scheduleHeading': {
    value: 'Visibility and schedule',
    contentKey: 'studio_help.content_section_schedule_heading',
  },
  'studio.content.section.provenanceHeading': {
    value: 'Provenance',
    contentKey: 'studio_help.content_section_provenance_heading',
  },
  'studio.content.section.visibleLabel': {
    value: 'Show this block',
    contentKey: 'studio_help.content_section_visible_label',
  },
  'studio.content.section.themeLabel': {
    value: 'Theme',
    contentKey: 'studio_help.content_section_theme_label',
  },
  'studio.content.section.themeInherit': {
    value: 'Page default',
    contentKey: 'studio_help.content_section_theme_inherit',
  },
  'studio.content.section.layoutLabel': {
    value: 'Layout',
    contentKey: 'studio_help.content_section_layout_label',
  },
  'studio.content.section.publishAtLabel': {
    value: 'Publish at',
    contentKey: 'studio_help.content_section_publish_at_label',
  },
  'studio.content.section.unpublishAtLabel': {
    value: 'Remove at',
    contentKey: 'studio_help.content_section_unpublish_at_label',
  },
  'studio.content.section.scheduleHelp': {
    value:
      'Times are UTC. A section stops rendering the moment its removal time passes, whatever its status says.',
    contentKey: 'studio_help.content_section_schedule_help',
  },
  'studio.content.section.factLabel': {
    value: 'What kind of claim is this?',
    contentKey: 'studio_help.content_section_fact_label',
  },
  'studio.content.section.verificationLabel': {
    value: 'Owner verification',
    contentKey: 'studio_help.content_section_verification_label',
  },
  'studio.content.section.verificationBannerTitle': {
    value: 'The owner has to confirm this claim before it can be published:',
    contentKey: 'studio_help.content_section_verification_banner_title',
  },
  'studio.content.section.verificationHelp': {
    value:
      'A block asserting an unverified business claim cannot be published until the owner confirms it.',
    contentKey: 'studio_help.content_section_verification_help',
  },
  'studio.content.section.slotKeyLabel': {
    value: 'Media slot',
    contentKey: 'studio_help.content_section_slot_key_label',
  },
  'studio.content.section.slotKeyHelp': {
    value:
      'Required whenever an image is chosen: the approval and verification checks find the binding through it.',
    contentKey: 'studio_help.content_section_slot_key_help',
  },
  'studio.content.section.altOverrideLabel': {
    value: 'Alt text for this placement',
    contentKey: 'studio_help.content_section_alt_override_label',
  },
  'studio.content.section.altOverrideHelp': {
    value: "Leave blank to use the asset's own description.",
    contentKey: 'studio_help.content_section_alt_override_help',
  },
  'studio.content.section.desktopLabel': {
    value: 'Desktop image',
    contentKey: 'studio_help.content_section_desktop_label',
  },
  'studio.content.section.mobileLabel': {
    value: 'Mobile image',
    contentKey: 'studio_help.content_section_mobile_label',
  },
  'studio.content.section.statusHeading': {
    value: 'Status',
    contentKey: 'studio_help.content_section_status_heading',
  },
  'studio.content.section.revisionsHeading': {
    value: 'History',
    contentKey: 'studio_help.content_section_revisions_heading',
  },
  'studio.content.section.restoreLabel': {
    value: 'Restore',
    contentKey: 'studio_help.content_section_restore_label',
  },
  'studio.content.section.noRevisions': {
    value: 'No history yet.',
    contentKey: 'studio_help.content_section_no_revisions',
  },
  'studio.content.section.scheduleBlocked': {
    value:
      "This block's scheduled publish was refused and has stopped retrying. Edit it to try again.",
    contentKey: 'studio_help.content_section_schedule_blocked',
  },
  'studio.content.media.chooseLabel': {
    value: 'Choose',
    contentKey: 'studio_help.content_media_choose_label',
  },
  'studio.content.media.clearLabel': {
    value: 'Clear',
    contentKey: 'studio_help.content_media_clear_label',
  },
  'studio.content.media.pickerHeading': {
    value: 'Choose an image',
    contentKey: 'studio_help.content_media_picker_heading',
  },
  'studio.content.media.searchLabel': {
    value: 'Search',
    contentKey: 'studio_help.content_media_search_label',
  },
  'studio.content.media.noneChosen': {
    value: 'No image chosen',
    contentKey: 'studio_help.content_media_none_chosen',
  },
  'studio.content.media.emptyHeading': {
    value: 'No assets match',
    contentKey: 'studio_help.content_media_empty_heading',
  },
  'studio.content.media.emptyBody': {
    value: 'Try a different search, or upload one in the Media Manager.',
    contentKey: 'studio_help.content_media_empty_body',
  },
  'studio.content.media.unapprovedNote': {
    value: 'Not approved — a section bound to it cannot be published.',
    contentKey: 'studio_help.content_media_unapproved_note',
  },
  'studio.content.media.unverifiedNote': {
    value: 'Awaiting owner verification — a section bound to it cannot be published.',
    contentKey: 'studio_help.content_media_unverified_note',
  },

  /** DESIGN_SYSTEM §7.4 marks a required field with the word, never an asterisk alone. */
  'studio.catalog.requiredLabel': {
    value: 'Required',
    contentKey: 'studio_help.catalog_required_label',
  },
  // --- Phase 14: the catalogue editor ---------------------------------------------------------
  //
  // These are interface mechanics — column headers, field labels, the words on two buttons — and
  // none of them asserts a business fact. The two that come closest are deliberately worded as
  // warnings rather than claims: the availability help text says what "Ready Stock" WOULD assert,
  // and the hero-image help says what the database will refuse.
  'studio.catalog.products.caption': {
    value: 'Products, with their status and what is still missing.',
    contentKey: 'studio_help.catalog_products_caption',
  },
  'studio.catalog.products.emptyHeading': {
    value: 'No products yet',
    contentKey: 'studio_help.catalog_products_empty_heading',
  },
  'studio.catalog.products.emptyBody': {
    value:
      'A product exists because someone typed it in. Nothing is seeded, and nothing is imported.',
    contentKey: 'studio_help.catalog_products_empty_body',
  },
  'studio.catalog.products.colTitle': {
    value: 'Title',
    contentKey: 'studio_help.catalog_products_col_title',
  },
  'studio.catalog.products.colSku': {
    value: 'SKU',
    contentKey: 'studio_help.catalog_products_col_sku',
  },
  'studio.catalog.products.colCategory': {
    value: 'Category',
    contentKey: 'studio_help.catalog_products_col_category',
  },
  'studio.catalog.products.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.catalog_products_col_status',
  },
  'studio.catalog.products.colReadiness': {
    value: 'Not ready',
    contentKey: 'studio_help.catalog_products_col_readiness',
  },
  'studio.catalog.products.colUpdated': {
    value: 'Updated',
    contentKey: 'studio_help.catalog_products_col_updated',
  },
  'studio.catalog.products.readyToPublish': {
    value: 'Ready',
    contentKey: 'studio_help.catalog_products_ready',
  },
  'studio.catalog.products.untitled': {
    value: 'Untitled',
    contentKey: 'studio_help.catalog_products_untitled',
  },
  'studio.catalog.products.noCategory': {
    value: 'No category',
    contentKey: 'studio_help.catalog_products_no_category',
  },
  'studio.catalog.products.noSku': {
    value: 'No SKU',
    contentKey: 'studio_help.catalog_products_no_sku',
  },
  'studio.catalog.products.newHeading': {
    value: 'New product',
    contentKey: 'studio_help.catalog_products_new_heading',
  },
  'studio.catalog.products.searchLabel': {
    value: 'Search title or slug',
    contentKey: 'studio_help.catalog_products_search_label',
  },
  'studio.catalog.products.searchSubmit': {
    value: 'Search',
    contentKey: 'studio_help.catalog_products_search_submit',
  },
  // --- Phase 15: the four product tabs -----------------------------------------------------------
  //
  // EVERY HELPER SENTENCE HERE IS A RULE THE DATABASE ALSO ENFORCES, said in words an editor can act
  // on. The specification tab's helper is the one that carries weight: "Leave a field blank to omit
  // the row" is what makes the no-placeholder rule usable rather than merely strict, because an
  // editor who cannot express "I do not know this" will write something that looks like knowing.
  'studio.catalog.product.tabs.overview': {
    value: 'Overview',
    contentKey: 'studio_help.catalog_product_tab_overview',
  },
  'studio.catalog.product.tabs.media': {
    value: 'Media',
    contentKey: 'studio_help.catalog_product_tab_media',
  },
  'studio.catalog.product.tabs.materials': {
    value: 'Materials',
    contentKey: 'studio_help.catalog_product_tab_materials',
  },
  'studio.catalog.product.tabs.specifications': {
    value: 'Specifications',
    contentKey: 'studio_help.catalog_product_tab_specifications',
  },
  'studio.catalog.product.tabs.related': {
    value: 'Related',
    contentKey: 'studio_help.catalog_product_tab_related',
  },
  'studio.catalog.product.tabs.label': {
    value: 'Product sections',
    contentKey: 'studio_help.catalog_product_tabs_label',
  },

  'studio.catalog.product.media.heading': {
    value: 'Media',
    contentKey: 'studio_help.catalog_product_media_heading',
  },
  'studio.catalog.product.media.help': {
    value:
      'Attach the photographs of this piece and give each one a role. The first gallery image is what a visitor sees after the hero. Concept renders cannot be attached to a product.',
    contentKey: 'studio_help.catalog_product_media_help',
  },
  'studio.catalog.product.media.roleLabel': {
    value: 'Role',
    contentKey: 'studio_help.catalog_product_media_role_label',
  },
  'studio.catalog.product.media.orderLabel': {
    value: 'Position',
    contentKey: 'studio_help.catalog_product_media_order_label',
  },
  'studio.catalog.product.media.attachLabel': {
    value: 'Attach an image or video',
    contentKey: 'studio_help.catalog_product_media_attach_label',
  },
  'studio.catalog.product.media.detachLabel': {
    value: 'Remove from this product',
    contentKey: 'studio_help.catalog_product_media_detach_label',
  },
  'studio.catalog.product.media.empty': {
    value: 'No media attached yet.',
    contentKey: 'studio_help.catalog_product_media_empty',
  },
  'studio.catalog.product.media.conceptExcluded': {
    value:
      'Concept renders are not listed here. They may illustrate a material or a process, never a product.',
    contentKey: 'studio_help.catalog_product_media_concept_excluded',
  },

  'studio.catalog.product.materials.heading': {
    value: 'Materials',
    contentKey: 'studio_help.catalog_product_materials_heading',
  },
  'studio.catalog.product.materials.help': {
    value:
      'Attach the materials this piece is made from. The note is optional and describes how the material is used here — leave it blank if there is nothing to add.',
    contentKey: 'studio_help.catalog_product_materials_help',
  },
  'studio.catalog.product.materials.noteLabel': {
    value: 'Note (optional)',
    contentKey: 'studio_help.catalog_product_materials_note_label',
  },
  'studio.catalog.product.materials.empty': {
    value: 'No materials attached yet.',
    contentKey: 'studio_help.catalog_product_materials_empty',
  },

  'studio.catalog.product.specs.heading': {
    value: 'Specifications',
    contentKey: 'studio_help.catalog_product_specs_heading',
  },
  'studio.catalog.product.specs.help': {
    value:
      'Only what you have measured. Nothing here is converted, rounded or filled in for you, and a blank field means the row is not shown at all — there is no dash and no "contact us" placeholder.',
    contentKey: 'studio_help.catalog_product_specs_help',
  },
  'studio.catalog.product.specs.omitHelp': {
    value:
      'Leave a field blank to omit the row. If this piece publishes no specifications at all, say so below rather than entering an estimate.',
    contentKey: 'studio_help.catalog_product_specs_omit_help',
  },
  'studio.catalog.product.specs.labelLabel': {
    value: 'Label',
    contentKey: 'studio_help.catalog_product_specs_label_label',
  },
  'studio.catalog.product.specs.valueLabel': {
    value: 'Value',
    contentKey: 'studio_help.catalog_product_specs_value_label',
  },
  'studio.catalog.product.specs.unitLabel': {
    value: 'Unit (optional)',
    contentKey: 'studio_help.catalog_product_specs_unit_label',
  },
  'studio.catalog.product.specs.groupLabel': {
    value: 'Group (optional)',
    contentKey: 'studio_help.catalog_product_specs_group_label',
  },
  'studio.catalog.product.specs.orderLabel': {
    value: 'Position',
    contentKey: 'studio_help.catalog_product_specs_order_label',
  },
  'studio.catalog.product.specs.addLabel': {
    value: 'Add a specification',
    contentKey: 'studio_help.catalog_product_specs_add_label',
  },
  'studio.catalog.product.specs.deleteLabel': {
    value: 'Delete this row',
    contentKey: 'studio_help.catalog_product_specs_delete_label',
  },
  'studio.catalog.product.specs.empty': {
    value: 'No specifications entered. The block will not appear on the product page.',
    contentKey: 'studio_help.catalog_product_specs_empty',
  },
  'studio.catalog.product.specs.omitLabel': {
    value: 'This piece publishes no specifications',
    contentKey: 'studio_help.catalog_product_specs_omit_label',
  },
  'studio.catalog.product.specs.omitSubmit': {
    value: 'Save this decision',
    contentKey: 'studio_help.catalog_product_specs_omit_submit',
  },
  'studio.catalog.product.specs.dimensionsHeading': {
    value: 'Dimensions',
    contentKey: 'studio_help.catalog_product_specs_dimensions_heading',
  },
  'studio.catalog.product.specs.dimensionsHelp': {
    value:
      'Entered on the Overview tab and shown on the product page in the unit each field names. No conversion is performed.',
    contentKey: 'studio_help.catalog_product_specs_dimensions_help',
  },

  'studio.catalog.product.related.heading': {
    value: 'Related',
    contentKey: 'studio_help.catalog_product_related_heading',
  },
  'studio.catalog.product.related.help': {
    value:
      'Relations are made by hand and shown as "Related". A product with none falls back to other pieces in the same category, under its own heading — never as a claim that they are related.',
    contentKey: 'studio_help.catalog_product_related_help',
  },
  'studio.catalog.product.related.targetTypeLabel': {
    value: 'Points at',
    contentKey: 'studio_help.catalog_product_related_target_type_label',
  },
  'studio.catalog.product.related.targetLabel': {
    value: 'Target',
    contentKey: 'studio_help.catalog_product_related_target_label',
  },
  'studio.catalog.product.related.relationTypeLabel': {
    value: 'Relation',
    contentKey: 'studio_help.catalog_product_related_relation_type_label',
  },
  'studio.catalog.product.related.orderLabel': {
    value: 'Position',
    contentKey: 'studio_help.catalog_product_related_order_label',
  },
  'studio.catalog.product.related.addLabel': {
    value: 'Add a relation',
    contentKey: 'studio_help.catalog_product_related_add_label',
  },
  'studio.catalog.product.related.deleteLabel': {
    value: 'Remove this relation',
    contentKey: 'studio_help.catalog_product_related_delete_label',
  },
  'studio.catalog.product.related.empty': {
    value: 'No relations created. The product page will show other pieces in the same category.',
    contentKey: 'studio_help.catalog_product_related_empty',
  },

  'studio.catalog.product.identityHeading': {
    value: 'Identity',
    contentKey: 'studio_help.catalog_product_identity_heading',
  },
  'studio.catalog.product.copyHeading': {
    value: 'Copy',
    contentKey: 'studio_help.catalog_product_copy_heading',
  },
  'studio.catalog.product.commerceHeading': {
    value: 'Price and edition',
    contentKey: 'studio_help.catalog_product_commerce_heading',
  },
  'studio.catalog.product.specificationHeading': {
    value: 'Specification',
    contentKey: 'studio_help.catalog_product_specification_heading',
  },
  'studio.catalog.product.seoHeading': {
    value: 'Search and social',
    contentKey: 'studio_help.catalog_product_seo_heading',
  },
  'studio.catalog.product.slug': {
    value: 'Slug',
    contentKey: 'studio_help.catalog_product_slug',
  },
  'studio.catalog.product.slugHelp': {
    value: 'The address this product will live at. Lowercase letters, numbers and single hyphens.',
    contentKey: 'studio_help.catalog_product_slug_help',
  },
  'studio.catalog.product.sku': {
    value: 'SKU',
    contentKey: 'studio_help.catalog_product_sku',
  },
  'studio.catalog.product.title': {
    value: 'Title',
    contentKey: 'studio_help.catalog_product_title',
  },
  'studio.catalog.product.subtitle': {
    value: 'Subtitle',
    contentKey: 'studio_help.catalog_product_subtitle',
  },
  'studio.catalog.product.summary': {
    value: 'Summary',
    contentKey: 'studio_help.catalog_product_summary',
  },
  'studio.catalog.product.description': {
    value: 'Description',
    contentKey: 'studio_help.catalog_product_description',
  },
  'studio.catalog.product.category': {
    value: 'Category',
    contentKey: 'studio_help.catalog_product_category',
  },
  'studio.catalog.product.priceState': {
    value: 'Price state',
    contentKey: 'studio_help.catalog_product_price_state',
  },
  'studio.catalog.product.priceStateHelp': {
    value: 'A quote-only piece carries no amount and no currency — not even zero.',
    contentKey: 'studio_help.catalog_product_price_state_help',
  },
  'studio.catalog.product.priceMajor': {
    value: 'Price',
    contentKey: 'studio_help.catalog_product_price_major',
  },
  'studio.catalog.product.priceFromMajor': {
    value: 'Price from',
    contentKey: 'studio_help.catalog_product_price_from_major',
  },
  'studio.catalog.product.amountHelp': {
    value: 'In whole currency units, as a customer would read it.',
    contentKey: 'studio_help.catalog_product_amount_help',
  },
  'studio.catalog.product.currency': {
    value: 'Currency',
    contentKey: 'studio_help.catalog_product_currency',
  },
  'studio.catalog.product.currencyHelp': {
    value: 'A three-letter ISO code, such as INR.',
    contentKey: 'studio_help.catalog_product_currency_help',
  },
  'studio.catalog.product.availability': {
    value: 'Availability',
    contentKey: 'studio_help.catalog_product_availability',
  },
  'studio.catalog.product.availabilityHelp': {
    value: 'Ready Stock asserts that a piece exists now. Leave it unset until that is true.',
    contentKey: 'studio_help.catalog_product_availability_help',
  },
  'studio.catalog.product.edition': {
    value: 'Edition',
    contentKey: 'studio_help.catalog_product_edition',
  },
  'studio.catalog.product.editionSize': {
    value: 'Edition size',
    contentKey: 'studio_help.catalog_product_edition_size',
  },
  'studio.catalog.product.editionSizeHelp': {
    value: 'Required for a limited edition, and refused for any other edition state.',
    contentKey: 'studio_help.catalog_product_edition_size_help',
  },
  'studio.catalog.product.customizable': {
    value: 'This piece can be customised',
    contentKey: 'studio_help.catalog_product_customizable',
  },
  'studio.catalog.product.largeFormat': {
    value: 'Large format',
    contentKey: 'studio_help.catalog_product_large_format',
  },
  'studio.catalog.product.sortOrder': {
    value: 'Order position',
    contentKey: 'studio_help.catalog_product_sort_order',
  },
  'studio.catalog.product.sortOrderHelp': {
    value:
      'Lower numbers come first in the curated order. Leave it empty to fall in behind the placed pieces.',
    contentKey: 'studio_help.catalog_product_sort_order_help',
  },
  'studio.catalog.product.heroMedia': {
    value: 'Hero image',
    contentKey: 'studio_help.catalog_product_hero_media',
  },
  'studio.catalog.product.heroMediaHelp': {
    value: 'Real Rivya media only. Concept imagery is refused — by this form and by the database.',
    contentKey: 'studio_help.catalog_product_hero_media_help',
  },
  'studio.catalog.product.materials': {
    value: 'Materials',
    contentKey: 'studio_help.catalog_product_materials',
  },
  'studio.catalog.product.materialsEmpty': {
    value: 'No materials exist yet. Add them under Materials.',
    contentKey: 'studio_help.catalog_product_materials_empty',
  },
  'studio.catalog.product.dimensions': {
    value: 'Dimensions',
    contentKey: 'studio_help.catalog_product_dimensions',
  },
  'studio.catalog.product.dimensionsHelp': {
    value:
      'Millimetres, except weight in grams and seats as a count. Leave a measurement empty if it does not apply.',
    contentKey: 'studio_help.catalog_product_dimensions_help',
  },
  'studio.catalog.product.seoTitle': {
    value: 'Search title',
    contentKey: 'studio_help.catalog_product_seo_title',
  },
  'studio.catalog.product.seoDescription': {
    value: 'Search description',
    contentKey: 'studio_help.catalog_product_seo_description',
  },
  'studio.catalog.product.save': {
    value: 'Save',
    contentKey: 'studio_help.catalog_product_save',
  },
  'studio.catalog.product.create': {
    value: 'Create product',
    contentKey: 'studio_help.catalog_product_create',
  },
  'studio.catalog.product.publish': {
    value: 'Publish',
    contentKey: 'studio_help.catalog_product_publish',
  },
  'studio.catalog.product.unpublish': {
    value: 'Unpublish',
    contentKey: 'studio_help.catalog_product_unpublish',
  },
  'studio.catalog.product.saved': {
    value: 'Saved.',
    contentKey: 'studio_help.catalog_product_saved',
  },
  'studio.catalog.product.none': {
    value: 'Not set',
    contentKey: 'studio_help.catalog_product_none',
  },
  'studio.catalog.readiness.heading': {
    value: 'Publication readiness',
    contentKey: 'studio_help.catalog_readiness_heading',
  },
  'studio.catalog.readiness.body': {
    value:
      'Every item below is named, not scored. The required ones must be met before this product can be published.',
    contentKey: 'studio_help.catalog_readiness_body',
  },
  'studio.catalog.readiness.met': {
    value: 'Done',
    contentKey: 'studio_help.catalog_readiness_met',
  },
  'studio.catalog.readiness.unmet': {
    value: 'Missing',
    contentKey: 'studio_help.catalog_readiness_unmet',
  },
  'studio.catalog.readiness.required': {
    value: 'Required',
    contentKey: 'studio_help.catalog_readiness_required',
  },
  'studio.catalog.readiness.optional': {
    value: 'Optional',
    contentKey: 'studio_help.catalog_readiness_optional',
  },
  'studio.catalog.readiness.refused': {
    value: 'Publication refused. These items are still missing:',
    contentKey: 'studio_help.catalog_readiness_refused',
  },
  'studio.catalog.priceState.FIXED': {
    value: 'Fixed price',
    contentKey: 'studio_help.catalog_price_state_fixed',
  },
  'studio.catalog.priceState.STARTING_FROM': {
    value: 'Starting from',
    contentKey: 'studio_help.catalog_price_state_starting_from',
  },
  'studio.catalog.priceState.REQUEST_QUOTE': {
    value: 'Request a quote',
    contentKey: 'studio_help.catalog_price_state_request_quote',
  },
  'studio.catalog.priceState.PRICE_ON_REQUEST': {
    value: 'Price on request',
    contentKey: 'studio_help.catalog_price_state_price_on_request',
  },
  'studio.catalog.availability.READY_STOCK': {
    value: 'Ready stock',
    contentKey: 'studio_help.catalog_availability_ready_stock',
  },
  'studio.catalog.availability.MADE_TO_ORDER': {
    value: 'Made to order',
    contentKey: 'studio_help.catalog_availability_made_to_order',
  },
  'studio.catalog.edition.ONE_OF_ONE': {
    value: 'One of one',
    contentKey: 'studio_help.catalog_edition_one_of_one',
  },
  'studio.catalog.edition.LIMITED_EDITION': {
    value: 'Limited edition',
    contentKey: 'studio_help.catalog_edition_limited_edition',
  },
  'studio.catalog.edition.OPEN_EDITION': {
    value: 'Open edition',
    contentKey: 'studio_help.catalog_edition_open_edition',
  },
  'studio.catalog.categories.caption': {
    value: 'The seven categories, in the order they are presented.',
    contentKey: 'studio_help.catalog_categories_caption',
  },
  'studio.catalog.categories.emptyHeading': {
    value: 'No categories',
    contentKey: 'studio_help.catalog_categories_empty_heading',
  },
  'studio.catalog.categories.emptyBody': {
    value:
      'The taxonomy is seeded. If this list is empty the seed has not run against this database.',
    contentKey: 'studio_help.catalog_categories_empty_body',
  },
  'studio.catalog.categories.colName': {
    value: 'Name',
    contentKey: 'studio_help.catalog_categories_col_name',
  },
  'studio.catalog.categories.colSlug': {
    value: 'Address',
    contentKey: 'studio_help.catalog_categories_col_slug',
  },
  'studio.catalog.categories.colOrder': {
    value: 'Order',
    contentKey: 'studio_help.catalog_categories_col_order',
  },
  'studio.catalog.categories.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.catalog_categories_col_status',
  },
  'studio.catalog.categories.editHeading': {
    value: 'Edit category',
    contentKey: 'studio_help.catalog_categories_edit_heading',
  },
  'studio.catalog.category.name': {
    value: 'Name',
    contentKey: 'studio_help.catalog_category_name',
  },
  'studio.catalog.category.subtitle': {
    value: 'Subtitle',
    contentKey: 'studio_help.catalog_category_subtitle',
  },
  'studio.catalog.category.description': {
    value: 'Description',
    contentKey: 'studio_help.catalog_category_description',
  },
  'studio.catalog.category.sortOrder': {
    value: 'Order position',
    contentKey: 'studio_help.catalog_category_sort_order',
  },
  'studio.catalog.category.heroMedia': {
    value: 'Hero image',
    contentKey: 'studio_help.catalog_category_hero_media',
  },
  'studio.catalog.materials.caption': {
    value: 'Materials, used by the product filters.',
    contentKey: 'studio_help.catalog_materials_caption',
  },
  'studio.catalog.materials.emptyHeading': {
    value: 'No materials yet',
    contentKey: 'studio_help.catalog_materials_empty_heading',
  },
  'studio.catalog.materials.emptyBody': {
    value: 'A material is what the collection filters by. Add the ones Rivya actually works in.',
    contentKey: 'studio_help.catalog_materials_empty_body',
  },
  'studio.catalog.materials.colName': {
    value: 'Name',
    contentKey: 'studio_help.catalog_materials_col_name',
  },
  'studio.catalog.materials.colSlug': {
    value: 'Address',
    contentKey: 'studio_help.catalog_materials_col_slug',
  },
  'studio.catalog.materials.colFamily': {
    value: 'Family',
    contentKey: 'studio_help.catalog_materials_col_family',
  },
  'studio.catalog.materials.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.catalog_materials_col_status',
  },
  'studio.catalog.materials.newHeading': {
    value: 'New material',
    contentKey: 'studio_help.catalog_materials_new_heading',
  },
  'studio.catalog.material.name': {
    value: 'Name',
    contentKey: 'studio_help.catalog_material_name',
  },
  'studio.catalog.material.slug': {
    value: 'Slug',
    contentKey: 'studio_help.catalog_material_slug',
  },
  'studio.catalog.material.family': {
    value: 'Family',
    contentKey: 'studio_help.catalog_material_family',
  },
  'studio.catalog.material.description': {
    value: 'Description',
    contentKey: 'studio_help.catalog_material_description',
  },
  'studio.catalog.material.save': {
    value: 'Save material',
    contentKey: 'studio_help.catalog_material_save',
  },
  'studio.catalog.collections.caption': {
    value: 'Collections. Every one is a concept until the owner confirms it.',
    contentKey: 'studio_help.catalog_collections_caption',
  },
  'studio.catalog.collections.emptyHeading': {
    value: 'No collections yet',
    contentKey: 'studio_help.catalog_collections_empty_heading',
  },
  'studio.catalog.collections.emptyBody': {
    value:
      'A collection groups pieces into an exhibition. It stays a concept until Rivya confirms it exists.',
    contentKey: 'studio_help.catalog_collections_empty_body',
  },
  'studio.catalog.collections.colName': {
    value: 'Name',
    contentKey: 'studio_help.catalog_collections_col_name',
  },
  'studio.catalog.collections.colSlug': {
    value: 'Address',
    contentKey: 'studio_help.catalog_collections_col_slug',
  },
  'studio.catalog.collections.colConcept': {
    value: 'Concept state',
    contentKey: 'studio_help.catalog_collections_col_concept',
  },
  'studio.catalog.collections.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.catalog_collections_col_status',
  },
  'studio.catalog.collections.newHeading': {
    value: 'New collection',
    contentKey: 'studio_help.catalog_collections_new_heading',
  },
  // --- Phase 17: the portfolio and testimonials -------------------------------------------------
  'studio.portfolio.caption': {
    value: 'Delivered projects. Every one is a claim that Rivya made something for someone.',
    contentKey: 'studio_help.portfolio_caption',
  },
  'studio.portfolio.emptyHeading': {
    value: 'No projects yet',
    contentKey: 'studio_help.portfolio_empty_heading',
  },
  'studio.portfolio.emptyBody': {
    value:
      'The portfolio is empty because no project has been entered and verified. That is the correct state, not a fault — the public page says so in its own words. Add a project when there is real work to show.',
    contentKey: 'studio_help.portfolio_empty_body',
  },
  'studio.portfolio.colTitle': {
    value: 'Project',
    contentKey: 'studio_help.portfolio_col_title',
  },
  'studio.portfolio.colClient': {
    value: 'Client',
    contentKey: 'studio_help.portfolio_col_client',
  },
  'studio.portfolio.colConsent': {
    value: 'Consent',
    contentKey: 'studio_help.portfolio_col_consent',
  },
  'studio.portfolio.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.portfolio_col_status',
  },
  'studio.portfolio.untitled': {
    value: 'Untitled project',
    contentKey: 'studio_help.portfolio_untitled',
  },
  'studio.portfolio.noClient': {
    value: 'Not a client project',
    contentKey: 'studio_help.portfolio_no_client',
  },
  // The project editor. These are labels and button words, deliberately distinct from the column
  // headings above: a table column reads "Project", and a button that says "Project" tells nobody
  // what pressing it does.
  'studio.portfolio.backToList': {
    value: 'All projects',
    contentKey: 'studio_help.portfolio_back_to_list',
  },
  'studio.portfolio.identityHeading': {
    value: 'What this project is',
    contentKey: 'studio_help.portfolio_identity_heading',
  },
  'studio.portfolio.identitySave': {
    value: 'Save these details',
    contentKey: 'studio_help.portfolio_identity_save',
  },
  'studio.portfolio.clientHeading': {
    value: 'Client and consent',
    contentKey: 'studio_help.portfolio_client_heading',
  },
  'studio.portfolio.clientSave': {
    value: 'Save client and consent',
    contentKey: 'studio_help.portfolio_client_save',
  },
  'studio.portfolio.relationsHeading': {
    value: 'Related content',
    contentKey: 'studio_help.portfolio_relations_heading',
  },
  'studio.portfolio.requiredLabel': {
    value: 'Required',
    contentKey: 'studio_help.portfolio_required_label',
  },
  'studio.portfolio.fieldTitle': {
    value: 'Title',
    contentKey: 'studio_help.portfolio_field_title',
  },
  'studio.portfolio.fieldSubtitle': {
    value: 'Subtitle',
    contentKey: 'studio_help.portfolio_field_subtitle',
  },
  'studio.portfolio.fieldSummary': {
    value: 'Summary',
    contentKey: 'studio_help.portfolio_field_summary',
  },
  'studio.portfolio.fieldType': {
    value: 'Kind of project',
    contentKey: 'studio_help.portfolio_field_type',
  },
  'studio.portfolio.fieldLocation': {
    value: 'Location label',
    contentKey: 'studio_help.portfolio_field_location',
  },
  'studio.portfolio.fieldLocationHelp': {
    value:
      'A label, not an address — "a private residence in Ahmedabad". Where somebody lives is not ours to publish.',
    contentKey: 'studio_help.portfolio_field_location_help',
  },
  'studio.portfolio.fieldCompleted': {
    value: 'Completed on',
    contentKey: 'studio_help.portfolio_field_completed',
  },
  'studio.portfolio.fieldCompletedHelp': {
    value: 'Leave this empty if you are not certain. An approximate date reads as a fact.',
    contentKey: 'studio_help.portfolio_field_completed_help',
  },
  'studio.portfolio.fieldEvidence': {
    value: 'Evidence note',
    contentKey: 'studio_help.portfolio_field_evidence',
  },
  'studio.portfolio.fieldEvidenceHelp': {
    value:
      'What proves this happened — an invoice number, a delivery date, where the photographs came from. Never shown on the website, and unreadable to a visitor even through a crafted request.',
    contentKey: 'studio_help.portfolio_field_evidence_help',
  },
  'studio.portfolio.fieldIsClient': {
    value: 'This was made for a client',
    contentKey: 'studio_help.portfolio_field_is_client',
  },
  'studio.portfolio.fieldClientName': {
    value: 'Client name, as they want it written',
    contentKey: 'studio_help.portfolio_field_client_name',
  },
  'studio.portfolio.fieldClientNameHelp': {
    value: 'Leave empty to publish the project without naming anyone.',
    contentKey: 'studio_help.portfolio_field_client_name_help',
  },
  'studio.portfolio.fieldConsent': {
    value: 'Consent to be named',
    contentKey: 'studio_help.portfolio_field_consent',
  },
  'studio.portfolio.fieldConsentRef': {
    value: 'Where that consent is held',
    contentKey: 'studio_help.portfolio_field_consent_ref',
  },
  'studio.portfolio.fieldConsentRefHelp': {
    value:
      'An email, a signed note, a message thread — enough that somebody could find it a year from now. Required before consent can be marked granted.',
    contentKey: 'studio_help.portfolio_field_consent_ref_help',
  },
  'studio.portfolio.consent.NOT_APPLICABLE': {
    value: 'Names nobody',
    contentKey: 'studio_help.portfolio_consent_not_applicable',
  },
  'studio.portfolio.consent.PENDING': {
    value: 'Asked, not yet answered',
    contentKey: 'studio_help.portfolio_consent_pending',
  },
  'studio.portfolio.consent.GRANTED': {
    value: 'Granted',
    contentKey: 'studio_help.portfolio_consent_granted',
  },
  'studio.portfolio.consent.WITHDRAWN': {
    value: 'Withdrawn',
    contentKey: 'studio_help.portfolio_consent_withdrawn',
  },
  'studio.portfolio.consentRecorded': {
    value: 'This consent decision was recorded on',
    contentKey: 'studio_help.portfolio_consent_recorded',
  },
  'studio.portfolio.publish': {
    value: 'Publish this project',
    contentKey: 'studio_help.portfolio_publish',
  },
  'studio.portfolio.unpublish': {
    value: 'Take it off the site',
    contentKey: 'studio_help.portfolio_unpublish',
  },
  'studio.portfolio.verifySet': {
    value: 'Confirm this project happened',
    contentKey: 'studio_help.portfolio_verify_set',
  },
  'studio.portfolio.verifyClear': {
    value: 'Withdraw that confirmation',
    contentKey: 'studio_help.portfolio_verify_clear',
  },
  'studio.portfolio.verifyHelp': {
    value:
      'Confirming is a statement that Rivya delivered this piece of work. Nothing publishes without it.',
    contentKey: 'studio_help.portfolio_verify_help',
  },
  // The Gallery panel.
  'studio.portfolio.gallery.heading': {
    value: 'Photographs',
    contentKey: 'studio_help.portfolio_gallery_heading',
  },
  'studio.portfolio.gallery.help': {
    value:
      'The pictures of the finished work, in the order they should appear. The number decides the order; the smallest goes first.',
    contentKey: 'studio_help.portfolio_gallery_help',
  },
  'studio.portfolio.gallery.conceptExcluded': {
    value:
      'Concept renders are not offered here, and the database refuses them: a project gallery shows work that was delivered, never an image of what something could look like.',
    contentKey: 'studio_help.portfolio_gallery_concept_excluded',
  },
  'studio.portfolio.gallery.empty': {
    value: 'No photographs attached yet.',
    contentKey: 'studio_help.portfolio_gallery_empty',
  },
  'studio.portfolio.gallery.nothingAttachable': {
    value:
      'There is nothing left to attach. Every photograph in the library that is not a concept render is already on this project.',
    contentKey: 'studio_help.portfolio_gallery_nothing_attachable',
  },
  'studio.portfolio.gallery.roleLabel': {
    value: 'What this picture is',
    contentKey: 'studio_help.portfolio_gallery_role_label',
  },
  'studio.portfolio.gallery.captionLabel': {
    value: 'Caption',
    contentKey: 'studio_help.portfolio_gallery_caption_label',
  },
  'studio.portfolio.gallery.altLabel': {
    value: 'Alt text for this project',
    contentKey: 'studio_help.portfolio_gallery_alt_label',
  },
  'studio.portfolio.gallery.altHelp': {
    value:
      "What the picture is doing here, which is a different sentence from what the picture is of. Leave it empty to use the asset's own words.",
    contentKey: 'studio_help.portfolio_gallery_alt_help',
  },
  'studio.portfolio.gallery.orderLabel': {
    value: 'Order',
    contentKey: 'studio_help.portfolio_gallery_order_label',
  },
  'studio.portfolio.gallery.save': {
    value: 'Save this picture',
    contentKey: 'studio_help.portfolio_gallery_save',
  },
  'studio.portfolio.gallery.detach': {
    value: 'Remove from this project',
    contentKey: 'studio_help.portfolio_gallery_detach',
  },
  'studio.portfolio.gallery.attachLabel': {
    value: 'Picture to attach',
    contentKey: 'studio_help.portfolio_gallery_attach_label',
  },
  'studio.portfolio.gallery.attach': {
    value: 'Attach',
    contentKey: 'studio_help.portfolio_gallery_attach',
  },
  // The Story panel.
  'studio.portfolio.story.heading': {
    value: 'Story page',
    contentKey: 'studio_help.portfolio_story_heading',
  },
  'studio.portfolio.story.help': {
    value:
      "A project's page is an ordered list of blocks, the same as any other page on the site. Creating it lays down four bands to start from — a hero, a statement, the photographs and a way to get in touch — every one of which can be reordered or removed.",
    contentKey: 'studio_help.portfolio_story_help',
  },
  'studio.portfolio.story.create': {
    value: 'Create the story page',
    contentKey: 'studio_help.portfolio_story_create',
  },
  'studio.portfolio.story.edit': {
    value: 'Edit the story page',
    contentKey: 'studio_help.portfolio_story_edit',
  },
  // Creating a project.
  'studio.portfolio.newHeading': {
    value: 'Add a project',
    contentKey: 'studio_help.portfolio_new_heading',
  },
  'studio.portfolio.newHelp': {
    value:
      'A new project starts as a draft that nobody has confirmed. It cannot be published until an owner confirms it happened, and — if it names a client — until that client has agreed to be named.',
    contentKey: 'studio_help.portfolio_new_help',
  },
  'studio.portfolio.newSlug': {
    value: 'Address (the last part of the web address)',
    contentKey: 'studio_help.portfolio_new_slug',
  },
  'studio.portfolio.newSubmit': {
    value: 'Add project',
    contentKey: 'studio_help.portfolio_new_submit',
  },
  'studio.portfolio.openEditor': {
    value: 'Open',
    contentKey: 'studio_help.portfolio_open_editor',
  },
  'studio.testimonials.caption': {
    value: 'Quotes from real people. Never written in-house.',
    contentKey: 'studio_help.testimonials_caption',
  },
  'studio.testimonials.emptyHeading': {
    value: 'No testimonials yet',
    contentKey: 'studio_help.testimonials_empty_heading',
  },
  'studio.testimonials.emptyBody': {
    value:
      'A testimonial is something a real person said and agreed to have published. There is no way to write one here, and that is deliberate: an invented quote is the plainest kind of fabricated evidence.',
    contentKey: 'studio_help.testimonials_empty_body',
  },
  'studio.testimonials.colQuote': {
    value: 'Quote',
    contentKey: 'studio_help.testimonials_col_quote',
  },
  'studio.testimonials.colAttribution': {
    value: 'Attributed to',
    contentKey: 'studio_help.testimonials_col_attribution',
  },
  'studio.testimonials.unattributed': {
    value: 'Unattributed',
    contentKey: 'studio_help.testimonials_unattributed',
  },

  // The testimonials editor.
  'studio.testimonials.newHeading': {
    value: 'Record a quote',
    contentKey: 'studio_help.testimonials_new_heading',
  },
  'studio.testimonials.newHelp': {
    value:
      'Type what the person actually said, as they said it. A quote arrives unverified and without consent, and it cannot be published until an owner confirms it is real and — if it names anyone — that they agreed to be named.',
    contentKey: 'studio_help.testimonials_new_help',
  },
  'studio.testimonials.quoteLabel': {
    value: 'What they said',
    contentKey: 'studio_help.testimonials_quote_label',
  },
  'studio.testimonials.quoteHelp': {
    value: 'Their words, not a summary of them and not an improvement on them.',
    contentKey: 'studio_help.testimonials_quote_help',
  },
  'studio.testimonials.attributedLabel': {
    value: 'Who said it',
    contentKey: 'studio_help.testimonials_attributed_label',
  },
  'studio.testimonials.attributedHelp': {
    value:
      'Leave empty to publish the quote without naming anyone. A name here makes their recorded consent a condition of publishing.',
    contentKey: 'studio_help.testimonials_attributed_help',
  },
  'studio.testimonials.roleLabel': {
    value: 'How to describe them',
    contentKey: 'studio_help.testimonials_role_label',
  },
  'studio.testimonials.orderLabel': {
    value: 'Order',
    contentKey: 'studio_help.testimonials_order_label',
  },
  'studio.testimonials.save': {
    value: 'Save this quote',
    contentKey: 'studio_help.testimonials_save',
  },
  'studio.testimonials.consentLabel': {
    value: 'Consent to be quoted',
    contentKey: 'studio_help.testimonials_consent_label',
  },
  'studio.testimonials.consentRefLabel': {
    value: 'Where that consent is held',
    contentKey: 'studio_help.testimonials_consent_ref_label',
  },
  'studio.testimonials.consentRefHelp': {
    value:
      'An email, a message thread, a signed note — enough that somebody could find it a year from now. Required before consent can be marked granted.',
    contentKey: 'studio_help.testimonials_consent_ref_help',
  },
  'studio.testimonials.consentSave': {
    value: 'Record this consent',
    contentKey: 'studio_help.testimonials_consent_save',
  },
  'studio.testimonials.verifySet': {
    value: 'Confirm this was really said',
    contentKey: 'studio_help.testimonials_verify_set',
  },
  'studio.testimonials.verifyClear': {
    value: 'Withdraw that confirmation',
    contentKey: 'studio_help.testimonials_verify_clear',
  },
  'studio.testimonials.publish': {
    value: 'Publish this quote',
    contentKey: 'studio_help.testimonials_publish',
  },
  'studio.testimonials.unpublish': {
    value: 'Take it off the site',
    contentKey: 'studio_help.testimonials_unpublish',
  },
  'studio.testimonials.newSubmit': {
    value: 'Record it',
    contentKey: 'studio_help.testimonials_new_submit',
  },
  'studio.testimonials.requiredLabel': {
    value: 'Required',
    contentKey: 'studio_help.testimonials_required_label',
  },

  // --- Phase 18: the journal ---------------------------------------------------------------------
  'studio.journal.caption': {
    value: 'Articles and guides. Ten ideas are waiting to be written.',
    contentKey: 'studio_help.journal_caption',
  },
  'studio.journal.emptyHeading': {
    value: 'No articles yet',
    contentKey: 'studio_help.journal_empty_heading',
  },
  'studio.journal.emptyBody': {
    value:
      'The ten seeded ideas arrive with this phase. Each is a title and an angle: what the piece is meant to be about, for whoever writes it. None has a body, and none can be published until one exists.',
    contentKey: 'studio_help.journal_empty_body',
  },
  'studio.journal.colTitle': { value: 'Article', contentKey: 'studio_help.journal_col_title' },
  'studio.journal.colCategory': {
    value: 'Category',
    contentKey: 'studio_help.journal_col_category',
  },
  'studio.journal.colStatus': { value: 'Status', contentKey: 'studio_help.journal_col_status' },
  'studio.journal.colBody': { value: 'Body', contentKey: 'studio_help.journal_col_body' },
  'studio.journal.colPublished': {
    value: 'Appears on',
    contentKey: 'studio_help.journal_col_published',
  },
  'studio.journal.untitled': {
    value: 'Untitled article',
    contentKey: 'studio_help.journal_untitled',
  },
  'studio.journal.noCategory': { value: 'Unfiled', contentKey: 'studio_help.journal_no_category' },
  'studio.journal.bodyPresent': {
    value: 'Written',
    contentKey: 'studio_help.journal_body_present',
  },
  'studio.journal.bodyAbsent': { value: 'Empty', contentKey: 'studio_help.journal_body_absent' },
  'studio.journal.backToList': { value: 'All articles', contentKey: 'studio_help.journal_back' },
  'studio.journal.requiredLabel': { value: 'Required', contentKey: 'studio_help.journal_required' },

  'studio.journal.newHeading': { value: 'Start an article', contentKey: 'studio_help.journal_new' },
  'studio.journal.newHelp': {
    value:
      'A new article is a draft with no body. Give it a title and an address; the writing happens in the block editor, and it cannot be published until there is something to read.',
    contentKey: 'studio_help.journal_new_help',
  },
  'studio.journal.newSlug': {
    value: 'Address (the last part of the web address)',
    contentKey: 'studio_help.journal_new_slug',
  },
  'studio.journal.newSubmit': {
    value: 'Add article',
    contentKey: 'studio_help.journal_new_submit',
  },

  'studio.journal.identityHeading': {
    value: 'What this article is',
    contentKey: 'studio_help.journal_identity',
  },
  'studio.journal.identitySave': {
    value: 'Save these details',
    contentKey: 'studio_help.journal_identity_save',
  },
  'studio.journal.fieldTitle': { value: 'Title', contentKey: 'studio_help.journal_field_title' },
  'studio.journal.fieldStandfirst': {
    value: 'Standfirst',
    contentKey: 'studio_help.journal_field_standfirst',
  },
  'studio.journal.fieldStandfirstHelp': {
    value: 'The line under the title on the article itself.',
    contentKey: 'studio_help.journal_field_standfirst_help',
  },
  'studio.journal.fieldExcerpt': {
    value: 'Card line',
    contentKey: 'studio_help.journal_field_excerpt',
  },
  'studio.journal.fieldExcerptHelp': {
    value:
      'What a card shows in a listing — a different sentence from the standfirst, because a card is read in a grid beside other cards.',
    contentKey: 'studio_help.journal_field_excerpt_help',
  },
  'studio.journal.fieldAngle': { value: 'Angle', contentKey: 'studio_help.journal_field_angle' },
  'studio.journal.fieldAngleHelp': {
    value:
      'What the piece is meant to be about, for whoever writes it. Never shown on the website — this is the brief, not the summary.',
    contentKey: 'studio_help.journal_field_angle_help',
  },
  'studio.journal.fieldByline': { value: 'Byline', contentKey: 'studio_help.journal_field_byline' },
  'studio.journal.fieldBylineHelp': {
    value:
      'Defaults to the studio. Typing a person’s name is a claim that they wrote this, so it needs an owner to confirm it before the article can be published.',
    contentKey: 'studio_help.journal_field_byline_help',
  },
  'studio.journal.fieldCategory': {
    value: 'Primary category',
    contentKey: 'studio_help.journal_field_category',
  },
  'studio.journal.fieldCategoryHelp': {
    value:
      'The one category this article belongs to. It decides which category page lists it, and which articles fill the related strip when nobody has chosen any.',
    contentKey: 'studio_help.journal_field_category_help',
  },
  'studio.journal.categoryNone': { value: 'Unfiled', contentKey: 'studio_help.journal_cat_none' },

  'studio.journal.readingMinutes': {
    value: 'Reading time is worked out from the article’s own blocks and cannot be typed.',
    contentKey: 'studio_help.journal_reading_minutes',
  },

  'studio.journal.bodyHeading': { value: 'Body', contentKey: 'studio_help.journal_body_heading' },
  'studio.journal.bodyHelp': {
    value:
      'The article itself is an ordered list of blocks, the same as any other page on the site. Creating it lays down one band to start from; nothing can be published until at least one block is visible.',
    contentKey: 'studio_help.journal_body_help',
  },
  'studio.journal.bodyCreate': {
    value: 'Create the article page',
    contentKey: 'studio_help.journal_body_create',
  },
  'studio.journal.bodyEdit': {
    value: 'Open the block editor',
    contentKey: 'studio_help.journal_body_edit',
  },

  'studio.journal.coverHeading': { value: 'Cover', contentKey: 'studio_help.journal_cover' },
  'studio.journal.coverHelp': {
    value:
      'Desktop and mobile are separate pictures, never one cropped by the browser. Leave the mobile slot empty if there is no portrait version — an empty slot is honest, a squeezed landscape is not.',
    contentKey: 'studio_help.journal_cover_help',
  },
  'studio.journal.coverDesktop': {
    value: 'Cover — desktop',
    contentKey: 'studio_help.journal_cover_desktop',
  },
  'studio.journal.coverMobile': {
    value: 'Cover — mobile',
    contentKey: 'studio_help.journal_cover_mobile',
  },
  'studio.journal.coverSave': {
    value: 'Save the cover',
    contentKey: 'studio_help.journal_cover_save',
  },
  'studio.journal.coverNone': { value: 'No picture', contentKey: 'studio_help.journal_cover_none' },

  'studio.journal.relationsHeading': {
    value: 'Related content',
    contentKey: 'studio_help.journal_relations',
  },
  'studio.journal.relationsHelp': {
    value:
      'Links chosen by hand always come first. When there are fewer than three, the strip fills with other articles in the same category — newest first, labelled as what it is.',
    contentKey: 'studio_help.journal_relations_help',
  },

  'studio.journal.publishHeading': {
    value: 'Publishing',
    contentKey: 'studio_help.journal_publish',
  },
  'studio.journal.publishHelp': {
    value:
      'An article appears when it is published AND its appearance date has passed. Setting a date in the future is how a piece is scheduled; leaving it empty publishes it now.',
    contentKey: 'studio_help.journal_publish_help',
  },
  'studio.journal.fieldPublishedAt': {
    value: 'Appears on',
    contentKey: 'studio_help.journal_field_published_at',
  },
  'studio.journal.publish': { value: 'Publish', contentKey: 'studio_help.journal_publish_action' },
  'studio.journal.unpublish': {
    value: 'Take it off the site',
    contentKey: 'studio_help.journal_unpublish',
  },
  'studio.journal.verifySet': {
    value: 'Confirm this byline',
    contentKey: 'studio_help.journal_verify_set',
  },
  'studio.journal.verifyClear': {
    value: 'Withdraw that confirmation',
    contentKey: 'studio_help.journal_verify_clear',
  },
  'studio.journal.verifyHelp': {
    value:
      'Only needed when this article names a person, asserts what Rivya can make, or states a standard. An owner or administrator confirms it; nothing publishes while it is outstanding.',
    contentKey: 'studio_help.journal_verify_help',
  },

  'studio.journal.categoriesHeading': {
    value: 'Categories',
    contentKey: 'studio_help.journal_categories_heading',
  },
  'studio.journal.categoriesHelp': {
    value:
      'The nine subjects the journal is filed under. A name can be reworded and the order changed; the address cannot, because it is a public URL somebody may have linked to.',
    contentKey: 'studio_help.journal_categories_help',
  },
  'studio.journal.categoryName': { value: 'Name', contentKey: 'studio_help.journal_category_name' },
  'studio.journal.categorySlug': {
    value: 'Address',
    contentKey: 'studio_help.journal_category_slug',
  },
  'studio.journal.categoryIntro': {
    value: 'Heading on the category page',
    contentKey: 'studio_help.journal_category_intro',
  },
  'studio.journal.categoryDescription': {
    value: 'Description',
    contentKey: 'studio_help.journal_category_description',
  },
  'studio.journal.categoryPosition': {
    value: 'Order',
    contentKey: 'studio_help.journal_category_position',
  },
  'studio.journal.categorySave': {
    value: 'Save this category',
    contentKey: 'studio_help.journal_category_save',
  },

  // --- Phase 17: the verification panel ---------------------------------------------------------
  'studio.verification.heading': {
    value: 'Before this can be published',
    contentKey: 'studio_help.verification_heading',
  },
  'studio.verification.ready': {
    value: 'Everything this needs is in place.',
    contentKey: 'studio_help.verification_ready',
  },
  'studio.verification.ownerOnly': {
    value: 'Only an owner or an administrator can clear this.',
    contentKey: 'studio_help.verification_owner_only',
  },
  'studio.verification.gate.owner_verification': {
    value: 'Nobody has confirmed this happened.',
    contentKey: 'studio_help.verification_gate_owner',
  },
  'studio.verification.gate.client_consent': {
    value: 'This names a client, and their consent is not recorded as granted.',
    contentKey: 'studio_help.verification_gate_client_consent',
  },
  'studio.verification.gate.attribution_consent': {
    value: 'This names a person, and their consent is not recorded as granted.',
    contentKey: 'studio_help.verification_gate_attribution',
  },
  'studio.verification.gate.consent_withdrawn': {
    value:
      'Consent has been withdrawn. This cannot be published, and publishing it will archive it instead.',
    contentKey: 'studio_help.verification_gate_withdrawn',
  },

  // --- Phase 16: the collection editor ---------------------------------------------------------
  'studio.catalog.collection.back': {
    value: 'All collections',
    contentKey: 'studio_help.catalog_collection_back',
  },
  'studio.catalog.collection.untitled': {
    value: 'Untitled collection',
    contentKey: 'studio_help.catalog_collection_untitled',
  },
  'studio.catalog.collection.conceptHeading': {
    value: 'Is this collection real?',
    contentKey: 'studio_help.catalog_collection_concept_heading',
  },
  'studio.catalog.collection.conceptBody': {
    value:
      'A collection stays a concept until the owner confirms it exists. Only the owner or an administrator can confirm one, and nothing can be published until they have.',
    contentKey: 'studio_help.catalog_collection_concept_body',
  },
  'studio.catalog.collection.confirm': {
    value: 'Confirm this collection is real',
    contentKey: 'studio_help.catalog_collection_confirm',
  },
  'studio.catalog.collection.withdraw': {
    value: 'Retire this collection',
    contentKey: 'studio_help.catalog_collection_withdraw',
  },
  'studio.catalog.collection.reopen': {
    value: 'Return to concept',
    contentKey: 'studio_help.catalog_collection_reopen',
  },
  'studio.catalog.collection.confirmedBy': {
    value: 'Confirmed',
    contentKey: 'studio_help.catalog_collection_confirmed_by',
  },
  'studio.catalog.collection.fieldsHeading': {
    value: 'Exhibition details',
    contentKey: 'studio_help.catalog_collection_fields_heading',
  },
  'studio.catalog.collection.subtitle': {
    value: 'Subtitle',
    contentKey: 'studio_help.catalog_collection_subtitle',
  },
  'studio.catalog.collection.statementLong': {
    value: 'Long statement',
    contentKey: 'studio_help.catalog_collection_statement_long',
  },
  'studio.catalog.collection.statementHelp': {
    value:
      'Leave this empty until the collection exists. A statement describing work that has not been made is a claim about the business, not a draft.',
    contentKey: 'studio_help.catalog_collection_statement_help',
  },
  'studio.catalog.collection.signatureMedia': {
    value: 'Signature image id',
    contentKey: 'studio_help.catalog_collection_signature_media',
  },
  'studio.catalog.collection.videoMedia': {
    value: 'Film id',
    contentKey: 'studio_help.catalog_collection_video_media',
  },
  'studio.catalog.collection.curationHeading': {
    value: 'Pieces in this collection',
    contentKey: 'studio_help.catalog_collection_curation_heading',
  },
  'studio.catalog.collection.curationEmpty': {
    value: 'No pieces yet. Paste a product id to add the first one.',
    contentKey: 'studio_help.catalog_collection_curation_empty',
  },
  'studio.catalog.collection.productId': {
    value: 'Product id',
    contentKey: 'studio_help.catalog_collection_product_id',
  },
  'studio.catalog.collection.add': {
    value: 'Add piece',
    contentKey: 'studio_help.catalog_collection_add',
  },
  'studio.catalog.collection.moveUp': {
    value: 'Move up',
    contentKey: 'studio_help.catalog_collection_move_up',
  },
  'studio.catalog.collection.moveDown': {
    value: 'Move down',
    contentKey: 'studio_help.catalog_collection_move_down',
  },
  'studio.catalog.collection.remove': {
    value: 'Remove',
    contentKey: 'studio_help.catalog_collection_remove',
  },
  'studio.catalog.collection.pageHeading': {
    value: 'Exhibition page',
    contentKey: 'studio_help.catalog_collection_page_heading',
  },
  'studio.catalog.collection.pageAbsent': {
    value:
      'This collection has no exhibition page yet. Creating one adds the standard bands, empty, in order — you write what goes in them.',
    contentKey: 'studio_help.catalog_collection_page_absent',
  },
  'studio.catalog.collection.pageCreate': {
    value: 'Create exhibition page',
    contentKey: 'studio_help.catalog_collection_page_create',
  },
  'studio.catalog.collection.pageEdit': {
    value: 'Edit the exhibition page',
    contentKey: 'studio_help.catalog_collection_page_edit',
  },
  'studio.catalog.collection.relationsHeading': {
    value: 'Related content',
    contentKey: 'studio_help.catalog_collection_relations_heading',
  },
  'studio.catalog.collection.relationsHelp': {
    value:
      'Links you make by hand. Nothing here is suggested or scored, and an id that does not exist yet is allowed — the link stays invisible until it does.',
    contentKey: 'studio_help.catalog_collection_relations_help',
  },
  'studio.catalog.collection.relationsEmpty': {
    value: 'No links yet.',
    contentKey: 'studio_help.catalog_collection_relations_empty',
  },
  'studio.catalog.collection.targetType': {
    value: 'Links to',
    contentKey: 'studio_help.catalog_collection_target_type',
  },
  'studio.catalog.collection.targetId': {
    value: 'Its id',
    contentKey: 'studio_help.catalog_collection_target_id',
  },
  'studio.catalog.collection.relationType': {
    value: 'Kind of link',
    contentKey: 'studio_help.catalog_collection_relation_type',
  },
  'studio.catalog.collection.relationNote': {
    value: 'Note',
    contentKey: 'studio_help.catalog_collection_relation_note',
  },
  'studio.catalog.collection.relationAdd': {
    value: 'Add link',
    contentKey: 'studio_help.catalog_collection_relation_add',
  },
  'studio.catalog.collections.conceptNote': {
    value:
      'A collection stays a draft concept until the owner confirms it, so it cannot be published from here.',
    contentKey: 'studio_help.catalog_collections_concept_note',
  },
  'studio.catalog.collection.name': {
    value: 'Name',
    contentKey: 'studio_help.catalog_collection_name',
  },
  'studio.catalog.collection.slug': {
    value: 'Slug',
    contentKey: 'studio_help.catalog_collection_slug',
  },
  'studio.catalog.collection.statement': {
    value: 'Statement',
    contentKey: 'studio_help.catalog_collection_statement',
  },
  'studio.catalog.collection.sortOrder': {
    value: 'Order position',
    contentKey: 'studio_help.catalog_collection_sort_order',
  },
  'studio.catalog.collection.save': {
    value: 'Save collection',
    contentKey: 'studio_help.catalog_collection_save',
  },

  /* ---------------------------------------------------------------------------------------------
   * Phase 19 — the customization form builder and the feature-flag register.
   *
   * THE BUILDER'S WORDS CARRY ITS RULES. A form's steps and fields are the questions a visitor is
   * asked, and three of the database's refusals are invisible until they fire: a form cannot be
   * published without an enabled contact step, that step must ask for a phone number or an email
   * address, and a choice field with no choices is refused. The help text below says all three
   * BEFORE the editor presses publish, because a refusal explained afterwards is a refusal that
   * already wasted the work.
   *
   * NOTHING HERE OFFERS A PRICE. `customization_form_fields.validation` has an allowlist CHECK that
   * rejects `price_multiplier` and its relatives outright, and the field-type enum has no money in
   * it. The note on the fields panel says so, because a merchandiser looking for the surcharge box
   * should be told it does not exist rather than left hunting for it.
   * ------------------------------------------------------------------------------------------- */
  'studio.catalog.forms.caption': {
    value: 'Customization forms',
    contentKey: 'studio_help.catalog_forms_caption',
  },
  'studio.catalog.forms.emptyHeading': {
    value: 'No forms yet',
    contentKey: 'studio_help.catalog_forms_empty_heading',
  },
  'studio.catalog.forms.emptyBody': {
    value: 'A form is the set of questions a bespoke brief asks. Create one below.',
    contentKey: 'studio_help.catalog_forms_empty_body',
  },
  'studio.catalog.forms.help': {
    value:
      'Each form is a sequence of steps, and each step a set of questions. A form is offered on a product page when it is bound to that product or to its category.',
    contentKey: 'studio_help.catalog_forms_help',
  },
  'studio.catalog.forms.colName': {
    value: 'Name',
    contentKey: 'studio_help.catalog_forms_col_name',
  },
  'studio.catalog.forms.colSlug': {
    value: 'Slug',
    contentKey: 'studio_help.catalog_forms_col_slug',
  },
  'studio.catalog.forms.colKind': {
    value: 'Kind',
    contentKey: 'studio_help.catalog_forms_col_kind',
  },
  'studio.catalog.forms.colSteps': {
    value: 'Steps',
    contentKey: 'studio_help.catalog_forms_col_steps',
  },
  'studio.catalog.forms.colFields': {
    value: 'Questions',
    contentKey: 'studio_help.catalog_forms_col_fields',
  },
  'studio.catalog.forms.colDefault': {
    value: 'Default',
    contentKey: 'studio_help.catalog_forms_col_default',
  },
  'studio.catalog.forms.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.catalog_forms_col_status',
  },
  'studio.catalog.forms.isDefaultYes': {
    value: 'Default for its kind',
    contentKey: 'studio_help.catalog_forms_is_default_yes',
  },
  'studio.catalog.forms.newHeading': {
    value: 'New form',
    contentKey: 'studio_help.catalog_forms_new_heading',
  },
  'studio.catalog.forms.newNote': {
    value:
      'A new form starts as a draft with no steps. Add a contact step before publishing it: a brief that arrives with no way to reply cannot be answered.',
    contentKey: 'studio_help.catalog_forms_new_note',
  },
  'studio.catalog.forms.duplicateHeading': {
    value: 'Copy an existing form',
    contentKey: 'studio_help.catalog_forms_duplicate_heading',
  },
  'studio.catalog.forms.duplicateNote': {
    value:
      'The copy carries every step and question of the original, arrives as a draft, and is never the default for its kind. Editing it does not touch the form it came from.',
    contentKey: 'studio_help.catalog_forms_duplicate_note',
  },
  'studio.catalog.forms.duplicateSource': {
    value: 'Copy from',
    contentKey: 'studio_help.catalog_forms_duplicate_source',
  },
  'studio.catalog.forms.duplicate': {
    value: 'Copy form',
    contentKey: 'studio_help.catalog_forms_duplicate',
  },
  'studio.catalog.form.name': {
    value: 'Name',
    contentKey: 'studio_help.catalog_form_name',
  },
  'studio.catalog.form.slug': {
    value: 'Slug',
    contentKey: 'studio_help.catalog_form_slug',
  },
  'studio.catalog.form.kind': {
    value: 'Kind',
    contentKey: 'studio_help.catalog_form_kind',
  },
  'studio.catalog.form.description': {
    value: 'Description',
    contentKey: 'studio_help.catalog_form_description',
  },
  'studio.catalog.form.descriptionHelp': {
    value: 'For the Studio only. What this form is for, and who it is for.',
    contentKey: 'studio_help.catalog_form_description_help',
  },
  'studio.catalog.form.create': {
    value: 'Create form',
    contentKey: 'studio_help.catalog_form_create',
  },
  'studio.catalog.form.save': {
    value: 'Save form',
    contentKey: 'studio_help.catalog_form_save',
  },
  'studio.catalog.form.back': {
    value: 'Back to forms',
    contentKey: 'studio_help.catalog_form_back',
  },
  'studio.catalog.form.untitled': {
    value: 'Untitled form',
    contentKey: 'studio_help.catalog_form_untitled',
  },
  'studio.catalog.form.requiredLabel': {
    value: 'Required',
    contentKey: 'studio_help.catalog_form_required_label',
  },
  'studio.catalog.form.identityHeading': {
    value: 'The form',
    contentKey: 'studio_help.catalog_form_identity_heading',
  },
  'studio.catalog.form.introHeading': {
    value: 'Opening heading',
    contentKey: 'studio_help.catalog_form_intro_heading',
  },
  'studio.catalog.form.introBody': {
    value: 'Opening paragraph',
    contentKey: 'studio_help.catalog_form_intro_body',
  },
  'studio.catalog.form.introHelp': {
    value: 'What a visitor reads above the first step. Leave both empty to open straight into it.',
    contentKey: 'studio_help.catalog_form_intro_help',
  },
  'studio.catalog.form.submitLabelKey': {
    value: 'Submit button key',
    contentKey: 'studio_help.catalog_form_submit_label_key',
  },
  'studio.catalog.form.submitLabelKeyHelp': {
    value:
      'A content key such as CTA.send_an_enquiry, not the words themselves. The wording lives in the content library so every form changes together.',
    contentKey: 'studio_help.catalog_form_submit_label_key_help',
  },
  'studio.catalog.form.isDefault': {
    value: 'Use this form when nothing more specific is bound',
    contentKey: 'studio_help.catalog_form_is_default',
  },
  'studio.catalog.form.publishHeading': {
    value: 'Publication',
    contentKey: 'studio_help.catalog_form_publish_heading',
  },
  'studio.catalog.form.publishBody': {
    value:
      'A published form is offered to visitors. Publication is refused unless the form has an enabled contact step, that step asks for a phone number or an email address, and every choice question has at least one choice.',
    contentKey: 'studio_help.catalog_form_publish_body',
  },
  'studio.catalog.form.publish': {
    value: 'Publish form',
    contentKey: 'studio_help.catalog_form_publish',
  },
  'studio.catalog.form.unpublish': {
    value: 'Withdraw form',
    contentKey: 'studio_help.catalog_form_unpublish',
  },
  'studio.catalog.form.flagNote': {
    value:
      'The configurator itself is behind a feature flag. Publishing a form does not put it on the site until that flag is switched on under System · Feature flags.',
    contentKey: 'studio_help.catalog_form_flag_note',
  },
  'studio.catalog.form.stepsHeading': {
    value: 'Steps',
    contentKey: 'studio_help.catalog_form_steps_heading',
  },
  'studio.catalog.form.stepsHelp': {
    value:
      'Steps are shown in the order below. The contact step is always moved last, whatever number it is given, because it is the one asked after the brief is described.',
    contentKey: 'studio_help.catalog_form_steps_help',
  },
  'studio.catalog.form.stepsEmpty': {
    value: 'This form has no steps yet.',
    contentKey: 'studio_help.catalog_form_steps_empty',
  },
  'studio.catalog.form.stepKey': {
    value: 'Step key',
    contentKey: 'studio_help.catalog_form_step_key',
  },
  'studio.catalog.form.stepKeyHelp': {
    value: 'Lowercase letters, digits and underscores. It cannot be changed once questions use it.',
    contentKey: 'studio_help.catalog_form_step_key_help',
  },
  'studio.catalog.form.stepTitle': {
    value: 'Step title',
    contentKey: 'studio_help.catalog_form_step_title',
  },
  'studio.catalog.form.stepDescription': {
    value: 'Step description',
    contentKey: 'studio_help.catalog_form_step_description',
  },
  'studio.catalog.form.stepPosition': {
    value: 'Position',
    contentKey: 'studio_help.catalog_form_step_position',
  },
  'studio.catalog.form.stepEnabled': {
    value: 'Shown to visitors',
    contentKey: 'studio_help.catalog_form_step_enabled',
  },
  'studio.catalog.form.stepRequired': {
    value: 'Must be completed before continuing',
    contentKey: 'studio_help.catalog_form_step_required',
  },
  'studio.catalog.form.stepSave': {
    value: 'Save step',
    contentKey: 'studio_help.catalog_form_step_save',
  },
  'studio.catalog.form.stepDelete': {
    value: 'Delete step',
    contentKey: 'studio_help.catalog_form_step_delete',
  },
  'studio.catalog.form.stepAddHeading': {
    value: 'Add a step',
    contentKey: 'studio_help.catalog_form_step_add_heading',
  },
  'studio.catalog.form.stepAdd': {
    value: 'Add step',
    contentKey: 'studio_help.catalog_form_step_add',
  },
  'studio.catalog.form.fieldsHeading': {
    value: 'Questions',
    contentKey: 'studio_help.catalog_form_fields_heading',
  },
  'studio.catalog.form.fieldsEmpty': {
    value: 'This step asks nothing yet.',
    contentKey: 'studio_help.catalog_form_fields_empty',
  },
  'studio.catalog.form.fieldsNote': {
    value:
      'There is no price, surcharge or multiplier question, and there is no way to add one: this studio quotes after reading a brief, never from a form.',
    contentKey: 'studio_help.catalog_form_fields_note',
  },
  'studio.catalog.form.fieldKey': {
    value: 'Question key',
    contentKey: 'studio_help.catalog_form_field_key',
  },
  'studio.catalog.form.fieldKeyHelp': {
    value:
      'Lowercase letters, digits and underscores. It names the answer in the message sent to the studio and cannot be changed afterwards.',
    contentKey: 'studio_help.catalog_form_field_key_help',
  },
  'studio.catalog.form.orderSave': {
    value: 'Save order',
    contentKey: 'studio_help.catalog_form_order_save',
  },
  'studio.catalog.form.fieldLabel': {
    value: 'Question',
    contentKey: 'studio_help.catalog_form_field_label',
  },
  'studio.catalog.form.fieldHelpText': {
    value: 'Help text',
    contentKey: 'studio_help.catalog_form_field_help_text',
  },
  'studio.catalog.form.fieldPlaceholder': {
    value: 'Placeholder',
    contentKey: 'studio_help.catalog_form_field_placeholder',
  },
  'studio.catalog.form.fieldType': {
    value: 'Answer type',
    contentKey: 'studio_help.catalog_form_field_type',
  },
  'studio.catalog.form.fieldOptions': {
    value: 'Choices',
    contentKey: 'studio_help.catalog_form_field_options',
  },
  'studio.catalog.form.fieldOptionsHelp': {
    value:
      'One per line, as value | label. Only choice questions use them, and a choice question with none cannot be published.',
    contentKey: 'studio_help.catalog_form_field_options_help',
  },
  'studio.catalog.form.fieldPosition': {
    value: 'Position',
    contentKey: 'studio_help.catalog_form_field_position',
  },
  'studio.catalog.form.fieldEnabled': {
    value: 'Asked',
    contentKey: 'studio_help.catalog_form_field_enabled',
  },
  'studio.catalog.form.fieldRequired': {
    value: 'Must be answered',
    contentKey: 'studio_help.catalog_form_field_required',
  },
  'studio.catalog.form.fieldWhatsapp': {
    value: 'Include the answer in the message to the studio',
    contentKey: 'studio_help.catalog_form_field_whatsapp',
  },
  'studio.catalog.form.fieldSave': {
    value: 'Save question',
    contentKey: 'studio_help.catalog_form_field_save',
  },
  'studio.catalog.form.fieldDelete': {
    value: 'Delete question',
    contentKey: 'studio_help.catalog_form_field_delete',
  },
  'studio.catalog.form.fieldAddHeading': {
    value: 'Add a question',
    contentKey: 'studio_help.catalog_form_field_add_heading',
  },
  'studio.catalog.form.fieldAdd': {
    value: 'Add question',
    contentKey: 'studio_help.catalog_form_field_add',
  },
  'studio.catalog.form.bindingsHeading': {
    value: 'Where this form is offered',
    contentKey: 'studio_help.catalog_form_bindings_heading',
  },
  'studio.catalog.form.bindingsHelp': {
    value:
      'A binding to a product wins over a binding to its category. A form bound to nothing is still reachable from the commissions page if it is the default for its kind.',
    contentKey: 'studio_help.catalog_form_bindings_help',
  },
  'studio.catalog.form.bindingsEmpty': {
    value: 'This form is not bound to any product or category.',
    contentKey: 'studio_help.catalog_form_bindings_empty',
  },
  'studio.catalog.form.bindingProduct': {
    value: 'Product',
    contentKey: 'studio_help.catalog_form_binding_product',
  },
  'studio.catalog.form.bindingCategory': {
    value: 'Category',
    contentKey: 'studio_help.catalog_form_binding_category',
  },
  'studio.catalog.form.bindingNone': {
    value: '— none —',
    contentKey: 'studio_help.catalog_form_binding_none',
  },
  'studio.catalog.form.bindingAdd': {
    value: 'Bind form',
    contentKey: 'studio_help.catalog_form_binding_add',
  },
  'studio.catalog.form.bindingRemove': {
    value: 'Remove',
    contentKey: 'studio_help.catalog_form_binding_remove',
  },
  'studio.catalog.form.bindingTarget': {
    value: 'Bound to',
    contentKey: 'studio_help.catalog_form_binding_target',
  },
  'studio.catalog.form.previewHeading': {
    value: 'Preview',
    contentKey: 'studio_help.catalog_form_preview_heading',
  },
  'studio.catalog.form.previewBody': {
    value:
      'Opens the commissions page, where a published form is rendered exactly as a visitor sees it once the configurator flag is on.',
    contentKey: 'studio_help.catalog_form_preview_body',
  },
  'studio.catalog.form.preview': {
    value: 'Open the commissions page',
    contentKey: 'studio_help.catalog_form_preview',
  },

  /* ---------------------------------------------------------------------------------------------
   * /studio/system/flags — the register of what is switched on.
   *
   * EVERY ROLE READS IT AND TWO ROLES MOVE IT. The register is how anybody in the Studio accounts
   * for a surface that is missing: a merchandiser who cannot find the configurator should be able
   * to see that it is off rather than conclude it is broken. Switching is `system.flags.write`,
   * owner and administrator, and for a role without it the controls are ABSENT rather than
   * disabled — a greyed-out switch reads as "ask someone to enable this", which is the wrong idea.
   * ------------------------------------------------------------------------------------------- */
  'studio.system.flags.heading': {
    value: 'Feature flags',
    contentKey: 'studio_help.system_flags_heading',
  },
  'studio.system.flags.help': {
    value:
      'What is switched on. A feature that is off is not hidden in the page — it is not built into the response at all, so a visitor cannot reach it by any means.',
    contentKey: 'studio_help.system_flags_help',
  },
  'studio.system.flags.registerNote': {
    value:
      'Flags are declared in the code, not created here. A feature that has been built appears in this list; nothing else can be switched.',
    contentKey: 'studio_help.system_flags_register_note',
  },
  'studio.system.flags.readOnlyNote': {
    value: 'Only an owner or an administrator can move these switches.',
    contentKey: 'studio_help.system_flags_read_only_note',
  },
  'studio.system.flags.caption': {
    value: 'Feature flags',
    contentKey: 'studio_help.system_flags_caption',
  },
  'studio.system.flags.colKey': {
    value: 'Flag',
    contentKey: 'studio_help.system_flags_col_key',
  },
  'studio.system.flags.colDescription': {
    value: 'What it controls',
    contentKey: 'studio_help.system_flags_col_description',
  },
  'studio.system.flags.colState': {
    value: 'State',
    contentKey: 'studio_help.system_flags_col_state',
  },
  'studio.system.flags.on': {
    value: 'On',
    contentKey: 'studio_help.system_flags_on',
  },
  'studio.system.flags.off': {
    value: 'Off',
    contentKey: 'studio_help.system_flags_off',
  },
  'studio.system.flags.enable': {
    value: 'Switch on',
    contentKey: 'studio_help.system_flags_enable',
  },
  'studio.system.flags.disable': {
    value: 'Switch off',
    contentKey: 'studio_help.system_flags_disable',
  },
  'studio.system.flags.emptyHeading': {
    value: 'No flags are registered',
    contentKey: 'studio_help.system_flags_empty_heading',
  },
  'studio.system.flags.emptyBody': {
    value: 'Nothing in the code declares a flag, so there is nothing to switch.',
    contentKey: 'studio_help.system_flags_empty_body',
  },

  /* ---------------------------------------------------------------------------------------------
   * Phase 20 — the enquiry inbox.
   *
   * THE COLUMN HEADINGS ARE PLAIN WORDS AND NOT FIELD NAMES. "From" rather than "Name", "Received"
   * rather than "created_at": this screen is read by whoever is answering the phone, not by whoever
   * wrote the schema, and a column called `pipeline_status` helps nobody triage anything.
   *
   * NOTHING HERE OFFERS A PRICE, A QUOTE OR AN ORDER. There is no such column to render and no such
   * control to name — the pipeline has a QUOTED status because a quotation is a conversation the
   * studio has, not a number this product computes.
   * ------------------------------------------------------------------------------------------- */
  'studio.inquiries.help': {
    value:
      'Every enquiry the site has received. An enquiry is written to the database before any WhatsApp handoff, so this list is the record even when the conversation moved elsewhere.',
    contentKey: 'studio_help.inquiries_help',
  },
  'studio.inquiries.caption': {
    value: 'Enquiries',
    contentKey: 'studio_help.inquiries_caption',
  },
  'studio.inquiries.emptyHeading': {
    value: 'No enquiries yet',
    contentKey: 'studio_help.inquiries_empty_heading',
  },
  'studio.inquiries.emptyBody': {
    value: 'Enquiries sent from the website appear here the moment they are saved.',
    contentKey: 'studio_help.inquiries_empty_body',
  },
  'studio.inquiries.colReference': {
    value: 'Reference',
    contentKey: 'studio_help.inquiries_col_reference',
  },
  'studio.inquiries.colKind': {
    value: 'Kind',
    contentKey: 'studio_help.inquiries_col_kind',
  },
  'studio.inquiries.colName': {
    value: 'From',
    contentKey: 'studio_help.inquiries_col_name',
  },
  'studio.inquiries.colCity': {
    value: 'City',
    contentKey: 'studio_help.inquiries_col_city',
  },
  'studio.inquiries.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.inquiries_col_status',
  },
  'studio.inquiries.colWhatsapp': {
    value: 'WhatsApp',
    contentKey: 'studio_help.inquiries_col_whatsapp',
  },
  'studio.inquiries.colReceived': {
    value: 'Received',
    contentKey: 'studio_help.inquiries_col_received',
  },
  'studio.inquiries.colAssignee': {
    value: 'Assigned',
    contentKey: 'studio_help.inquiries_col_assignee',
  },
  'studio.inquiries.export': {
    value: 'Export as CSV',
    contentKey: 'studio_help.inquiries_export',
  },
  'studio.inquiries.exportNote': {
    value:
      'The export carries what a person needs to follow an enquiry up. It omits the hashed address and the browser string: those exist to catch abuse, not to travel in a spreadsheet.',
    contentKey: 'studio_help.inquiries_export_note',
  },
  'studio.inquiry.back': {
    value: 'Back to enquiries',
    contentKey: 'studio_help.inquiry_back',
  },
  'studio.inquiry.contactHeading': {
    value: 'Who sent it',
    contentKey: 'studio_help.inquiry_contact_heading',
  },
  'studio.inquiry.phone': {
    value: 'Phone',
    contentKey: 'studio_help.inquiry_phone',
  },
  'studio.inquiry.email': {
    value: 'Email',
    contentKey: 'studio_help.inquiry_email',
  },
  'studio.inquiry.city': {
    value: 'City',
    contentKey: 'studio_help.inquiry_city',
  },
  'studio.inquiry.enquiryType': {
    value: 'Enquiry type',
    contentKey: 'studio_help.inquiry_enquiry_type',
  },
  'studio.inquiry.messageHeading': {
    value: 'What they wrote',
    contentKey: 'studio_help.inquiry_message_heading',
  },
  'studio.inquiry.answersHeading': {
    value: 'The brief',
    contentKey: 'studio_help.inquiry_answers_heading',
  },
  'studio.inquiry.answersEmpty': {
    value: 'This enquiry carries no configured answers.',
    contentKey: 'studio_help.inquiry_answers_empty',
  },
  'studio.inquiry.attachmentsHeading': {
    value: 'Reference images',
    contentKey: 'studio_help.inquiry_attachments_heading',
  },
  'studio.inquiry.attachmentsEmpty': {
    value: 'No reference images were attached.',
    contentKey: 'studio_help.inquiry_attachments_empty',
  },
  'studio.inquiry.timelineHeading': {
    value: 'What has happened',
    contentKey: 'studio_help.inquiry_timeline_heading',
  },
  'studio.inquiry.timelineNote': {
    value:
      'Append only. A mistaken entry is corrected by adding another, never by editing this record.',
    contentKey: 'studio_help.inquiry_timeline_note',
  },
  'studio.inquiry.pipelineHeading': {
    value: 'Where it stands',
    contentKey: 'studio_help.inquiry_pipeline_heading',
  },
  'studio.inquiry.status': {
    value: 'Status',
    contentKey: 'studio_help.inquiry_status',
  },
  'studio.inquiry.statusSave': {
    value: 'Move to this status',
    contentKey: 'studio_help.inquiry_status_save',
  },
  'studio.inquiry.assignHeading': {
    value: 'Who is answering it',
    contentKey: 'studio_help.inquiry_assign_heading',
  },
  'studio.inquiry.assignee': {
    value: 'Assigned to',
    contentKey: 'studio_help.inquiry_assignee',
  },
  'studio.inquiry.assignSave': {
    value: 'Save assignment',
    contentKey: 'studio_help.inquiry_assign_save',
  },
  'studio.inquiry.unassigned': {
    value: '— nobody —',
    contentKey: 'studio_help.inquiry_unassigned',
  },
  'studio.inquiry.noteHeading': {
    value: 'Add a note',
    contentKey: 'studio_help.inquiry_note_heading',
  },
  'studio.inquiry.note': {
    value: 'Note',
    contentKey: 'studio_help.inquiry_note',
  },
  'studio.inquiry.noteAdd': {
    value: 'Add note',
    contentKey: 'studio_help.inquiry_note_add',
  },
  'studio.inquiry.sourcePath': {
    value: 'Sent from',
    contentKey: 'studio_help.inquiry_source_path',
  },
  'studio.inquiry.received': {
    value: 'Received',
    contentKey: 'studio_help.inquiry_received',
  },
  'studio.inquiry.whatsapp': {
    value: 'WhatsApp',
    contentKey: 'studio_help.inquiry_whatsapp',
  },
  'studio.inquiry.notFound': {
    value: 'That enquiry could not be found.',
    contentKey: 'studio_help.inquiry_not_found',
  },
  // --- Phase 22: merchandising -----------------------------------------------------------------
  'studio.merchandising.readOnlyNote': {
    value:
      'You can see the arrangements here. Changing them needs the merchandising permission (owner, admin, merchandiser).',
    contentKey: 'studio_help.merch_read_only_note',
  },
  'studio.merchandising.slot.key': {
    value: 'Slot',
    contentKey: 'studio_help.merch_slot_key',
  },
  'studio.merchandising.slot.surface': {
    value: 'Appears on',
    contentKey: 'studio_help.merch_slot_surface',
  },
  'studio.merchandising.slot.readBy': {
    value: 'Read by',
    contentKey: 'studio_help.merch_slot_read_by',
  },
  'studio.merchandising.slot.types': {
    value: 'Accepts',
    contentKey: 'studio_help.merch_slot_types',
  },
  'studio.merchandising.slot.status': {
    value: 'Slot status',
    contentKey: 'studio_help.merch_slot_status',
  },
  'studio.merchandising.entries.caption': {
    value: 'Entries in this slot, in the order the site shows them',
    contentKey: 'studio_help.merch_entries_caption',
  },
  'studio.merchandising.entries.emptyHeading': {
    value: 'Nothing curated yet',
    contentKey: 'studio_help.merch_entries_empty_heading',
  },
  'studio.merchandising.entries.emptyBody': {
    value:
      'Add a piece below. Until the slot reaches its minimum, the site shows the fallback you choose under Settings.',
    contentKey: 'studio_help.merch_entries_empty_body',
  },
  'studio.merchandising.entries.colEntity': {
    value: 'Entity',
    contentKey: 'studio_help.merch_entries_col_entity',
  },
  'studio.merchandising.entries.colType': {
    value: 'Type',
    contentKey: 'studio_help.merch_entries_col_type',
  },
  'studio.merchandising.entries.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.merch_entries_col_status',
  },
  'studio.merchandising.entries.colWindow': {
    value: 'Window',
    contentKey: 'studio_help.merch_entries_col_window',
  },
  'studio.merchandising.entries.colPinned': {
    value: 'Pinned',
    contentKey: 'studio_help.merch_entries_col_pinned',
  },
  'studio.merchandising.entries.colOrder': {
    value: 'Order',
    contentKey: 'studio_help.merch_entries_col_order',
  },
  'studio.merchandising.entries.colActions': {
    value: 'Actions',
    contentKey: 'studio_help.merch_entries_col_actions',
  },
  'studio.merchandising.entry.moveUp': {
    value: 'Move up',
    contentKey: 'studio_help.merch_entry_move_up',
  },
  'studio.merchandising.entry.moveDown': {
    value: 'Move down',
    contentKey: 'studio_help.merch_entry_move_down',
  },
  'studio.merchandising.entry.remove': {
    value: 'Remove',
    contentKey: 'studio_help.merch_entry_remove',
  },
  'studio.merchandising.entry.publish': {
    value: 'Publish',
    contentKey: 'studio_help.merch_entry_publish',
  },
  'studio.merchandising.entry.unpublish': {
    value: 'Take down',
    contentKey: 'studio_help.merch_entry_unpublish',
  },
  'studio.merchandising.entry.pin': {
    value: 'Pin',
    contentKey: 'studio_help.merch_entry_pin',
  },
  'studio.merchandising.entry.unpin': {
    value: 'Unpin',
    contentKey: 'studio_help.merch_entry_unpin',
  },
  'studio.merchandising.entry.noWindow': {
    value: 'Always',
    contentKey: 'studio_help.merch_entry_no_window',
  },
  'studio.merchandising.entry.from': {
    value: 'From',
    contentKey: 'studio_help.merch_entry_from',
  },
  'studio.merchandising.entry.until': {
    value: 'Until',
    contentKey: 'studio_help.merch_entry_until',
  },
  'studio.merchandising.entry.unknownTarget': {
    value: 'Not visible to you',
    contentKey: 'studio_help.merch_entry_unknown_target',
  },
  'studio.merchandising.entry.windowHeading': {
    value: 'Window and note',
    contentKey: 'studio_help.merch_entry_window_heading',
  },
  'studio.merchandising.entry.publishAt': {
    value: 'Opens at',
    contentKey: 'studio_help.merch_entry_publish_at',
  },
  'studio.merchandising.entry.unpublishAt': {
    value: 'Closes at',
    contentKey: 'studio_help.merch_entry_unpublish_at',
  },
  'studio.merchandising.entry.windowHelp': {
    value:
      'Leave both empty for an entry that is live whenever it is published. Times are entered in UTC.',
    contentKey: 'studio_help.merch_entry_window_help',
  },
  'studio.merchandising.entry.note': {
    value: 'Note',
    contentKey: 'studio_help.merch_entry_note',
  },
  'studio.merchandising.entry.saveWindow': {
    value: 'Save window',
    contentKey: 'studio_help.merch_entry_save_window',
  },
  'studio.merchandising.add.heading': {
    value: 'Add to this slot',
    contentKey: 'studio_help.merch_add_heading',
  },
  'studio.merchandising.add.entity': {
    value: 'Piece',
    contentKey: 'studio_help.merch_add_entity',
  },
  'studio.merchandising.add.type': {
    value: 'Type',
    contentKey: 'studio_help.merch_add_type',
  },
  'studio.merchandising.add.submit': {
    value: 'Add',
    contentKey: 'studio_help.merch_add_submit',
  },
  'studio.merchandising.add.publishedOnly': {
    value:
      'Only published items are offered. An entry pointing at something unpublished renders nothing until it is published.',
    contentKey: 'studio_help.merch_add_published_only',
  },
  'studio.merchandising.add.conceptsNote': {
    value:
      'Collections still in concept are not offered: the Phase 16 gate means a concept cannot be published, so it cannot be featured. Confirm the concept under Catalogue → Collections first.',
    contentKey: 'studio_help.merch_add_concepts_note',
  },
  'studio.merchandising.add.nothingToOffer': {
    value: 'Nothing published to add yet.',
    contentKey: 'studio_help.merch_add_nothing',
  },
  'studio.merchandising.settings.heading': {
    value: 'Settings',
    contentKey: 'studio_help.merch_settings_heading',
  },
  'studio.merchandising.settings.minItems': {
    value: 'Minimum shown',
    contentKey: 'studio_help.merch_settings_min',
  },
  'studio.merchandising.settings.maxItems': {
    value: 'Maximum shown',
    contentKey: 'studio_help.merch_settings_max',
  },
  'studio.merchandising.settings.autoFill': {
    value: 'Top up automatically',
    contentKey: 'studio_help.merch_settings_auto_fill',
  },
  'studio.merchandising.settings.autoFillHelp': {
    value:
      'When the curated list is short, fill it with the most recently published items of this type. The rule below is shown to whoever asks why a piece appeared. Nothing behavioural, popular or trending exists here.',
    contentKey: 'studio_help.merch_settings_auto_fill_help',
  },
  'studio.merchandising.settings.autoFillRule': {
    value: 'Rule, in words',
    contentKey: 'studio_help.merch_settings_auto_fill_rule',
  },
  'studio.merchandising.settings.fallbackMode': {
    value: 'When the slot is short',
    contentKey: 'studio_help.merch_settings_fallback',
  },
  'studio.merchandising.settings.fallback.EDITORIAL_BLOCK': {
    value: 'Show editorial tiles (media and copy, no products)',
    contentKey: 'studio_help.merch_settings_fallback_editorial',
  },
  'studio.merchandising.settings.fallback.HIDE_SECTION': {
    value: 'Hide the section entirely',
    contentKey: 'studio_help.merch_settings_fallback_hide',
  },
  'studio.merchandising.settings.fallback.SHOW_EMPTY_STATE': {
    value: 'Show the seeded empty-state sentence',
    contentKey: 'studio_help.merch_settings_fallback_empty',
  },
  'studio.merchandising.settings.fallbackSection': {
    value: 'Fallback section id',
    contentKey: 'studio_help.merch_settings_fallback_section',
  },
  'studio.merchandising.settings.fallbackSectionHelp': {
    value:
      'The page section whose media and copy the editorial tiles use. Leave empty for the page’s own material story.',
    contentKey: 'studio_help.merch_settings_fallback_section_help',
  },
  'studio.merchandising.settings.save': {
    value: 'Save settings',
    contentKey: 'studio_help.merch_settings_save',
  },
  'studio.merchandising.preview.heading': {
    value: 'What the public sees now',
    contentKey: 'studio_help.merch_preview_heading',
  },
  'studio.merchandising.preview.provenance.CURATED': {
    value: 'Curated — chosen by a person, in this order',
    contentKey: 'studio_help.merch_preview_curated',
  },
  'studio.merchandising.preview.provenance.RULE_FILLED': {
    value: 'Topped up by rule',
    contentKey: 'studio_help.merch_preview_rule_filled',
  },
  'studio.merchandising.preview.provenance.FALLBACK': {
    value: 'Fallback — the slot is below its minimum',
    contentKey: 'studio_help.merch_preview_fallback',
  },
  'studio.merchandising.preview.unknownSlot': {
    value: 'This slot has no row on this database yet. Run the migrations.',
    contentKey: 'studio_help.merch_preview_unknown',
  },
  'studio.merchandising.preview.empty': {
    value: 'Nothing renders for this slot right now.',
    contentKey: 'studio_help.merch_preview_empty',
  },
  'studio.merchandising.preview.rule': {
    value: 'Rule',
    contentKey: 'studio_help.merch_preview_rule',
  },
  'studio.merchandising.homepage.help': {
    value:
      'The homepage’s two curated bands — Selected Works and the journal strip — plus the hero still and the Selected Works heading. Featured collections live on their own screen.',
    contentKey: 'studio_help.merch_homepage_help',
  },
  'studio.merchandising.homepage.heroHeading': {
    value: 'Homepage hero still',
    contentKey: 'studio_help.merch_homepage_hero_heading',
  },
  'studio.merchandising.homepage.heroHelp': {
    value:
      'Which image the hero paints first, on desktop and on mobile. This edits the hero section itself and needs the content permission; a merchandiser sees the current choice.',
    contentKey: 'studio_help.merch_homepage_hero_help',
  },
  'studio.merchandising.homepage.heroDesktop': {
    value: 'Desktop still',
    contentKey: 'studio_help.merch_homepage_hero_desktop',
  },
  'studio.merchandising.homepage.heroMobile': {
    value: 'Mobile still',
    contentKey: 'studio_help.merch_homepage_hero_mobile',
  },
  'studio.merchandising.homepage.heroNone': {
    value: 'Keep the current image',
    contentKey: 'studio_help.merch_homepage_hero_none',
  },
  'studio.merchandising.homepage.heroSave': {
    value: 'Save hero still',
    contentKey: 'studio_help.merch_homepage_hero_save',
  },
  'studio.merchandising.homepage.headingHeading': {
    value: 'Selected Works heading',
    contentKey: 'studio_help.merch_homepage_heading_heading',
  },
  'studio.merchandising.homepage.headingHelp': {
    value:
      'The heading above the Selected Works band. Editing it is a content change and needs the content permission.',
    contentKey: 'studio_help.merch_homepage_heading_help',
  },
  'studio.merchandising.homepage.headingField': {
    value: 'Heading',
    contentKey: 'studio_help.merch_homepage_heading_field',
  },
  'studio.merchandising.homepage.headingSave': {
    value: 'Save heading',
    contentKey: 'studio_help.merch_homepage_heading_save',
  },
  'studio.merchandising.homepage.noHomepage': {
    value:
      'The homepage has not been seeded on this database, so there is no hero or Selected Works section to edit.',
    contentKey: 'studio_help.merch_homepage_none',
  },
  'studio.merchandising.homepage.featuredNote': {
    value:
      'Featured collections are curated on the Featured screen. This is what the homepage shows now.',
    contentKey: 'studio_help.merch_homepage_featured_note',
  },
  'studio.merchandising.homepage.featuredLink': {
    value: 'Open Featured',
    contentKey: 'studio_help.merch_homepage_featured_link',
  },
  'studio.merchandising.homepage.contentOnly': {
    value: 'Editing this needs the content permission.',
    contentKey: 'studio_help.merch_homepage_content_only',
  },
  'studio.merchandising.store.help': {
    value:
      'The order of the seven categories across the site, and the pieces pinned to the top of each category page.',
    contentKey: 'studio_help.merch_store_help',
  },
  'studio.merchandising.store.orderHeading': {
    value: 'Category order',
    contentKey: 'studio_help.merch_store_order_heading',
  },
  'studio.merchandising.store.orderCaption': {
    value: 'Categories in the order the site presents them',
    contentKey: 'studio_help.merch_store_order_caption',
  },
  'studio.merchandising.store.colCategory': {
    value: 'Category',
    contentKey: 'studio_help.merch_store_col_category',
  },
  'studio.merchandising.store.colOrder': {
    value: 'Order',
    contentKey: 'studio_help.merch_store_col_order',
  },
  'studio.merchandising.store.colStatus': {
    value: 'Status',
    contentKey: 'studio_help.merch_store_col_status',
  },
  'studio.merchandising.store.restore': {
    value: 'Restore recommended order',
    contentKey: 'studio_help.merch_store_restore',
  },
  'studio.merchandising.store.restoreHelp': {
    value:
      'Furniture, Collectible Design, 3D + Resin, Wall & Statement Art, Preservation, Décor, Gifts — the SEED §13 order, which is also the content priority.',
    contentKey: 'studio_help.merch_store_restore_help',
  },
  'studio.merchandising.store.priorityWarning': {
    value:
      'This order puts Gifts or Décor above Furniture. The content priority (SEED §56) is large-format furniture first and gifts last, so the site does not drift back into small gift-store positioning. You can save anyway.',
    contentKey: 'studio_help.merch_store_priority_warning',
  },
  'studio.merchandising.store.priorityConfirm': {
    value: 'Move anyway',
    contentKey: 'studio_help.merch_store_priority_confirm',
  },
  'studio.merchandising.store.pinnedHeading': {
    value: 'Pinned pieces',
    contentKey: 'studio_help.merch_store_pinned_heading',
  },
  'studio.merchandising.store.pinnedHelp': {
    value:
      'Each category page shows its pinned pieces above the grid on its default view. The grid itself is untouched.',
    contentKey: 'studio_help.merch_store_pinned_help',
  },
  'studio.merchandising.store.noSlot': {
    value:
      'This category has no pinned slot yet. It is created with the category; run the migrations.',
    contentKey: 'studio_help.merch_store_no_slot',
  },
  'studio.merchandising.featured.help': {
    value:
      'Which published collections and categories are featured on the homepage, and which pieces and collections lead the store. Collections still in concept cannot be featured.',
    contentKey: 'studio_help.merch_featured_help',
  },
  'studio.merchandising.scheduling.help': {
    value:
      'Every slot and entry window in one calendar. A gap is a day a slot falls below its minimum and shows its fallback; an overflow is a day more entries are live than the slot shows.',
    contentKey: 'studio_help.merch_scheduling_help',
  },
  'studio.merchandising.scheduling.month': {
    value: 'Month',
    contentKey: 'studio_help.merch_scheduling_month',
  },
  'studio.merchandising.scheduling.previous': {
    value: 'Previous month',
    contentKey: 'studio_help.merch_scheduling_previous',
  },
  'studio.merchandising.scheduling.next': {
    value: 'Next month',
    contentKey: 'studio_help.merch_scheduling_next',
  },
  'studio.merchandising.scheduling.caption': {
    value: 'Live entries per slot per day',
    contentKey: 'studio_help.merch_scheduling_caption',
  },
  'studio.merchandising.scheduling.colSlot': {
    value: 'Slot',
    contentKey: 'studio_help.merch_scheduling_col_slot',
  },
  'studio.merchandising.scheduling.gap': {
    value: 'Below minimum',
    contentKey: 'studio_help.merch_scheduling_gap',
  },
  'studio.merchandising.scheduling.over': {
    value: 'Above maximum',
    contentKey: 'studio_help.merch_scheduling_over',
  },
  'studio.merchandising.scheduling.ok': {
    value: 'Within range',
    contentKey: 'studio_help.merch_scheduling_ok',
  },
  'studio.merchandising.scheduling.warningsHeading': {
    value: 'Warnings this month',
    contentKey: 'studio_help.merch_scheduling_warnings',
  },
  'studio.merchandising.scheduling.noWarnings': {
    value: 'No gaps or overflows this month.',
    contentKey: 'studio_help.merch_scheduling_no_warnings',
  },
  'studio.merchandising.scheduling.windowsHeading': {
    value: 'Windows this month',
    contentKey: 'studio_help.merch_scheduling_windows',
  },
  'studio.merchandising.scheduling.windowsCaption': {
    value: 'Entries whose window opens or closes this month',
    contentKey: 'studio_help.merch_scheduling_windows_caption',
  },
  'studio.merchandising.scheduling.noWindows': {
    value: 'No entry opens or closes this month.',
    contentKey: 'studio_help.merch_scheduling_no_windows',
  },
  'studio.merchandising.scheduling.colEntry': {
    value: 'Entry',
    contentKey: 'studio_help.merch_scheduling_col_entry',
  },
  'studio.merchandising.scheduling.colOpens': {
    value: 'Opens',
    contentKey: 'studio_help.merch_scheduling_col_opens',
  },
  'studio.merchandising.scheduling.colCloses': {
    value: 'Closes',
    contentKey: 'studio_help.merch_scheduling_col_closes',
  },
  'studio.merchandising.scheduling.jump': {
    value: 'Open editor',
    contentKey: 'studio_help.merch_scheduling_jump',
  },
  'studio.merchandising.scheduling.gapDays': {
    value: 'days below minimum',
    contentKey: 'studio_help.merch_scheduling_gap_days',
  },
  'studio.merchandising.scheduling.overDays': {
    value: 'days above maximum',
    contentKey: 'studio_help.merch_scheduling_over_days',
  },
  'studio.merchandising.refusal.slotOwner': {
    value: 'That slot is edited from a different screen.',
    contentKey: 'studio_help.merch_refusal_owner',
  },
  'studio.merchandising.refusal.type': {
    value: 'That slot does not accept that kind of entry.',
    contentKey: 'studio_help.merch_refusal_type',
  },
  'studio.merchandising.refusal.concept': {
    value: 'That collection is still a concept and cannot be featured.',
    contentKey: 'studio_help.merch_refusal_concept',
  },
  'studio.merchandising.refusal.missing': {
    value: 'That item could not be found.',
    contentKey: 'studio_help.merch_refusal_missing',
  },
  'studio.merchandising.refusal.duplicate': {
    value: 'That item is already in this slot.',
    contentKey: 'studio_help.merch_refusal_duplicate',
  },
  'studio.merchandising.refusal.window': {
    value: 'The window must close after it opens.',
    contentKey: 'studio_help.merch_refusal_window',
  },
  'studio.merchandising.refusal.rule': {
    value: 'Topping up automatically needs a rule written in words.',
    contentKey: 'studio_help.merch_refusal_rule',
  },
  'studio.merchandising.refusal.range': {
    value: 'The minimum must be at least one and the maximum at least the minimum.',
    contentKey: 'studio_help.merch_refusal_range',
  },
  'studio.merchandising.refusal.generic': {
    value: 'That change could not be saved.',
    contentKey: 'studio_help.merch_refusal_generic',
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
