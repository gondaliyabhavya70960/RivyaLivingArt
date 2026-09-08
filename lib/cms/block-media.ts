import { z } from 'zod'

/**
 * The reserved `payload.media` contract.
 *
 * A section's own picture lives in `media_desktop_id` / `media_mobile_id` — real columns, with
 * real foreign keys, which `sync_media_usages` reads directly. A block with REPEATING media has
 * nowhere to put a variable number of references, so they go in the payload under this one
 * reserved key, in this one shape, and `sync_media_usages` reads them from there.
 *
 * WHY IT IS RESERVED RATHER THAN PER-BLOCK. The trigger is SQL. It cannot know that a
 * `category-grid` keeps its pictures under `cards[].image_id` and a `process-steps` under
 * `steps[].media`; it can only read one agreed path. Every repeating block therefore keeps its
 * editorial data in its own keys and its media references here, indexed — which is where
 * `media_usages.slot_key` gets its `cards[0]`, `cards[1]` form, and why `slotKeyOf()` in
 * `lib/media/gaps.ts` has an index to strip.
 *
 * THE ORDER OF THE ARRAY IS THE INDEX. Removing entry 0 renumbers everything after it, and a
 * card holding `media_index: 2` would then point at a different picture. Editors reorder through
 * Studio, which rewrites both sides together; nothing else may splice this array.
 */
export const BLOCK_MEDIA_KEY = 'media'

/** The roles a payload media entry may claim. Mirrors `media_usages.role` in 0030. */
export const BLOCK_MEDIA_ROLES = [
  'DESKTOP',
  'MOBILE',
  'POSTER',
  'THUMBNAIL',
  'GALLERY',
  'OG',
] as const

export const blockMediaEntrySchema = z.object({
  /** The block's own slot id, matching a `BlockMediaSlot.id` it declared. */
  slot: z.string().min(1),
  role: z.enum(BLOCK_MEDIA_ROLES),
  media_id: z.uuid(),
})

export type BlockMediaEntry = z.infer<typeof blockMediaEntrySchema>

/**
 * The media entries in an arbitrary payload, or an empty array.
 *
 * TOTAL AND FORGIVING BY DESIGN. This runs over payloads read from the database, including ones
 * written before a block's schema changed. A malformed entry is skipped, not thrown: one bad
 * reference must not take a page down, and the alternative — throwing — would make a single
 * stale row un-renderable and un-editable at once.
 */
export function blockMediaEntries(payload: unknown): readonly BlockMediaEntry[] {
  if (typeof payload !== 'object' || payload === null) return []
  const raw = (payload as Record<string, unknown>)[BLOCK_MEDIA_KEY]
  if (!Array.isArray(raw)) return []

  const entries: BlockMediaEntry[] = []
  for (const item of raw) {
    const parsed = blockMediaEntrySchema.safeParse(item)
    if (parsed.success) entries.push(parsed.data)
  }
  return entries
}

/** The `media_usages.slot_key` an entry takes: the registry key, the block slot, and its index. */
export function indexedSlotKey(base: string, index: number): string {
  return `${base}[${index}]`
}
