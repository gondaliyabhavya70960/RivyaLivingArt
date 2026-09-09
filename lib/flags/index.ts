import 'server-only'

import { cache } from 'react'

import { createAdminClient } from '@/lib/supabase/admin'
import { listFeatureFlags } from '@/lib/supabase/repositories/flags'

import { FLAGS, type FeatureFlagKey } from './flags'

export { FLAGS, FLAG_KEYS, isRegisteredFlag } from './flags'
export type { FeatureFlagKey } from './flags'

/**
 * `isEnabled(flag)` — the only way anything asks whether a feature is on.
 *
 * SERVER-SIDE ONLY, AND THE `server-only` IMPORT IS THE ENFORCEMENT. FEAT §32's flags gate whole
 * features, and a flag evaluated in the browser is a flag the browser can be told to ignore: the
 * markup for a switched-off feature would ship in the bundle and a devtools breakpoint would reveal
 * it. Server-side evaluation means an off feature does not exist in the response at all.
 *
 * IT USES THE SERVICE-ROLE CLIENT, WHICH IS A DECISION RATHER THAN A CONVENIENCE.
 * `feature_flags` is shape C: no anon policy, because publishing it would hand every visitor the
 * list of features being prepared and the date each one was switched. But the first consumer is
 * `/custom-commissions`, a PUBLIC route with no session at all — so there is no user whose
 * permissions could be checked, and the anon client cannot read the table by design. This module is
 * therefore on the `eslint.config.mjs` allowlist, and the seam is deliberately narrow: it exports a
 * boolean and never the client, so nothing downstream inherits the ability to bypass RLS.
 *
 * ABSENT MEANS OFF. `feature_flags` holds only the flags somebody has touched, so a fresh database,
 * a restored backup and a preview branch all behave identically without anyone seeding a row. The
 * failure path agrees with that default: if the read throws, every flag reads false. A feature that
 * cannot be confirmed switched on is off, because the alternative is a database blip putting an
 * unfinished surface on the public site.
 *
 * `cache()` SCOPES ONE READ TO ONE REQUEST. A page asking about two flags, or a layout and a page
 * each asking about one, makes a single round trip. It is React's per-request cache rather than a
 * module-level variable on purpose: a module-level cache on a long-lived server would keep serving
 * the old answer after the owner moved the switch, which is exactly the moment the answer matters.
 */
const readFlags = cache(async (): Promise<ReadonlyMap<string, boolean>> => {
  try {
    const rows = await listFeatureFlags(createAdminClient())
    return new Map(rows.map((row) => [row.key, row.is_enabled]))
  } catch {
    // Deliberately swallowed and deliberately not logged with the error: this runs on every public
    // render, and a failing database would otherwise write one line per request. The observable
    // consequence — every feature reading off — is the safe one and is visible in the Studio, where
    // the flags screen surfaces the same failure with the reason attached.
    return new Map()
  }
})

/**
 * Is this feature switched on?
 *
 * The parameter is `FeatureFlagKey`, so a typo does not compile and a removed flag breaks its call
 * sites — which is why the register lives in `flags.ts` and not in the table.
 */
export async function isEnabled(flag: FeatureFlagKey): Promise<boolean> {
  const flags = await readFlags()
  return flags.get(flag) === true
}

/**
 * Every registered flag with its current state, for `/studio/system/flags`.
 *
 * Built from the REGISTER rather than from the rows, so a flag nobody has touched still appears —
 * off, with its description — instead of being invisible until someone switches it. A row naming a
 * key that is no longer registered is a leftover from a removed feature and is simply not listed.
 */
export async function flagStates(): Promise<
  readonly { key: FeatureFlagKey; description: string; isEnabled: boolean }[]
> {
  const flags = await readFlags()
  return (Object.keys(FLAGS) as FeatureFlagKey[]).map((key) => ({
    key,
    description: FLAGS[key],
    isEnabled: flags.get(key) === true,
  }))
}
