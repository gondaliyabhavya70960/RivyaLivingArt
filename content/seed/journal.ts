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

/**
 * A category, seeded PUBLISHED.
 *
 * THIS IS THE ONE PLACE IN THIS MODULE THAT PUBLISHES ANYTHING, and the asymmetry with the articles
 * below is the point. Phase 09's rule — every seeded section is DRAFT, because a seed that shipped
 * copy live would be asserting somebody had read it — is about COPY. A category is taxonomy: it
 * says "the studio writes about materials", which is true the moment the journal exists, and it
 * carries no claim about what Rivya can make. It also cannot work any other way:
 * `/journal/category/materials` reads through the anonymous policy, so a DRAFT category is a page
 * that 404s and a filter chip that leads nowhere.
 *
 * `owner_verification` IS `NOT_REQUIRED` for the same reason. There is nothing here for an owner to
 * confirm — the name of a subject the studio writes about is not a business capability.
 */
const categoryRecord = (name: string, i: number): SeedRecord => ({
  seedKey: `journal-category:${slugify(name)}`,
  table: 'journal_categories',
  requiresTables: DEFERRED_UNTIL_18,
  fields: {
    name,
    slug: slugify(name),
    position: (i + 1) * 10,
    status: 'PUBLISHED',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: 'NOT_REQUIRED',
  },
})

/**
 * Which category each of §20's ten ideas belongs to.
 *
 * READ OFF THE TITLES, NOT INVENTED. §20 gives the ideas and §19 gives the nine categories, and it
 * does not join them — so this map is the one editorial judgement in the module, and it is a
 * judgement about filing rather than about content. Every assignment is defensible from the title
 * alone: a piece called "Preserving Flowers in Resin" is filed under Preservation. An editor may
 * refile any of them in the Studio; the seed will not fight it, because the runner stops owning a
 * row an editor has touched.
 *
 * THE INDEX IS INTO `CATEGORIES` ABOVE, so the two lists cannot drift into disagreeing about how
 * many categories there are.
 */
const ARTICLE_CATEGORY: readonly number[] = [
  0, // 01 What Makes a Resin Table More Than a Surface? → Resin Furniture
  0, // 02 Choosing the Right Size for a Statement Dining Table → Resin Furniture
  2, // 03 Resin and Wood: Designing Around Contrast → Materials
  3, // 04 From Digital Form to Physical Object → 3D Printing
  5, // 05 What to Prepare Before Requesting a Custom Commission → Custom Projects
  2, // 06 A Guide to Resin Colour, Transparency and Visual Depth → Materials
  6, // 07 Large Wall Art: Thinking Beyond Decoration → Interior Art
  7, // 08 Preserving Flowers in Resin → Preservation
  6, // 09 How Material Choice Changes the Character of a Space → Interior Art
  5, // 10 Why Bespoke Furniture Starts With Context → Custom Projects
]

/**
 * Which asset covers each idea, desktop and mobile.
 *
 * THE PAIRING IS BY POSITION, NOT BY SUBJECT, AND AN EDITOR SHOULD CHANGE IT. Every `editorial`
 * asset is a concept render of an editorial mood; none of them is a photograph OF the piece any of
 * these titles is about, because none of these articles is written. Binding one is what the phase
 * asks for — a draft with no cover has nothing to show in the Studio list or in a preview — and the
 * honest description of what it is, is "a placeholder the owner replaces", not "the right image".
 *
 * MOBILE COVERS EXIST ONLY WHERE A PORTRAIT VARIANT DOES. Four of the sixteen `editorial` images are
 * 4:5 or 3:4; the other six ideas get no mobile binding at all rather than a landscape asset
 * squeezed into a portrait frame. D6 keeps the two slots separate precisely so that "no portrait
 * asset" can be represented.
 *
 * THE THREE `editorial` VIDEOS ARE NOT BOUND. A cover is a still; a video cover would autoplay in a
 * card grid, and nothing in this phase renders one.
 */
const ARTICLE_COVERS: readonly { desktop: string; mobile?: string }[] = [
  { desktop: 'EDITORIAL-003', mobile: 'EDITORIAL-001' },
  { desktop: 'EDITORIAL-004', mobile: 'EDITORIAL-002' },
  { desktop: 'EDITORIAL-005', mobile: 'EDITORIAL-007' },
  { desktop: 'EDITORIAL-006', mobile: 'EDITORIAL-010' },
  { desktop: 'EDITORIAL-008' },
  { desktop: 'EDITORIAL-009' },
  { desktop: 'EDITORIAL-011' },
  { desktop: 'EDITORIAL-012' },
  { desktop: 'EDITORIAL-013' },
  { desktop: 'EDITORIAL-014' },
]

/**
 * One §20 idea, as a DRAFT.
 *
 * THE ANGLE GOES IN `angle_note`, NOT IN `excerpt`. An earlier draft of this module put it in
 * `excerpt` — where a card renders it — which would have published the studio's editorial briefs as
 * summaries on the website. `angle_note` is never rendered publicly; `excerpt` is left null,
 * because a summary of an unwritten article is a summary of nothing.
 *
 * NOTHING SETS `status` TO ANYTHING BUT DRAFT, and nothing sets `reading_minutes`: the first is what
 * §20 forbids ("Do NOT publish automatically"), and the second is derived by a trigger that
 * overwrites whatever a caller sends.
 */
const articleRecord = (a: (typeof ARTICLES)[number], i: number): SeedRecord => {
  const cover = ARTICLE_COVERS[i]
  const categoryName = CATEGORIES[ARTICLE_CATEGORY[i] ?? 0] ?? CATEGORIES[0]

  return {
    seedKey: `journal-article:${String(i + 1).padStart(2, '0')}`,
    table: 'journal_articles',
    requiresTables: DEFERRED_UNTIL_18,
    fields: {
      title: a.title,
      slug: slugify(a.title),
      // The brief, for whoever writes the piece. Never rendered publicly.
      angle_note: a.angle ?? null,
      // A card's line. Null until there is an article to summarise.
      excerpt: null,
      // §20: "Do NOT publish automatically. Seed as DRAFT."
      status: 'DRAFT',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: a.verify === true ? 'OWNER_VERIFICATION_REQUIRED' : 'NOT_REQUIRED',
    },
    refs: {
      primary_category_id: {
        table: 'journal_categories',
        seedKey: `journal-category:${slugify(categoryName)}`,
      },
    },
    media: {
      cover_media_id: cover?.desktop ?? '',
      ...(cover?.mobile === undefined ? {} : { cover_mobile_media_id: cover.mobile }),
    },
  }
}

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
