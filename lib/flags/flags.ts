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
