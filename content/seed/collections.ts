import { section } from './section'
import type { SeedModule, SeedRecord } from './types'

/**
 * The `/collection` landing (SEED §13) and the seven category pages (§14).
 *
 * THIS MODULE CREATES `pages` ROWS AS WELL AS SECTIONS. Phase 08's `pages.ts` seeds the thirteen
 * static D3 routes; the seven `/collection/<slug>` pages are category surfaces and belong with the
 * category copy that fills them. Together they make the twenty rows verification step 2 counts.
 * The page rows come first in the array because their sections reference them by `seed_key`, and
 * the runner resolves a ref by looking it up — a forward reference finds nothing and fails.
 *
 * THE ORDER IS D3's AND SEED §56's, AND IT IS A DECISION. Furniture, Collectible Design,
 * 3D + Resin, Wall & Statement Art, Preservation, Décor, Gifts. §56 makes the point explicitly:
 * the positioning must not drift toward gifts and décor merely because those families happen to
 * have plenty of assets. `navigation.ts` encodes the same order for the menu and a test asserts
 * both, so the two cannot come apart.
 *
 * THREE CATEGORY DESCRIPTIONS ARE FLAGGED, and one of them is a judgement call worth stating:
 *
 *   3D + RESIN — §14 marks it outright.
 *   PRESERVATION — §14 warns "do not make preservation-longevity claims beyond what is
 *     supportable", and the seeded description says pieces are turned into "lasting resin
 *     objects". "Lasting" is a durability claim, which D10 lists by name.
 *   COLLECTIBLE DESIGN — §14 warns "do not imply limited edition unless actual product supports
 *     it", and the seeded description opens with "Limited, experimental and sculptural pieces".
 *     The phase document's policy table does not list this one; the specification's own warning
 *     does, and the safer reading of a warning is the one that refuses to publish. Flagged.
 *
 * The page ROWS are not flagged and are published: a page row is an address, and a route that
 * 404s tells a visitor the wrong thing. The claims are in the sections, which carry the flags and
 * which `cms_publish_section` refuses until the owner clears them.
 */

/** D3 and SEED §56 priority order. Position is spaced by ten, as everywhere else. */
const CATEGORIES: readonly {
  slug: string
  title: string
  heading: string
  description: string
  verify?: boolean
  note?: string
}[] = [
  {
    slug: 'furniture',
    title: 'Furniture',
    heading: 'Furniture with material at its centre.',
    description:
      'Tables, seating and functional objects where resin, natural material and form become part of one composition.',
  },
  {
    slug: 'collectible-design',
    title: 'Collectible Design',
    heading: 'Functional pieces conceived as objects of design.',
    description:
      'Limited, experimental and sculptural pieces that explore stronger silhouettes, unusual material relationships and expressive form.',
    verify: true,
    note: '§14: do not imply limited edition unless actual product supports it. This copy opens with "Limited".',
  },
  {
    slug: '3d-resin',
    title: '3D + Resin',
    heading: 'Digital form meets fluid material.',
    description:
      'An experimental category exploring how 3D-fabricated geometry and resin can interact in furniture, sculpture and functional objects.',
    verify: true,
    note: '§14 marks this one explicitly.',
  },
  {
    slug: 'wall-statement-art',
    title: 'Wall & Statement Art',
    heading: 'Art with depth, light and material presence.',
    description:
      'Resin panels, sculptural wall pieces and large-format compositions developed to create visual focus within an interior.',
  },
  {
    slug: 'preservation',
    title: 'Preservation',
    heading: 'Objects designed to hold what matters.',
    description:
      'Preservation pieces transform meaningful flowers, keepsakes and memories into lasting resin objects.',
    verify: true,
    note: '§14: do not make preservation-longevity claims beyond what is supportable. "Lasting" is one.',
  },
  {
    slug: 'decor',
    title: 'Décor',
    heading: 'Material details for everyday spaces.',
    description:
      "Smaller functional and decorative pieces carrying Rivya's resin-led visual language into the home.",
  },
  {
    slug: 'gifts',
    title: 'Gifts',
    heading: 'Personal, made with intention.',
    description:
      'Customizable resin objects for meaningful gifting, celebrations and personal occasions.',
  },
]

const categoryPage = (slug: string, title: string): SeedRecord => ({
  seedKey: `page:collection.${slug}`,
  table: 'pages',
  fields: {
    slug: `collection-${slug}`,
    path: `/collection/${slug}`,
    title,
    kind: 'CATEGORY',
    is_system: false,
    // Published for the same reason the Phase 08 shells are: a route that 404s says the site has
    // no such page, when what is true is that its copy is not approved yet.
    status: 'PUBLISHED',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: 'NOT_REQUIRED',
  },
})

export const collectionsSeed: SeedModule = {
  name: 'collections',
  description: 'The /collection landing (§13) and the seven category pages (§14), in D3 order.',
  records: [
    // --- the seven page rows, before anything references them -----------------------------------
    ...CATEGORIES.map((c) => categoryPage(c.slug, c.title)),

    // --- §13 the landing ------------------------------------------------------------------------
    section({
      page: 'page:collection',
      key: 'collection.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'COLLECTION',
      heading: 'Functional objects. Material stories.',
      body: 'Explore Rivya across furniture, collectible design, statement art and smaller resin objects.',
      fact: 'BRAND_COPY',
      layoutVariant: 'contained',
      payload: { is_video: false, autoplay: false, scrim: 35 },
    }),
    section({
      page: 'page:collection',
      key: 'collection.02.order',
      blockType: 'category-grid',
      position: 2,
      fact: 'BRAND_COPY',
      /**
       * §13's "COLLECTION ORDER" is the seven categories in priority order, and it is editable
       * from Store Merchandising. Seeded as cards so the landing has something to show before any
       * product exists; the cards carry no description, because §14's descriptions belong to the
       * category pages and restating them here would be two places to edit one sentence.
       */
      payload: {
        columns: 3,
        cards: CATEGORIES.map((c) => ({
          title: c.title,
          description: '',
          href: `/collection/${c.slug}`,
          media_index: null,
        })),
        media: [],
      },
    }),

    // --- §14 one hero per category page ---------------------------------------------------------
    ...CATEGORIES.map((c, i) =>
      section({
        page: `page:collection.${c.slug}`,
        key: `collection.${c.slug}.01.hero`,
        blockType: 'hero',
        position: 1,
        eyebrow: c.title.toUpperCase(),
        heading: c.heading,
        body: c.description,
        fact: 'BRAND_COPY',
        verify: c.verify === true,
        layoutVariant: 'contained',
        payload: { is_video: false, autoplay: false, scrim: 35, priority: (i + 1) * 10 },
      }),
    ),
  ],
}
