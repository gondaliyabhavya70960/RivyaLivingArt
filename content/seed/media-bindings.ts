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
 * THIS FILE IS EMPTY UNTIL THE MIGRATION RUNS. `scripts/media/migrate-higgsfield.ts` has never
 * executed — the sandbox proxy refuses CONNECT to both Cloudinary and the Higgsfield CDN — so
 * `media_assets` holds no Higgsfield rows at all, and every binding written here today would fail
 * the run rather than bind. The bindings the phase document plans, by page and family, are listed
 * below as the work item they are; they are added in one commit once the assets exist.
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
 */

export type MediaBinding = {
  /** The `content/media-slots.ts` registry key, verbatim. Required whenever anything is bound. */
  readonly slotKey: string
  /** `media_assets.rivya_asset_id`, not a uuid. */
  readonly desktop?: string
  readonly mobile?: string
}

export const MEDIA_BINDINGS: Readonly<Record<string, MediaBinding>> = {}
