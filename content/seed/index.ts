import { aboutSeed } from './about'
import { collectionsSeed } from './collections'
import { commerceLabelsSeed } from './commerce-labels'
import { commissionsSeed } from './commissions'
import { contactSeed } from './contact'
import { faqSeed } from './faq'
import { globalSeed } from './global'
import { globalContentSeed } from './global-content'
import { homepageSeed } from './homepage'
import { journalSeed } from './journal'
import { largeFormatSeed } from './large-format'
import { navigationSeed } from './navigation'
import { pagesSeed } from './pages'
import { portfolioSeed } from './portfolio'
import { processSeed } from './process'
import { seoSeed } from './seo'
import { siteChromeSeed } from './site-chrome'
import { studioHelpSeed } from './studio-help'
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
  // Referenced by everything else, so first.
  taxonomySeed,
  pagesSeed,
  // Global strings: reference nothing.
  globalContentSeed,
  globalSeed,
  commerceLabelsSeed,
  studioHelpSeed,
  // Phase 10's shell strings. Reference nothing, so they sit with the other global modules.
  siteChromeSeed,
  navigationSeed,
  seoSeed,
  // Page content: every section references a page by seed_key.
  homepageSeed,
  aboutSeed,
  largeFormatSeed,
  // collections creates the seven CATEGORY pages before the sections that sit on them.
  collectionsSeed,
  commissionsSeed,
  processSeed,
  portfolioSeed,
  journalSeed,
  contactSeed,
  faqSeed,
]

/** Every seed key across every module. Used by the runner's duplicate check. */
export function allSeedKeys(): string[] {
  return seedModules.flatMap((module) => module.records.map((record) => record.seedKey))
}
