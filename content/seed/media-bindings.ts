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
 * Unbound by design, and recorded as gaps rather than filled: the homepage hero video and its
 * poster, `/collection` landing, `/collection/furniture`, `/collection/collectible-design`,
 * `/custom-commissions`, `/contact`, `/faq`, `/search`, and the mobile ratio for the
 * `/large-format` architectural slot.
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
}
