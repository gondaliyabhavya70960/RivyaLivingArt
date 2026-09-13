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
  /* ------------------------------------------------------------------------------------------
   * THE OWNER'S STUDIO PACK — forty-nine more ideas, 2026-09-13.
   *
   * TITLE AND ANGLE ONLY, which is the whole discipline of this module. No body is written here
   * and `excerpt` stays null: a summary the studio has not written is a summary nobody wrote, and
   * a card rendering one would be publishing an editorial brief as marketing copy.
   *
   * SIX CARRY `verify` and each earns it by naming a capability or a promise — UV behaviour, heat
   * and daily use, 3D printing entering a furniture brief, printed bases under cast tops,
   * one-of-one, and what a preservation brief must never promise. The rest are compositional or
   * educational and assert nothing about what Rivya has made.
   *
   * NONE OF THEM BINDS A COVER. `ARTICLE_COVERS` holds ten pairs and nothing was invented to
   * extend it — an article with no entry gets no `media` key at all, which is what the manifest
   * rule requires and what the runner enforces: it throws on an id the manifest does not carry.
   * ------------------------------------------------------------------------------------------ */
  {
    title: 'Dining Tables at Architectural Scale',
    angle: 'When the table starts to organise the room.',
  },
  {
    title: 'Coffee Tables as Sculptural Planes',
    angle: 'Lower height makes base and edge the subject.',
  },
  {
    title: 'Consoles for Thresholds and Halls',
    angle: 'Narrow pieces as visual interventions.',
  },
  {
    title: 'Conference Tables that Hold a Room',
    angle: 'Length, cable discipline and quiet presence.',
  },
  {
    title: 'Oval versus Rectangular Plans',
    angle: 'How plan shape changes pour and seating.',
  },
  {
    title: 'Live Edge and Cut Edge',
    angle: 'Two attitudes to the timber boundary.',
  },
  {
    title: 'Reading Walnut Against Deep Blue Resin',
    angle: 'A pairing that is easy to overdo.',
  },
  {
    title: 'Clear Resin and Figured Grain',
    angle: 'When the wood should remain the picture.',
  },
  {
    title: 'Black Resin as Architecture, Not Mood',
    angle: 'Dark fields that do not flatten.',
  },
  {
    title: 'Mineral Colour: Geode Thinking in Furniture',
    angle: 'Banding, fracture and inclusion as design tools.',
  },
  {
    title: "What 'UV Stable' Actually Means in a Brief",
    angle: 'Education only; no warranty language.',
    verify: true,
  },
  {
    title: 'Heat, Trivets and Dining Use',
    angle: 'How to talk about daily use without over-claiming.',
    verify: true,
  },
  {
    title: 'Cleaning a Resin Surface',
    angle: 'Soft cloth, no abrasives; owner must confirm products.',
  },
  {
    title: 'Moving a Large-Format Table',
    angle: 'Weight, crate, and site access as part of the brief.',
  },
  {
    title: 'Finishing: Matte, Satin, Gloss',
    angle: 'How finish changes colour and fingerprint behaviour.',
  },
  {
    title: "From Liquid to Object: A Visitor's Map",
    angle: 'The public process page, expanded.',
  },
  {
    title: 'Why Slow Curing Matters',
    angle: 'Time as a material, not a delay excuse.',
  },
  {
    title: 'Moulds, Dams and the Edge',
    angle: 'How the edge is decided before the pour.',
  },
  {
    title: 'Sanding Through Grits Without Losing Flatness',
    angle: 'Craft note; no branded grit claims unless sourced.',
  },
  {
    title: 'Photographing Resin Without Inventing the Object',
    angle: 'Concept media versus delivered photography.',
  },
  {
    title: 'When 3D Printing Enters a Furniture Brief',
    angle: 'Bases, lattices, fittings — verification required.',
    verify: true,
  },
  {
    title: 'Printed Bases and Cast Tops',
    angle: 'A hybrid that must be engineered, not styled.',
    verify: true,
  },
  {
    title: 'Lattice, Gyroid and Rib: Three Structures',
    angle: 'Vocabulary for a conversation with a designer.',
  },
  {
    title: 'Collectible Design versus Made-to-Order Furniture',
    angle: 'Edition, unique, and commission — three different promises.',
  },
  {
    title: 'How Galleries Talk About Functional Sculpture',
    angle: 'Language borrowed carefully from FUMI and CWG.',
  },
  {
    title: 'Seating as Object: What Must Be Proven',
    angle: 'Sit, structure, finish — before a chair is a product.',
  },
  {
    title: 'One-of-One without Theatre',
    angle: 'Uniqueness as a consequence of making, not a slogan.',
    verify: true,
  },
  {
    title: 'Working with Interior Designers',
    angle: 'What a designer should send on day one.',
  },
  {
    title: 'Working with Architects on Built-In Pieces',
    angle: 'Site measure, services, and who owns the drawing.',
  },
  {
    title: 'Hospitality Briefs: Durability before Drama',
    angle: 'Restaurants and hotels change the brief.',
  },
  {
    title: 'A First Conversation on WhatsApp',
    angle: 'What Rivya asks, and why the enquiry is saved first.',
  },
  {
    title: 'How to Photograph Your Room for a Brief',
    angle: 'Corners, ceiling, floor, and a tape in frame.',
  },
  {
    title: 'Colour Matching to Stone, Fabric and Paint',
    angle: 'Bring samples; screens lie.',
  },
  {
    title: 'Metal Bases: Quiet Geometry',
    angle: 'Blackened steel, bronze tone, and when the base should vanish.',
  },
  {
    title: 'Stone and Resin: A Difficult Friendship',
    angle: 'Weight, seal and edge.',
  },
  {
    title: 'Statement Walls in Stair Voids',
    angle: 'Height, light from two floors, and maintenance access.',
  },
  {
    title: 'Triptychs and Modular Panels',
    angle: 'Shipping and hanging as part of the design.',
  },
  {
    title: 'Light Through Resin',
    angle: 'Backlight, grazing light, and rooms without either.',
  },
  {
    title: 'What a Preservation Brief Must Never Promise',
    angle: 'No forever, no museum standard unless sourced.',
    verify: true,
  },
  {
    title: 'Dried versus Fresh Botanical Matter',
    angle: 'Moisture is the brief.',
  },
  {
    title: 'Personal Objects in a Public Room',
    angle: 'When a keepsake should stay small.',
  },
  {
    title: 'Gifts that Still Feel like Rivya',
    angle: 'Secondary objects without sliding into a gift shop.',
  },
  {
    title: 'How to Read a Starting Price',
    angle: 'Fixed, starting, and RFQ — three different states.',
  },
  {
    title: 'Why the Website Does Not Take Payment',
    angle: 'Restate the business rule without apology.',
  },
  {
    title: 'A Material Library Visit, When There Is One',
    angle: 'Do not invent a showroom; describe what a visit would need.',
  },
  {
    title: 'Export, Crating and Indian Making',
    angle: 'Logistics as design; no invented Incoterms.',
  },
  {
    title: 'The Ocean Collection as a Thinking Tool',
    angle: 'Collection names are concepts until pieces exist.',
  },
  {
    title: 'Midnight as a Restraint, Not a Theme',
    angle: 'Dark work that still has depth.',
  },
  {
    title: 'Bespoke Is a Process, Not a SKU',
    angle: 'The tenth collection is a door, not a product.',
  },
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
  0, // 11 Dining Tables at Architectural Scale → Resin Furniture
  0, // 12 Coffee Tables as Sculptural Planes → Resin Furniture
  0, // 13 Consoles for Thresholds and Halls → Resin Furniture
  0, // 14 Conference Tables that Hold a Room → Resin Furniture
  0, // 15 Oval versus Rectangular Plans → Resin Furniture
  2, // 16 Live Edge and Cut Edge → Materials
  2, // 17 Reading Walnut Against Deep Blue Resin → Materials
  2, // 18 Clear Resin and Figured Grain → Materials
  2, // 19 Black Resin as Architecture, Not Mood → Materials
  2, // 20 Mineral Colour: Geode Thinking in Furniture → Materials
  8, // 21 What 'UV Stable' Actually Means in a Brief → Care & Education
  8, // 22 Heat, Trivets and Dining Use → Care & Education
  8, // 23 Cleaning a Resin Surface → Care & Education
  8, // 24 Moving a Large-Format Table → Care & Education
  4, // 25 Finishing: Matte, Satin, Gloss → Studio Process
  4, // 26 From Liquid to Object: A Visitor's Map → Studio Process
  4, // 27 Why Slow Curing Matters → Studio Process
  4, // 28 Moulds, Dams and the Edge → Studio Process
  4, // 29 Sanding Through Grits Without Losing Flatness → Studio Process
  4, // 30 Photographing Resin Without Inventing the Object → Studio Process
  3, // 31 When 3D Printing Enters a Furniture Brief → 3D Printing
  3, // 32 Printed Bases and Cast Tops → 3D Printing
  3, // 33 Lattice, Gyroid and Rib: Three Structures → 3D Printing
  1, // 34 Collectible Design versus Made-to-Order Furniture → Collectible Design
  1, // 35 How Galleries Talk About Functional Sculpture → Collectible Design
  1, // 36 Seating as Object: What Must Be Proven → Collectible Design
  1, // 37 One-of-One without Theatre → Collectible Design
  5, // 38 Working with Interior Designers → Custom Projects
  5, // 39 Working with Architects on Built-In Pieces → Custom Projects
  5, // 40 Hospitality Briefs: Durability before Drama → Custom Projects
  5, // 41 A First Conversation on WhatsApp → Custom Projects
  5, // 42 How to Photograph Your Room for a Brief → Custom Projects
  2, // 43 Colour Matching to Stone, Fabric and Paint → Materials
  2, // 44 Metal Bases: Quiet Geometry → Materials
  2, // 45 Stone and Resin: A Difficult Friendship → Materials
  6, // 46 Statement Walls in Stair Voids → Interior Art
  6, // 47 Triptychs and Modular Panels → Interior Art
  6, // 48 Light Through Resin → Interior Art
  7, // 49 What a Preservation Brief Must Never Promise → Preservation
  7, // 50 Dried versus Fresh Botanical Matter → Preservation
  7, // 51 Personal Objects in a Public Room → Preservation
  8, // 52 Gifts that Still Feel like Rivya → Care & Education
  8, // 53 How to Read a Starting Price → Care & Education
  8, // 54 Why the Website Does Not Take Payment → Care & Education
  4, // 55 A Material Library Visit, When There Is One → Studio Process
  5, // 56 Export, Crating and Indian Making → Custom Projects
  1, // 57 The Ocean Collection as a Thinking Tool → Collectible Design
  1, // 58 Midnight as a Restraint, Not a Theme → Collectible Design
  5, // 59 Bespoke Is a Process, Not a SKU → Custom Projects
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
    /*
     * NO `media` KEY AT ALL WHEN THERE IS NO COVER — Phase 46, and it is a correctness fix rather
     * than a tidy-up.
     *
     * This read `cover_media_id: cover?.desktop ?? ''`, which was harmless while `ARTICLE_COVERS`
     * had an entry for every article. The Studio pack took the list from ten to fifty-nine and
     * `ARTICLE_COVERS` stayed at ten, so forty-nine records would have bound the EMPTY STRING —
     * and `resolveReferences` throws on an id the manifest does not carry, by design, to catch a
     * typo. An empty id is not a typo, it is an absence, and an absence is spelled by omitting the
     * key. Nothing was invented to extend the cover list: a gap is a gap.
     */
    ...(cover === undefined
      ? {}
      : {
          media: {
            cover_media_id: cover.desktop,
            ...(cover.mobile === undefined ? {} : { cover_mobile_media_id: cover.mobile }),
          },
        }),
  }
}

export const journalSeed: SeedModule = {
  name: 'journal',
  description:
    "The /journal landing (§18) and its empty state (§29), plus 9 categories (§19) and 59 article drafts — §20's original ten and the owner's Studio pack — deferred to Phase 18, every one DRAFT with a title and an angle and no body.",
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
