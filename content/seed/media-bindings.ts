/**
 * Which migrated Higgsfield asset fills which seeded section's media slot.
 *
 * SEPARATE FROM THE COPY, DELIBERATELY. An editor rewriting a headline and an editor choosing a
 * different photograph are doing different jobs; keeping asset ids out of the copy modules leaves
 * those files reading as prose. `content/seed/section.ts` looks a section's own key up here.
 *
 * A MISSING ENTRY IS A GAP, AND A GAP IS LEFT EMPTY. The section is seeded with no media, its
 * `media_slot_key` stays null, and `lib/media/gaps.ts` reports the slot as unfilled. No
 * placeholder, no stock image, no "closest available" substitution — a picture of something Rivya
 * may never have made is precisely the fabrication D10 forbids, and it is worse than an empty
 * frame because it looks finished.
 *
 * AN ENTRY NAMING AN ASSET THAT IS NOT IN `media_assets` FAILS THE RUN. That is a different thing
 * from a gap: it is a typo, or a binding written against a manifest family that was renumbered.
 * The runner refuses the record and names the id rather than writing null and carrying on.
 *
 * THIS FILE IS STILL EMPTY, AND THAT IS NOW OUTSTANDING WORK RATHER THAN A BLOCKED STATE. An earlier
 * version of this note said the migration "has never executed"; it has. All 250 Higgsfield assets
 * are in Cloudinary and in `media_assets` on both the local cluster and hosted, verified by two
 * independent fingerprints. Nothing prevents these bindings from being written any more.
 *
 * WHAT IS ACTUALLY MISSING IS THE CURATION. Choosing which of 250 assets illustrates which of 53
 * seeded sections is an editorial decision across a dozen pages, and doing it badly is worse than
 * leaving it undone: a binding is a picture on a page, and the wrong picture beside the wrong words
 * is the fabrication D10 forbids in its quietest form. Until that pass happens, every seeded section
 * renders the SEED §47 fallback, which is honest.
 *
 * ARTICLE AND PROJECT COVERS DO NOT COME THROUGH HERE. They are columns on the entity row
 * (`journal_articles.cover_media_id`, and the gallery join for a project), bound by the seed
 * record's own `media` map — so the journal's ten covers exist while this map is empty. This file
 * binds SECTION slots, and only those.
 *
 * The bindings the phase documents plan, by page and family, are listed below as the work item
 * they are.
 *
 *   /                      interior-lifestyle, material-macro, largeformat-* (category cards)
 *   /about                 material-macro
 *   /large-format          largeformat-dining/coffee/console/seating/side/monumental
 *   /process               process-studio/timber/mould/pigment/pour/cure/finish
 *   /collection/3d-resin   three-d-resin
 *   /collection/decor      decor
 *   /collection/gifts      gifts
 *   /collection/preservation        preservation-varmala, preservation-keepsake
 *   /collection/wall-statement-art  wall-art
 *   /journal               editorial, workshop-session — landing hero only
 *   /portfolio             gallery-scene — landing atmosphere, never labelled as a project
 *
 * Unbound by design, and recorded as gaps rather than filled: the homepage hero video,
 * `/collection/furniture`, `/collection/collectible-design`, `/custom-commissions`, `/faq`,
 * `/search`, and the mobile ratio for the `/large-format` architectural slot.
 *
 * `/collection` LANDING AND `/contact` WERE ON THAT LIST AND ARE NOT ANY MORE (amendment A46).
 * Phase 43's registry gives both a real slot — `collection.landing.hero` and `contact.hero` — and
 * the generated coverage table in `HIGGSFIELD_ASSET_STATUS.md` §5.1 marks both REUSE_FROM_FAMILY
 * from `material-macro`. The line above outlived the decision it described, and a header that
 * contradicts the map below it in the same file is worse than no header at all.
 *
 * ------------------------------------------------------------------------------------------------
 * FILLING THIS MAP IS NOT ENOUGH ON ITS OWN, and the reason is worth knowing before anyone tries.
 *
 * `npm run seed:content` will NOT apply a binding to a section a person has published, and both of
 * the guards that stop it are correct:
 *
 *   1. `promotedByAHuman` (seed-content.ts rule 5c) returns BEFORE the media-rebind branch. Every
 *      seeded section is `DRAFT`; the launch routes were published by a person. So the sections
 *      that are actually LIVE are precisely the ones the runner refuses to touch.
 *   2. `media_slot_key` is a `fields` entry, so it is inside the content hash. Adding a binding
 *      changes the hash, which takes the row off the rebind path and onto the ordinary update
 *      path — the one guard 1 has already returned from.
 *
 * Between them a perfectly filled map still leaves every live band rendering the SEED §47 fallback
 * well. `npm run seed:bind-media` exists for exactly that: it writes `media_desktop_id`,
 * `media_mobile_id` and `media_slot_key` and refuses to write anything else — no copy, no status,
 * no seed hash — because choosing a photograph is not the same act as publishing a sentence.
 * `--dry-run` prints the plan first, which is what an editorial decision across a dozen pages
 * deserves.
 *
 * WHICH SLOTS CAN BE FILLED TODAY IS ALREADY DECIDED, in the generated coverage table in
 * `docs/media/HIGGSFIELD_ASSET_STATUS.md`: 15 slots are `REUSE_FROM_FAMILY` and bindable now from
 * assets that hold both declared ratios natively; 6 are `RECROP_EXISTING` and want the Studio crop
 * pass first; 2 are `GENERATE_NEW` (the home hero video and its poster, which has no family at
 * all); and 3 are `LEAVE_EMPTY` by declaration, because filling them would assert a business fact
 * nobody has confirmed.
 */

export type MediaBinding = {
  /** The `content/media-slots.ts` registry key, verbatim. Required whenever anything is bound. */
  readonly slotKey: string
  /** `media_assets.rivya_asset_id`, not a uuid. */
  readonly desktop?: string
  readonly mobile?: string
}

/**
 * THE CURATION, MADE. Ten of the twenty-six declared slots; the rest stay gaps.
 *
 * CHOSEN AGAINST THE RENDERER'S RATIO, NOT THE SLOT REGISTRY'S, and the two disagree. A slot in
 * `content/media-slots.ts` declares what the SURFACE needs — `collection.<x>.hero` says 16:9 / 4:5
 * — while `HeroSection` hardcodes 21:9 / 9:16 and `ManifestoSection` 4:5 / 4:5. The renderer is
 * what a visitor actually sees, so it is what the asset is picked for. The mismatch is real and is
 * recorded here rather than papered over: a slot registry that describes a shape nothing renders is
 * worth an amendment, and it is not this file's to make.
 *
 * `native` BELOW MEANS THE ASSET IS ALREADY AT THE DELIVERED RATIO. Where it is not, Cloudinary
 * crops with `g_auto` — which the presets already ask for — and the result is the first thing the
 * Studio's focal points should be pointed at. That list is the crop pass's target, in order of how
 * far the source is from the box.
 *
 * THESE DO NOT CHANGE THE TEST SUITE, AND THAT IS WORTH KNOWING BEFORE ANYONE LOOKS FOR A DIFF.
 * The e2e and visual harness seeds `db:reset` + `seed:content` + `seed-fixture`, and the fixture
 * inserts eleven `media_assets` rows of its own — not the 250 Higgsfield ones. So every binding
 * below resolves to a GAP there, `media_desktop_id` stays null, and the pages render the same
 * fallback wells they did before. Verified against a local cluster: 54 sections, 10 with a
 * `media_slot_key`, 0 with a desktop asset. The bindings take effect where the migrated library
 * exists — production and any database the Higgsfield migration has run against.
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *
 *   · THE HOMEPAGE HERO. `home.hero.video` and `home.hero.poster` are the two `GENERATE_NEW` slots
 *     in the coverage table: no manifest family can fill them, and `fillableBy` is empty for both.
 *     Reaching for a material macro because the most important frame on the site is empty is
 *     exactly the substitution the note above forbids. It stays a gap, and it is the strongest
 *     single argument for the one generation this library still needs.
 *   · `/collection` landing, `/collection/furniture`, `/collection/collectible-design`,
 *     `/custom-commissions`, `/contact`, `/faq`, `/search` — unbound by design, per the list above.
 *   · FIVE OF THE SEVEN PROCESS BANDS. `process.sections` declares 4:3 and only `process-studio`
 *     and `process-finish` hold one. The other five families are `RECROP_EXISTING` in the coverage
 *     table, and a gap is the honest state until somebody crops them.
 *   · EVERY PORTFOLIO AND TESTIMONIAL SURFACE. `portfolio.project` is declared `EMPTY_STATE`:
 *     filling it would assert a delivered project, which is D10's first sentence.
 */
export const MEDIA_BINDINGS: Readonly<Record<string, MediaBinding>> = {
  // 4:5 / 4:5 — native at both. The introduction band beneath the homepage hero.
  'home.02.manifesto': {
    slotKey: 'home.intro',
    desktop: 'INTERIOR-LIFESTYLE-001',
    mobile: 'INTERIOR-LIFESTYLE-003',
  },

  // 21:9 / 9:16 — native at both, and the only family in the library that is. 6336px and 3072px.
  'about.01.hero': {
    slotKey: 'about.hero',
    desktop: 'MATERIAL-MACRO-009',
    mobile: 'MATERIAL-MACRO-002',
  },

  // Desktop native at 21:9 (6336px). Mobile is a 4:5 cropped to 9:16 — the family holds no 9:16.
  'collection.wall-statement-art.01.hero': {
    slotKey: 'collection.wall-statement-art.hero',
    desktop: 'WALL-ART-008',
    mobile: 'WALL-ART-001',
  },

  // Mobile native at 9:16. Desktop is a 16:9 trimmed to 21:9 — the mildest crop of the five.
  'collection.decor.01.hero': {
    slotKey: 'collection.decor.hero',
    desktop: 'DECOR-001',
    mobile: 'DECOR-003',
  },

  // Neither native: 16:9 → 21:9 and 3:4 → 9:16. Both sources are large, so the crop has room.
  'collection.3d-resin.01.hero': {
    slotKey: 'collection.3d-resin.hero',
    desktop: 'THREE-D-RESIN-002',
    mobile: 'THREE-D-RESIN-001',
  },

  // Neither native. The desktop source is the smallest of the ten at 2048px — first in the queue
  // for a focal point, and the one to re-generate if any of these is re-generated.
  'collection.preservation.01.hero': {
    slotKey: 'collection.preservation.hero',
    desktop: 'PRESERVATION-VARMALA-010',
    mobile: 'PRESERVATION-VARMALA-005',
  },

  // Neither native. `GIFTS-005` over 004 and 007, which are tagged `interior-lifestyle` — a gifts
  // category hero should be the objects, not the room they are in.
  'collection.gifts.01.hero': {
    slotKey: 'collection.gifts.hero',
    desktop: 'GIFTS-005',
    mobile: 'GIFTS-001',
  },

  // `EDITORIAL-001` (4:5, 3712px) cropped, NOT `EDITORIAL-017`, which is natively 9:16 and 768px
  // wide — under what a 390px viewport at DPR 2 asks for. Resolution beats ratio when the crop is
  // portrait-to-portrait.
  'journal.01.hero': {
    slotKey: 'journal.cover',
    desktop: 'EDITORIAL-008',
    mobile: 'EDITORIAL-001',
  },

  // 4:3 / 4:5 — the one slot whose declared ratios and renderer agree, so both are native.
  'process.02.brief': {
    slotKey: 'process.sections',
    desktop: 'PROCESS-STUDIO-001',
    mobile: 'PROCESS-STUDIO-006',
  },

  // Native at both. `PROCESS-FINISH-006` over 005, which is tagged `editorial` and `process-timber`
  // as well as `process-finish` — a finishing band wants the finishing bench and nothing else.
  'process.07.finishing': {
    slotKey: 'process.sections',
    desktop: 'PROCESS-FINISH-006',
    mobile: 'PROCESS-FINISH-001',
  },

  /* ----------------------------------------------------------------------------------------
   * THE SECOND CURATION PASS (amendment A46).
   *
   * Seven more slots, taking the map from ten bindings to seventeen. Every one was proposed
   * against the manifest and then ADVERSARIALLY RE-CHECKED against it — id existence, resource
   * type, family, the ratio the RENDERER actually delivers (not the one the registry declares),
   * the srcSet rung the source has to clear, the section's own seeded copy, and D10. Eight further
   * proposals were refused by that check and are recorded under WHAT IS STILL DELIBERATELY NOT
   * HERE, below, with the measurement that refused each one.
   *
   * THE RESOLUTION RULE THE FIRST PASS DID NOT STATE, and the one that refused three proposals:
   * `HeroSection` and `FinalCtaSection` both pass `preset: 'hero'`, whose base width is 1600, and
   * `srcSet(1600)` emits exactly two rungs — 1920 and 2560. There is no rung below 1920, so a
   * source narrower than 1920 is UPSCALED in every delivery, and `ResponsiveMedia` gives
   * `priority` to the MOBILE half, which makes that upscale the route's LCP element.
   * `lib/media/gaps.ts` already states the governing rule: "A slot whose only candidate upscales
   * is reported as a gap rather than quietly bound."
   * -------------------------------------------------------------------------------------------- */

  // 21:9 / 9:16, both native, 6336px and 3072px — no crop anywhere and the widest pair in the map.
  // An abstract macro is the right picture for a navigation surface precisely because it argues
  // for none of the seven categories the band sends the reader to.
  'collection.01.hero': {
    slotKey: 'collection.landing.hero',
    desktop: 'MATERIAL-MACRO-011',
    mobile: 'MATERIAL-MACRO-005',
  },

  // 21:9 / 9:16. Desktop trims 16:9 → 21:9 keeping full width (5504×2359); mobile is native.
  // The two prompts are the same studio at night from two angles, so the pair reads as one
  // photograph across the breakpoint rather than as two.
  'process.01.hero': {
    slotKey: 'process.sections',
    desktop: 'PROCESS-STUDIO-005',
    mobile: 'PROCESS-CURE-002',
  },

  /*
   * THE FIVE PROCESS CHAPTERS the first pass left as gaps, now bound.
   *
   * That pass refused them because "`process.sections` declares 4:3 and only `process-studio` and
   * `process-finish` hold one". The declared ratio is not what ships: `ProcessChapter` delivers
   * 4:3 / 4:5 at preset `grid` with `sizes="(min-width: 768px) 50vw, 100vw"`, so the ceiling is the
   * 1536 rung rather than the hero ladder's 2560 — and every pair below clears 1536 after its crop.
   * Accepting a crop here is the same judgement the first pass already made for five of its own ten
   * ("16:9 → 21:9 and 3:4 → 9:16"), applied to a box less than half as wide.
   *
   * Each pair is chosen so the two halves are the same moment, not merely the same family: the
   * pigment being chosen and the pigment folded in; the slab measured and the slab planed; the
   * mould empty and the mould filled; the pour wide and the pour close.
   */
  'process.03.material-direction': {
    slotKey: 'process.sections',
    desktop: 'PROCESS-PIGMENT-004',
    mobile: 'PROCESS-PIGMENT-005',
  },
  'process.04.form-development': {
    slotKey: 'process.sections',
    desktop: 'PROCESS-TIMBER-004',
    mobile: 'PROCESS-TIMBER-001',
  },
  'process.05.fabrication': {
    slotKey: 'process.sections',
    desktop: 'PROCESS-MOULD-006',
    mobile: 'PROCESS-MOULD-003',
  },
  // Checked specifically for the video defect: `process-pour` holds four videos (POUR-009..012) and
  // `ProcessChapter` mounts the `ChapterMedia` motion island for any bound asset whose
  // `resource_type` is `video`. Both of these are stills.
  'process.06.resin-work': {
    slotKey: 'process.sections',
    desktop: 'PROCESS-POUR-007',
    mobile: 'PROCESS-POUR-005',
  },

  /* ----------------------------------------------------------------------------------------
   * WHAT IS STILL DELIBERATELY NOT HERE, after the second pass (amendment A46).
   *
   * Each of these was proposed with a rationale that read well and was refused by measurement.
   * They are written down because the next person to look at an empty band will reach for the same
   * assets, and the reasons are not visible from the manifest.
   *
   * BLOCKED ON A REGISTRY AMENDMENT, NOT ON EDITORIAL JUDGEMENT — the assets are right and the
   * slot does not exist:
   *
   *   · `home.01.hero`, `home.07.custom-commission`, `home.08.three-d-resin`, `home.13.final-cta`.
   *     `/` declares three slots — `home.hero.video`, `home.hero.poster`, `home.intro` — and none
   *     of the last three bands has one. Inventing `home.commission` would be worse than the gap:
   *     migration 0050 comments `media_slot_key` as "the registry key, VERBATIM" and
   *     `sync_media_usages` copies it into `media_usages.slot_key`, which `lib/media/gaps.ts`
   *     joins on, so an invented key reports coverage against a slot nothing declares.
   *     `tests/unit/media-bindings.test.ts` fails the run on one, correctly.
   *   · `large-format.01.hero`. `LARGEFORMAT-DINING-002` / `-001` are the right pair and
   *     `large-format.dining` is the wrong slot: it is the dining CATEGORY CARD (16:9/4:5,
   *     `minAssets: 2`), so binding the hero against it would put `boundCount` at 2 and have
   *     `classify()` report the dining card FILLED while that card is still empty. A false
   *     coverage report is worse than a true gap. Wants a `large-format.hero` slot at 21:9/9:16.
   *
   * REFUSED ON THE MEASUREMENT, and no substitute exists in the family:
   *
   *   · `commissions.01.hero`. `LARGEFORMAT-DINING-001` is 1536px wide, below the hero ladder's
   *     1920 floor, so it upscales in every delivery — and `ResponsiveMedia` gives `priority` to
   *     the mobile half, making that upscale the primary conversion route's LCP element. It is
   *     also the master plan's designated homepage mobile still, and the desktop half it was
   *     paired with is a different finished room, so the pair would read as two delivered
   *     installations on the one page whose subject is a commission that has not happened.
   *   · `commissions.06.cta`. `PROCESS-STUDIO-008`'s prompt is BYTE-IDENTICAL to
   *     `PROCESS-STUDIO-006`, already bound to `process.02.brief`. DQ-9's rule is "bind one of
   *     each pair; keep the other as a swap candidate" — the "never both in the same section"
   *     clause is its floor, not its whole. The slot's two declared families hold exactly two
   *     distinct 4:5 frames and both are now spoken for on `/process`, so there is no amendment.
   *   · `collection.collectible-design.01.hero`. A DQ-10 recipe break inside one section: the two
   *     halves are from different prompt temperaments, so the picture changes character across the
   *     768px breakpoint.
   *   · `about.05.closing`. `MATERIAL-MACRO-011` is genuinely the right asset for it — and it is
   *     now bound to `collection.01.hero`, and its only alternative is `-015`, its verbatim twin.
   *     Binding both twins breaks DQ-9. The `/about` band is the one that yields, because a
   *     navigation surface needs an image that argues for nothing and a closing invitation has
   *     other ways to carry weight.
   *
   * STILL REFUSED BECAUSE THE COMPONENT RENDERS NO MEDIA AT ALL — a binding there would write
   * columns nothing reads: every `statement`, `checklist`, `numbered-steps`, `empty-state`,
   * `contact-details`, `contact-form` and `faq-list` band on the site.
   * -------------------------------------------------------------------------------------------- */

  // 21:9 / 9:16, both native, neither cropped. 3168px and 3072px both clear the hero ladder's top
  // rung. The binding writes media columns only, so the VERIFIED_BUSINESS_FACT phone number and
  // email address on `contact.02.details` are untouched by it.
  'contact.01.hero': {
    slotKey: 'contact.hero',
    desktop: 'MATERIAL-MACRO-027',
    mobile: 'MATERIAL-MACRO-004',
  },
}
