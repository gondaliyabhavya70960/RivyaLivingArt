import { section } from './section'
import type { SeedModule, SeedRecord } from './types'

/**
 * `/journal` — the landing hero (SEED §18) and the §29 empty state, written now; nine categories
 * (§19) and ten article drafts (§20) authored here and DEFERRED to Phase 18.
 *
 * THE MODULE IS MIXED, like `commissions.ts`. The two sections land today so `/journal` has copy;
 * the nineteen records target `journal_categories` and `journal_articles`, which Phase 18 creates
 * in migration `0160`. They declare `requiresTables` on themselves and are reported `deferred` —
 * counted, named in the run report, and written unchanged when Phase 18 re-runs
 * `npm run seed:content -- --only=journal`.
 *
 * EVERY ARTICLE IS A TITLE AND AN ANGLE, NOT AN ARTICLE. §20 seeds "initial article ideas" as
 * DRAFT and says "Do NOT publish automatically". Writing the bodies here would be inventing
 * editorial nobody commissioned, and several of these titles ask questions only Rivya can answer —
 * what a resin table is, what to prepare for a commission. The angle is the brief; the writing is
 * the owner's.
 *
 * THREE DRAFTS CARRY THE FLAG, each because §20 attaches a caution to it:
 *   02 — "Avoid claiming exact standards unless sourced." Room proportion and seating figures are
 *        exactly the kind of number that reads as authoritative and may not be.
 *   04 — "Mark any Rivya-specific capability claims for owner review." The subject is digital
 *        fabrication, which is the capability the whole site is most careful about.
 *   08 — "Do not make technical preservation-performance promises."
 */

const PAGE = 'page:journal'
const DEFERRED_UNTIL_18 = ['journal_categories', 'journal_articles'] as const

/** §19's nine categories, in its order. */
const CATEGORIES = [
  'Resin Furniture',
  'Collectible Design',
  'Materials',
  '3D Printing',
  'Studio Process',
  'Custom Projects',
  'Interior Art',
  'Preservation',
  'Care & Education',
] as const

/** §20's ten article ideas, with the angle each one gives and the caution where there is one. */
const ARTICLES: readonly { title: string; angle?: string; verify?: boolean; caution?: string }[] = [
  {
    title: 'What Makes a Resin Table More Than a Surface?',
    angle: 'Material depth, composition, scale and role in interiors.',
  },
  {
    title: 'Choosing the Right Size for a Statement Dining Table',
    angle: 'Room proportion, circulation, seating and visual scale.',
    verify: true,
    caution: '§20: avoid claiming exact standards unless sourced.',
  },
  {
    title: 'Resin and Wood: Designing Around Contrast',
    angle: 'The visual relationship between transparency, colour and natural grain.',
  },
  {
    title: 'From Digital Form to Physical Object',
    angle: 'A general introduction to digital design, 3D fabrication and resin experimentation.',
    verify: true,
    caution: '§20: mark any Rivya-specific capability claims for owner review.',
  },
  {
    title: 'What to Prepare Before Requesting a Custom Furniture Commission',
    angle: 'Dimensions, reference imagery, use, material preferences and images of the space.',
  },
  { title: 'A Guide to Resin Colour, Transparency and Visual Depth' },
  { title: 'Large Wall Art: Thinking Beyond Decoration' },
  {
    title: 'Preserving Flowers in Resin: What a Custom Brief Should Include',
    verify: true,
    caution: '§20: do not make technical preservation-performance promises.',
  },
  { title: 'How Material Choice Changes the Character of a Space' },
  { title: 'Why Bespoke Furniture Starts With Context' },
]

/** `What Makes a Resin Table More Than a Surface?` → `what-makes-a-resin-table-more-than-a-surface` */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const categoryRecord = (name: string, i: number): SeedRecord => ({
  seedKey: `journal-category:${slugify(name)}`,
  table: 'journal_categories',
  requiresTables: DEFERRED_UNTIL_18,
  fields: {
    name,
    slug: slugify(name),
    position: (i + 1) * 10,
    status: 'DRAFT',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: 'NOT_REQUIRED',
  },
})

const articleRecord = (a: (typeof ARTICLES)[number], i: number): SeedRecord => ({
  seedKey: `journal-article:${String(i + 1).padStart(2, '0')}`,
  table: 'journal_articles',
  requiresTables: DEFERRED_UNTIL_18,
  fields: {
    title: a.title,
    slug: slugify(a.title),
    // The brief, not the article. §20 seeds ideas; the writing is the owner's.
    excerpt: a.angle ?? null,
    body: null,
    position: (i + 1) * 10,
    // §20: "Do NOT publish automatically. Seed as DRAFT."
    status: 'DRAFT',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: a.verify === true ? 'OWNER_VERIFICATION_REQUIRED' : 'NOT_REQUIRED',
  },
})

export const journalSeed: SeedModule = {
  name: 'journal',
  description:
    'The /journal landing (§18) and its empty state (§29), plus 9 categories (§19) and 10 article drafts (§20) deferred to Phase 18.',
  records: [
    section({
      page: PAGE,
      key: 'journal.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'RIVYA JOURNAL',
      heading: 'Material. Process. Perspective.',
      body: "Stories and guides exploring the materials, ideas and processes surrounding Rivya's work.",
      fact: 'BRAND_COPY',
      layoutVariant: 'contained',
      payload: { is_video: false, autoplay: false, scrim: 35 },
    }),

    section({
      page: PAGE,
      key: 'journal.02.empty-state',
      blockType: 'empty-state',
      position: 2,
      fact: 'BRAND_COPY',
      // §29's wording lives in global_content, seeded in Phase 08. No CTA: §29 supplies none, and
      // inventing one would be putting a button nobody asked for on an honest absence.
      payload: { content_key: 'journal', show_cta: false },
    }),

    // --- deferred to Phase 18 -------------------------------------------------------------------
    ...CATEGORIES.map(categoryRecord),
    ...ARTICLES.map(articleRecord),
  ],
}
