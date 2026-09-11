/**
 * The register of feature flags. FEAT §32.
 *
 * THE REGISTER IS HERE AND NOT IN THE DATABASE, and that is the decision this file exists to make
 * explicit. A flag key is an IDENTIFIER — call sites spell it out as
 * `isEnabled('commission_configurator')` — so it belongs where deleting one breaks its callers at
 * compile time. A table of registered flags cannot do that: it would drift from the code, and the
 * failure mode is a Studio screen offering the owner a switch that controls nothing.
 *
 * `feature_flags` therefore holds only the flags somebody has actually TOUCHED. A flag with no row
 * is off, which makes a fresh database, a restored backup and a Vercel preview branch behave
 * identically without anyone remembering to seed anything.
 *
 * FEAT §32 ALSO CARRIES A WARNING WORTH KEEPING IN VIEW: a flag is "not a substitute for proper
 * configuration". Nothing an editor should be able to change belongs here — that is `global_content`
 * and the Studio settings screens. A flag answers one question only: has this FEATURE been built,
 * verified and switched on. Which is why every entry below names the phase that consumes it, and
 * why adding one without a consumer would be adding a switch to nothing.
 */

/**
 * Every flag, with what it gates. Adding a key here makes it appear at `/studio/system/flags`;
 * nothing else is needed, and nothing else may invent one.
 */
export const FLAGS = {
  /**
   * Phase 19 builds the configurator; Phase 20 persists the inquiry and hands off to WhatsApp.
   * Until the second half exists, a visitor completing eleven steps would reach a Submit button
   * that saves nothing — so this ships OFF and `/custom-commissions` keeps its Phase 09 copy.
   * Phase 20's exit criteria are what turn it on.
   */
  commission_configurator:
    'Shows the multi-step bespoke brief on /custom-commissions in place of the static copy. Requires Phase 20 before it can be switched on: without it a completed brief is not saved.',
  /**
   * Phase 21. Named `three_d_viewer` rather than `3d_viewer` because a key must be a legal
   * identifier — DATA_MODEL registers it under this spelling and the database CHECK requires a
   * leading letter.
   */
  three_d_viewer:
    'Mounts the 3D model viewer on product pages that have a model. Off until Phase 21 ships the viewer and its explicit intent gate.',
  /**
   * Phase 25. THE MASTER KILL SWITCH for the whole research subsystem (FEAT §32), checked by the
   * drain loop before EVERY fetch rather than once per tick — a switch that takes effect at the
   * end of the current batch is a switch that keeps fetching for another minute after the owner
   * threw it.
   *
   * OFF IN EVERY ENVIRONMENT UNTIL A SOURCE IS POLICY-APPROVED, which is not a deployment step
   * anybody has to remember: a flag with no row reads false, and this repository seeds no row and
   * no source. Named `research_enabled` rather than the phase document's `research.enabled` for
   * the reason `three_d_viewer` is not `3d_viewer` — a key must be a legal identifier, and the
   * database CHECK enforces it.
   */
  research_enabled:
    'Allows the research cron to fetch anything at all. Off until the owner has approved a source, and the fastest way to stop every source at once.',
  /**
   * Phase 33. The fetch-to-hash amendment the phase document raised as open question 12. THE
   * OWNER DECIDED AGAINST IT (amendment A33): competitor images are referenced by URL and never
   * fetched, so nothing in the repository reads this flag to start a fetch — it exists so the
   * decision is visible at /studio/system/flags, with its reason, rather than implied by absence.
   */
  research_image_hashing:
    'Would allow competitor image URLs to be fetched once and reduced to a 64-bit hash. The owner decided that competitor images are referenced by URL only and never fetched (amendment A33); no code path in the repository fetches one, whatever this flag says.',
  /**
   * Phase 33. Embedding-based FORM_SIMILAR pairs. Unreachable: the embedding path is not built,
   * because it would need competitor bytes the owner has decided are never fetched.
   */
  advanced_similarity:
    'Would enable embedding-based FORM_SIMILAR pairs (low precision, flag-gated by design). Not built under amendment A33; the Studio says so.',
  /**
   * Phase 35. The hand-operated bridge from a CONFIRMED research row to an empty DRAFT product.
   * OFF until the owner accepts the narrowing of invariant I4 the phase document proposes as open
   * question 11 (recorded as amendment A35, proposed). While off, /studio/research/confirmed renders
   * the button disabled with the reason, and a direct POST is refused with the flag reason.
   */
  research_product_bridge:
    'Allows a person holding catalog.write to start an EMPTY draft product (typed slug, chosen category, nothing else) from a confirmed research row. Off until the owner accepts the proposed narrowing of invariant I4 (amendment A35).',
  /**
   * Phase 36. The one-way Google Sheets export. Off, the Sheets page renders every definition
   * read-only and every run — Studio, CLI, cron — is refused with FLAG_OFF before any network call.
   * On requires GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEETS_SPREADSHEET_ID to be set and the
   * spreadsheet shared with the service-account email the page shows.
   */
  google_sheets:
    'Writes export definitions to Google Sheets tabs (one-way; Rivya writes, the sheet reads). Off until the owner has created the service account, shared the spreadsheet with it and set the two variables.',
  /**
   * Phase 37. Gates the competitive block ("The market", metrics 9–18) and the trend lines on the
   * Analytics tab. Off, the tab renders the eight first-party tiles and no market section; the
   * RLS predicate on `analytics_snapshots` still decides who may READ a competitive row, so the
   * flag is presentation, never the access control.
   */
  advanced_analytics:
    'Shows the competitive section and trend lines on the Studio Analytics tab. Off until the owner has a research corpus worth reading; research.read still gates every competitive row regardless.',
} as const satisfies Record<string, string>

export type FeatureFlagKey = keyof typeof FLAGS

export const FLAG_KEYS = Object.keys(FLAGS) as FeatureFlagKey[]

/**
 * Is this string one of the registered keys?
 *
 * Used at the two places a key arrives as data rather than as a literal: the Studio toggle's form
 * payload, and a row read back from `feature_flags`. A row naming a flag that no longer exists in
 * the register is not an error to raise at the visitor — it is a leftover from a removed feature,
 * and the Studio screen simply does not list it.
 */
export function isRegisteredFlag(key: string): key is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(FLAGS, key)
}
