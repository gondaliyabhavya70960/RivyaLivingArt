import { aboutSeed } from './about'
import { carouselUiSeed } from './carousel-ui'
import { sectionRailUiSeed } from './section-rail-ui'
import { catalogUiSeed } from './catalog-ui'
import { productDetailUiSeed } from './product-detail-ui'
import { collectionConceptsSeed } from './collection-concepts'
import { collectionsSeed } from './collections'
import { commerceLabelsSeed } from './commerce-labels'
import { commissionsSeed } from './commissions'
import { configuratorUiSeed } from './configurator-ui'
import { inquiryUiSeed } from './inquiry-ui'
import { contactSeed } from './contact'
import { faqSeed } from './faq'
import { globalSeed } from './global'
import { globalContentSeed } from './global-content'
import { homepageSeed } from './homepage'
import { journalSeed } from './journal'
import { journalUiSeed } from './journal-ui'
import { largeFormatSeed } from './large-format'
import { merchandisingUiSeed } from './merchandising-ui'
import { modelViewerUiSeed } from './model-viewer-ui'
import { navigationSeed } from './navigation'
import { pagesSeed } from './pages'
import { portfolioSeed } from './portfolio'
import { portfolioUiSeed } from './portfolio-ui'
import { processSeed } from './process'
import { searchUiSeed } from './search-ui'
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
  // The ten FEAT §9 concepts. Taxonomy, not content: they reference nothing and a `collections`
  // row is what `product_collections` and the `?collection=` facet point at, so they sit with the
  // categories rather than with the page copy. Nothing here creates a page — an exhibition page is
  // made in Studio, one collection at a time, by a person who has decided the collection is real.
  collectionConceptsSeed,
  pagesSeed,
  // Global strings: reference nothing.
  globalContentSeed,
  globalSeed,
  commerceLabelsSeed,
  studioHelpSeed,
  // Phase 10's shell strings. Reference nothing, so they sit with the other global modules.
  siteChromeSeed,
  // Phase 14's listing controls. Reference nothing either, so they sit with the shell strings.
  catalogUiSeed,
  // Phase 15's product-page words, for the same reason.
  productDetailUiSeed,
  // Phase 45's carousel names — four accessible names, referencing nothing.
  carouselUiSeed,
  // A48's section rail — one landmark name, referencing nothing.
  sectionRailUiSeed,
  // Phase 17's project-gallery and testimonial words, for the same reason again.
  portfolioUiSeed,
  // Phase 21's viewer words. Reference nothing; every one is an accessible name or a notice.
  modelViewerUiSeed,
  merchandisingUiSeed,
  // Phase 23's search and relationship words. Reference nothing: five group headings, the
  // near-match band, three count sentences, the combobox instructions and the four rule reasons.
  searchUiSeed,
  navigationSeed,
  seoSeed,
  // Page content: every section references a page by seed_key.
  homepageSeed,
  aboutSeed,
  largeFormatSeed,
  // collections creates the seven CATEGORY pages before the sections that sit on them.
  collectionsSeed,
  // The configurator's chrome before the templates that will be rendered inside it. Order is not
  // load-bearing here — neither references the other — but reading order should match the page's.
  configuratorUiSeed,
  inquiryUiSeed,
  commissionsSeed,
  processSeed,
  portfolioSeed,
  journalUiSeed,
  journalSeed,
  contactSeed,
  faqSeed,
]

/** Every seed key across every module. Used by the runner's duplicate check. */
export function allSeedKeys(): string[] {
  return seedModules.flatMap((module) => module.records.map((record) => record.seedKey))
}
