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
  /**
   * WHICH DELIVERY PRESET THE RENDERER ACTUALLY USES (amendment A47).
   *
   * `lib/media/gaps.ts` needs the delivered width to answer "would the best candidate upscale".
   * It used to infer that from the KEY — `key.includes('hero')` meant 2560 — which is right for
   * `home.hero.poster` and silently wrong for any band delivered full-bleed without the word in
   * its name. `home.final-cta` renders through `FinalCtaSection` at `preset: 'hero'` and
   * `sizes: '100vw'`; inferred from its key it would have been filed at the 768 grid rung, and a
   * 1000px candidate would have been reported as fitting a slot that delivers at 2560.
   *
   * OPTIONAL, AND THE OLD RULE IS THE FALLBACK. Every slot written before this amendment keeps
   * exactly the width the substring rule gave it, so no coverage figure moves; new slots say what
   * they mean. Set it from the renderer's own `preset`, not from how large the band looks.
   */
  readonly delivery?: 'HERO' | 'GRID' | 'CARD'
}

export const MEDIA_SLOTS: readonly MediaSlot[] = [
  // --- / ------------------------------------------------------------------------------------
  // The manifest has 5 assets on `page = home`, all `interior-lifestyle`, and all STILLS. There is
  // no home video at all, which is why both the hero and its poster are gaps rather than one.
  {
    // 16:9 rather than 21:9, matching brief G1 in the master plan and its stated reason: the
    // library's largest furniture videos are 1344 px and 768 px wide, so a 21:9 full-bleed hero
    // would upscale visibly. The registry follows the plan here because the plan reasoned about
    // the actual pixels; a slot that declared a shape no generation is briefed for would hand
    // whoever pastes the brief skeleton a ratio contradicting the brief above it.
    key: 'home.hero.video',
    page: '/',
    label: 'Home hero video',
    kind: 'VIDEO',
    desktopRatio: '16:9',
    mobileRatio: '9:16',
    fillableBy: [],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    // A poster is the frame a visitor sees before the video plays, and under reduced motion it is
    // the whole experience. It cannot be an unrelated still: it must be the video's own opening.
    // So it is a gap for as long as the video is, and filling it independently would be wrong.
    // 21:9 desktop (G2) and 9:16 mobile (G6), as the plan briefs them. The poster is the LCP
    // element and its desktop crop is wider than the video's own frame, which is a deliberate
    // decision recorded in G2, not a mismatch.
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

  /*
   * THREE HOMEPAGE BANDS THAT RENDER MEDIA AND HAD NO SLOT (amendment A47).
   *
   * `/` declared three slots — the hero video, its poster and the introduction band — while the
   * page composes thirteen. Three of the other ten mount `ResponsiveMedia` and therefore have a
   * frame to fill: the commission invitation, the 3D band and the closing call. Their assets were
   * curated and verified against the manifest and then could not be written, because a binding
   * must name a registry key VERBATIM (migration 0050) and inventing one puts a row in the reverse
   * index pointing at a slot that does not exist (migration 0054). So the pictures waited on this.
   *
   * EACH DECLARES ITS `delivery`, which is the half of this amendment that is not bookkeeping. Two
   * of the three are delivered at the hero preset despite having no "hero" in their key, and the
   * old substring rule in `gaps.ts` would have filed them at the 768 grid rung — reporting a
   * 1000px candidate as fitting a slot that delivers at 2560.
   *
   * THE HERO AND ITS POSTER ARE STILL NOT HERE, and that is deliberate rather than pending. Both
   * remain `fillableBy: []` GENERATE slots, `tests/unit/media-bindings.test.ts` asserts they stay
   * unbound, and the poster's own note above says why: it must be the video's opening frame, not
   * an unrelated still. The one outstanding generation brief on the site stays outstanding.
   */
  {
    // `CommissionCtaSection` defaults to `layout_variant: 'split'` — ResponsiveMedia at 3:2 / 4:5,
    // `preset: 'grid'`, `sizes: '(min-width: 768px) 50vw, 100vw'`.
    key: 'home.commission',
    page: '/',
    label: 'Home commission invitation',
    kind: 'IMAGE',
    desktopRatio: '3:2',
    mobileRatio: '4:5',
    // Making and material, never a delivered commission — the same D10 reasoning that gives
    // `custom-commissions.supporting` these two families.
    fillableBy: ['process-timber', 'process-studio'],
    minAssets: 2,
    delivery: 'GRID',
    resolution: 'GENERATE',
  },
  {
    // `ThreeDResinSection` also defaults to 'split': 16:9 / 4:5 at `preset: 'grid'`, 50vw.
    key: 'home.three-d-resin',
    page: '/',
    label: 'Home 3D-printed resin band',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['three-d-resin'], // 13
    minAssets: 2,
    delivery: 'GRID',
    resolution: 'GENERATE',
  },
  {
    // `FinalCtaSection` defaults to 'banded', which is FULL-BLEED: 21:9 / 4:5 at `preset: 'hero'`
    // with `sizes: '100vw'`. This is the slot the old key-substring rule would have misfiled, and
    // the reason `delivery` exists.
    key: 'home.final-cta',
    page: '/',
    label: 'Home closing call',
    kind: 'IMAGE',
    desktopRatio: '21:9',
    mobileRatio: '4:5',
    fillableBy: ['material-macro'], // 39
    minAssets: 2,
    delivery: 'HERO',
    resolution: 'GENERATE',
  },

  // --- /collection and its seven D3 categories -----------------------------------------------
  {
    /*
     * The manifest has per-CATEGORY pages and nothing for the landing surface above them.
     *
     * PHASE 43 GAVE IT `material-macro`. The landing page is ABOUT the material rather than about
     * any one category, and the family holds three 21:9 masters at 6336px — the only assets in the
     * library that fill a full-bleed 21:9 hero without upscaling. Phase 07's own projection said
     * so; `fillableBy` was left empty because the family mapping had not been made yet, and an
     * empty list makes the coverage report propose GENERATE_NEW for a slot the library can already
     * serve.
     */
    key: 'collection.landing.hero',
    page: '/collection',
    label: 'Collection landing hero',
    kind: 'IMAGE',
    desktopRatio: '21:9',
    mobileRatio: '4:5',
    fillableBy: ['material-macro'],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    /*
     * D3's first category, and the library has no family of its own for it. Furniture is the most
     * commercially important surface on the site and the least covered.
     *
     * PHASE 43 GAVE IT THE FIVE `largeformat-*` FAMILIES, WITH A CAVEAT AN EDITOR MUST READ. Those
     * eighteen assets are the only furniture in the library, and enough of them are finished pieces
     * at sufficient resolution to fill this hero by re-crop. But eight of the eighteen are WORKSHOP
     * BLANKS (HIGGSFIELD_ASSET_STATUS.md DQ-8) — unfinished forms on a bench — and binding one here
     * would make an unfinished object the face of the category. `fillableBy` is family-level and
     * cannot exclude an individual asset, which is exactly why this slot's disposition is
     * RECROP_EXISTING rather than REUSE_FROM_FAMILY: a person picks the asset.
     */
    key: 'collection.furniture.hero',
    page: '/collection/furniture',
    label: 'Furniture category hero and cards',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [
      'largeformat-dining',
      'largeformat-console',
      'largeformat-seating',
      'largeformat-side',
      'largeformat-coffee',
    ],
    minAssets: 4,
    resolution: 'GENERATE',
  },
  {
    /*
     * PHASE 43 GAVE IT `gallery-scene`. Collectible design is what a gallery scene IS — an object
     * shown as a piece rather than as furniture — so the five assets in that family are this
     * category's own subject rather than a borrowed illustration, which is the distinction that
     * decides whether reuse is honest. Phase 07 projected the same mapping.
     */
    key: 'collection.collectible-design.hero',
    page: '/collection/collectible-design',
    label: 'Collectible design category hero and cards',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['gallery-scene'],
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
  /*
   * THE `/large-format` OPENING BAND (amendment A47).
   *
   * Every other slot on this page is a CATEGORY CARD — dining, coffee, console, seating, side,
   * architectural — at 16:9/4:5 with `minAssets: 2`. The page's hero is a different surface with
   * a different shape, and it had no slot, so the verified pair for it was proposed against
   * `large-format.dining` and refused: binding a hero there would have put `boundCount` at 2 on a
   * slot whose `minAssets` is 2, and `classify()` would have reported the dining CARD as FILLED
   * while that card is still empty. A false coverage report is worse than a true gap.
   *
   * 21:9 / 9:16 because `HeroSection` with `layout_variant: 'full-bleed'` sets `split = false` and
   * passes those two ratios literally — not the 16:9/4:5 the category cards declare.
   */
  {
    key: 'large-format.hero',
    page: '/large-format',
    label: 'Large format opening band',
    kind: 'IMAGE',
    desktopRatio: '21:9',
    mobileRatio: '9:16',
    fillableBy: ['largeformat-dining', 'interior-lifestyle'],
    minAssets: 2,
    delivery: 'HERO',
    resolution: 'GENERATE',
  },
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

  // --- the utility surfaces, resolved in Phase 43 -----------------------------------------------
  {
    /*
     * PHASE 43 GAVE IT `interior-lifestyle`. A commission page shows a piece IN a room, which is
     * what that family is, and `INTERIOR-LIFESTYLE-002` at 2528px crops 3:2 → 21:9 with the room
     * intact. It is a re-crop rather than a reuse: nothing in the family is natively 21:9.
     */
    key: 'custom-commissions.hero',
    page: '/custom-commissions',
    label: 'Custom commissions hero',
    kind: 'IMAGE',
    desktopRatio: '21:9',
    mobileRatio: '4:5',
    fillableBy: ['interior-lifestyle'],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    /*
     * PHASE 43 GAVE IT `process-studio` AND `process-timber`. What a commission page has to show
     * below the hero is the MAKING — a piece being worked rather than a finished room — and those
     * are the two families that hold it. It is also the honest answer to "what can we say about a
     * commission that has not happened yet": the process is real and repeatable, a finished
     * commission is a claim about a client.
     */
    key: 'custom-commissions.supporting',
    page: '/custom-commissions',
    label: 'Custom commissions supporting imagery',
    kind: 'IMAGE',
    desktopRatio: '4:3',
    mobileRatio: '4:5',
    fillableBy: ['process-studio', 'process-timber'],
    minAssets: 2,
    resolution: 'GENERATE',
  },
  {
    /*
     * PHASE 43 GAVE IT `material-macro`. A contact page needs an image that says "this studio"
     * without asserting anything — a close reading of resin, timber or brass claims no project, no
     * client and no product, which is precisely what makes it the right family for a surface whose
     * whole job is a form. 39 assets, both declared ratios native.
     */
    key: 'contact.hero',
    page: '/contact',
    label: 'Contact surface',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: ['material-macro'],
    minAssets: 1,
    resolution: 'GENERATE',
  },
  {
    /*
     * PHASE 43 MADE THIS `EMPTY_STATE`, AND IT IS A CORRECTION RATHER THAN A CONCESSION. A page of
     * questions and answers is read, not looked at; a decorative image above it competes with the
     * first question for the top of the screen and answers nothing. Phase 07's own projection said
     * "LEAVE_EMPTY — typographic by design", and the registry kept `GENERATE`, which made the
     * coverage report ask for a brief for an image nobody should write one for. Marking it
     * EMPTY_STATE is what stops that brief from ever being generated.
     */
    key: 'faq.hero',
    page: '/faq',
    label: 'FAQ surface',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 1,
    resolution: 'EMPTY_STATE',
  },
  {
    /*
     * PHASE 43 MADE THIS `EMPTY_STATE`. A "nothing matched" state is a MESSAGE — SEED §26 writes it
     * — and an illustration beside it makes a dead end look decorated rather than helpful. The
     * seeded copy tells somebody what to try next, which is the only useful thing this surface can
     * do. Phase 07 projected the same and the registry had not been updated.
     */
    key: 'search.empty',
    page: '/search',
    label: 'Search empty state',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 1,
    resolution: 'EMPTY_STATE',
  },
]

/** Every page carrying at least one declared slot. */
export const SLOT_PAGES: readonly string[] = [...new Set(MEDIA_SLOTS.map((s) => s.page))]
