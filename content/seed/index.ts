import { commerceLabelsSeed } from './commerce-labels'
import { globalSeed } from './global'
import { globalContentSeed } from './global-content'
import { homepageSeed } from './homepage'
import { navigationSeed } from './navigation'
import { pagesSeed } from './pages'
import { taxonomySeed } from './taxonomy'
import type { SeedModule } from './types'

export type { SeedModule, SeedRecord, SeedableTable } from './types'

/**
 * The seed registry.
 *
 * Phase 09 adds modules HERE and nowhere else. The runner reads this list and knows nothing about
 * any particular module — that is the arrangement that lets website copy change without a change
 * to the machine that writes it.
 *
 * Order matters where one module's rows reference another's. Nothing here does yet: `pages` seeds
 * route shells with no sections, and `global-content` seeds strings nothing joins to. Phase 09's
 * section modules WILL reference `pages`, so they belong after `pagesSeed` when they arrive.
 */
/**
 * ORDER IS THE REF CONTRACT. A record may only reference a row written by an EARLIER module, or
 * earlier within its own module — the runner resolves `refs` by looking the `seed_key` up in the
 * database, so a forward reference finds nothing and fails the record with a message saying so.
 *
 * Hence: taxonomy and pages first (everything else points at them), then the global string
 * modules (which reference nothing), then the page content modules, which all reference `pages`.
 */
export const seedModules: readonly SeedModule[] = [
  taxonomySeed,
  pagesSeed,
  globalContentSeed,
  globalSeed,
  commerceLabelsSeed,
  navigationSeed,
  homepageSeed,
]

/** Every seed key across every module. Used by the runner's duplicate check. */
export function allSeedKeys(): string[] {
  return seedModules.flatMap((module) => module.records.map((record) => record.seedKey))
}
