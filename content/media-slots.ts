import type { AspectRatio } from '@/lib/media/types'

/**
 * Every media slot the public site declares, and which part of the library can fill it.
 *
 * WHY A REGISTRY AND NOT A QUERY. "Which slots have no asset" cannot be answered by looking at the
 * assets — an absent slot and an unfilled slot look identical from that side. The only way to know
 * that `/contact` needs a hero is for something to SAY so, before any content exists. This file is
 * that statement, and `lib/media/gaps.ts` joins it against what the library actually holds.
 *
 * IT IS NOT THE CMS. Phase 08 creates `page_sections` and Phase 09 seeds them; a slot here is the
 * DESIGN's claim that a surface needs a picture, which is a different and earlier thing than a row
 * saying which picture. When the CMS exists, `media_usages` records the binding and `slotKey` is
 * how the two meet.
 *
 * `fillableBy` IS DELIBERATELY EMPTY ON SOME SLOTS. An empty list is not an oversight — it is the
 * statement that nothing in the 250-asset library can fill this slot, which is what makes it a gap
 * rather than merely unbound. Those lists are derived from the manifest's own family distribution
 * (see the counts in each comment), not guessed.
 */

/**
 * What should happen about a slot the library cannot fill.
 *
 * The distinction matters more than it looks. `GENERATE` earns a brief in the master plan;
 * `EMPTY_STATE` must never get one, because filling it would mean inventing business facts — a
 * portfolio of delivered projects Rivya has not been confirmed to have done (D10). A gap engine
 * that reported both the same way would eventually produce a brief for fake client work.
 */
export type GapResolution = 'GENERATE' | 'EMPTY_STATE'

export type MediaSlot = {
  /** Stable key. Becomes `media_usages.slot_key` when Phase 08 binds an asset. */
  readonly key: string
  /** The D3 public route this slot appears on. */
  readonly page: string
  /** Human label for the Gaps tab. Copy, so it moves to the CMS with everything else later. */
  readonly label: string
  readonly kind: 'IMAGE' | 'VIDEO'
  /** D6 keeps desktop and mobile as separate slots; these are the ratios each expects. */
  readonly desktopRatio: AspectRatio
  readonly mobileRatio: AspectRatio
  /**
   * Manifest families whose assets could fill this slot. Empty means nothing can.
   * `lib/media/gaps.ts` counts real assets in these families rather than trusting a number here.
   */
  readonly fillableBy: readonly string[]
  /**
   * How many assets the slot needs to be considered covered rather than thin. Two where a surface
   * needs a desktop AND a mobile asset — D6 makes those separate slots, so one asset cannot serve
   * both without being cropped into a shape it was not composed for.
   */
  readonly minAssets: number
  /** What to do if `fillableBy` yields nothing. */
  readonly resolution: GapResolution
}

export const MEDIA_SLOTS: readonly MediaSlot[] = [
  // --- / ------------------------------------------------------------------------------------
  // The manifest has 5 assets on `page = home`, all `interior-lifestyle`, and all STILLS. There is
  // no home video at all, which is why both the hero and its poster are gaps rather than one.
  {
    key: 'home.hero.video',
    page: '/',
    label: 'Home hero video',
    kind: 'VIDEO',
    desktopRatio: '21:9',
    mobileRatio: '9:16',
    fillableBy: [],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    // A poster is the frame a visitor sees before the video plays, and under reduced motion it is
    // the whole experience. It cannot be an unrelated still: it must be the video's own opening.
    // So it is a gap for as long as the video is, and filling it independently would be wrong.
    key: 'home.hero.poster',
    page: '/',
    label: 'Home hero poster',
    kind: 'IMAGE',
    desktopRatio: '21:9',
    mobileRatio: '9:16',
    fillableBy: [],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'home.intro',
    page: '/',
    label: 'Home introduction band',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['interior-lifestyle'], // 5 assets
    minAssets: 2,
    resolution: 'GENERATE',
  },

  // --- /collection and its seven D3 categories -----------------------------------------------
  {
    // The manifest has per-CATEGORY pages and nothing for the landing surface above them.
    key: 'collection.landing.hero',
    page: '/collection',
    label: 'Collection landing hero',
    kind: 'IMAGE',
    desktopRatio: '21:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    // D3's first category, and the library has no family for it. Furniture is the most commercially
    // important surface on the site and the least covered — worth seeing at the top of a gap list.
    key: 'collection.furniture.hero',
    page: '/collection/furniture',
    label: 'Furniture category hero and cards',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 4,
    resolution: 'GENERATE',
  },
  {
    key: 'collection.collectible-design.hero',
    page: '/collection/collectible-design',
    label: 'Collectible design category hero and cards',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 4,
    resolution: 'GENERATE',
  },
  {
    key: 'collection.3d-resin.hero',
    page: '/collection/3d-resin',
    label: '3D resin category',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['three-d-resin'], // 13
    minAssets: 4,
    resolution: 'GENERATE',
  },
  {
    key: 'collection.wall-statement-art.hero',
    page: '/collection/wall-statement-art',
    label: 'Wall statement art category',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['wall-art'], // 20
    minAssets: 4,
    resolution: 'GENERATE',
  },
  {
    key: 'collection.preservation.hero',
    page: '/collection/preservation',
    label: 'Preservation category',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['preservation-varmala', 'preservation-keepsake'], // 15 + 4
    minAssets: 4,
    resolution: 'GENERATE',
  },
  {
    key: 'collection.decor.hero',
    page: '/collection/decor',
    label: 'Decor category',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['decor'], // 18
    minAssets: 4,
    resolution: 'GENERATE',
  },
  {
    key: 'collection.gifts.hero',
    page: '/collection/gifts',
    label: 'Gifts category',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['gifts'], // 10
    minAssets: 4,
    resolution: 'GENERATE',
  },

  // --- /large-format --------------------------------------------------------------------------
  // Six families, two of which hold a single asset each. A single asset cannot serve a desktop and
  // a mobile slot both — D6 makes those separate — so `minAssets: 2` marks them THIN rather than
  // covered, which is exactly the state the phase document describes.
  {
    key: 'large-format.architectural',
    page: '/large-format',
    label: 'Large format — architectural',
    kind: 'IMAGE',
    desktopRatio: '21:9',
    mobileRatio: '4:5',
    fillableBy: ['largeformat-monumental'], // 1 — thin, and no 4:5 mobile variant exists
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'large-format.coffee',
    page: '/large-format',
    label: 'Large format — coffee tables',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['largeformat-coffee'], // 1 — thin
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'large-format.dining',
    page: '/large-format',
    label: 'Large format — dining',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['largeformat-dining'], // 5
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'large-format.seating',
    page: '/large-format',
    label: 'Large format — seating',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['largeformat-seating'], // 4
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'large-format.console',
    page: '/large-format',
    label: 'Large format — console',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['largeformat-console'], // 4
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'large-format.side',
    page: '/large-format',
    label: 'Large format — side tables',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['largeformat-side'], // 3
    minAssets: 2,
    resolution: 'GENERATE',
  },

  // --- the well-covered surfaces ---------------------------------------------------------------
  {
    key: 'about.hero',
    page: '/about',
    label: 'About hero and material studies',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['material-macro'], // 39
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'process.sections',
    page: '/process',
    label: 'Process — the seven stages',
    kind: 'IMAGE',
    desktopRatio: '4:3',
    mobileRatio: '4:5',
    // 79 across seven families, the best-covered surface on the site.
    fillableBy: [
      'process-studio',
      'process-pigment',
      'process-mould',
      'process-pour',
      'process-cure',
      'process-finish',
      'process-timber',
    ],
    minAssets: 7,
    resolution: 'GENERATE',
  },
  {
    key: 'journal.cover',
    page: '/journal',
    label: 'Journal article covers',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['editorial', 'workshop-session'], // 19 + 5 = 24, against 10 seeded drafts
    minAssets: 10,
    resolution: 'GENERATE',
  },

  // --- /portfolio: a gap that must NEVER be filled by generation --------------------------------
  {
    // The 5 `gallery-scene` assets are atmosphere, not projects. A portfolio entry asserts that
    // Rivya DELIVERED a piece to a client, and generating an image of one would fabricate exactly
    // the class of business fact D10 forbids. So the resolution is an empty state, and the master
    // plan must never carry a brief for it.
    key: 'portfolio.project',
    page: '/portfolio',
    label: 'Portfolio project media',
    kind: 'IMAGE',
    desktopRatio: '4:3',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 1,
    resolution: 'EMPTY_STATE',
  },

  // --- the utility surfaces, all uncovered ------------------------------------------------------
  {
    key: 'custom-commissions.hero',
    page: '/custom-commissions',
    label: 'Custom commissions hero',
    kind: 'IMAGE',
    desktopRatio: '21:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'custom-commissions.supporting',
    page: '/custom-commissions',
    label: 'Custom commissions supporting imagery',
    kind: 'IMAGE',
    desktopRatio: '4:3',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    key: 'contact.hero',
    page: '/contact',
    label: 'Contact surface',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 1,
    resolution: 'GENERATE',
  },
  {
    key: 'faq.hero',
    page: '/faq',
    label: 'FAQ surface',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 1,
    resolution: 'GENERATE',
  },
  {
    key: 'search.empty',
    page: '/search',
    label: 'Search empty state',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 1,
    resolution: 'GENERATE',
  },
]

/** Every page carrying at least one declared slot. */
export const SLOT_PAGES: readonly string[] = [...new Set(MEDIA_SLOTS.map((s) => s.page))]
