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

export const MEDIA_BINDINGS: Readonly<Record<string, MediaBinding>> = {}
