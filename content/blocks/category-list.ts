import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import { entryVerificationSchema } from '@/lib/cms/entry-visibility'

/**
 * Editorial groupings, listed. SEED §12-03.
 *
 * THESE ARE NOT TAXONOMY, AND THE DISTINCTION IS LOAD-BEARING. The six entries on `/large-format`
 * are one editor's grouping of the studio's work on one page; the seven rows in the `categories`
 * table are the site's taxonomy, with their own routes under `/collection`. The two sets are
 * disjoint by design. Entries create no routes, and `tests/unit/site-routes.test.ts` fails if a
 * `/large-format/*` route file ever appears — which is what would happen the first time somebody
 * mistook one for the other.
 *
 * SO AN ENTRY'S LINK IS OPTIONAL AND VALIDATED. `href` may name a real page — a taxonomy category,
 * usually — and it may be empty, which is the ordinary case for a grouping with nowhere to send
 * anyone. When it names a path that is not live, `CategoryListSection` renders the card
 * non-interactive rather than as an anchor to a 404: a dead link inside a page body is worse than
 * no link, because it reads as a page that is broken rather than one that is unfinished.
 *
 * PER-ENTRY VERIFICATION, because §12 marks three of the six itself. "Conference & Commercial
 * Tables" and "Architectural & Statement Pieces" are marked outright and "Sculptural Seating"
 * carries "mark if not yet produced" — a question the seed cannot answer, so it is treated as
 * marked. Flagging the section would take the confirmed three off the page to withhold the other
 * three; the flag belongs on the entry.
 *
 * NO PRICE, NO DIMENSION, NO SEAT COUNT, NO LEAD TIME. There is no field for any of them, and
 * `tests/unit/selectors-empty.test.ts` asserts their absence across every entry-carrying block, so
 * adding one is a visible decision rather than an editor filling in a box that was already there.
 */
const entrySchema = z.object({
  key: z.string().min(1),
  title: z.string(),
  description: z.string(),
  /** A site-relative path, or empty. Validated at render; never rendered as a dead link. */
  href: z.string().optional(),
  /** Index into `payload.media` entries whose slot is `entries`. Absent renders a text-only card. */
  media_index: z.number().int().min(0).nullable().optional(),
  owner_verification: entryVerificationSchema,
})

const schema = z.object({
  entries: z.array(entrySchema),
  media: z
    .array(
      z.object({
        slot: z.literal('entries'),
        role: z.literal('GALLERY'),
        media_id: z.string().uuid(),
      }),
    )
    .optional(),
})

export type CategoryListPayload = z.infer<typeof schema>

export const categoryListBlock: BlockModule<CategoryListPayload> = {
  type: 'category-list',
  state: 'BUILT',
  label: 'Category list',
  description: 'Editorial groupings as cards, each with an optional picture and an optional link.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { entries: [], media: [] },
  payloadFields: [
    {
      name: 'entries',
      kind: 'json',
      label: 'Groupings',
      help: 'key, title, description and optional href and media_index for each. Set owner_verification to OWNER_VERIFICATION_REQUIRED on a grouping that is not yet confirmed and it stays off the public page. There is no price, dimension or seat-count field, by design.',
    },
    {
      name: 'media',
      kind: 'json',
      label: 'Grouping images',
      help: 'One { slot: "entries", role: "GALLERY", media_id } per pictured grouping, in order. A grouping with no picture renders as a text-only card, which is a designed layout rather than a fallback.',
    },
  ],
  entryArrays: ['entries'],
  mediaSlots: [
    { id: 'entries', role: 'GALLERY', repeating: true, desktopRatio: '16:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['grid', 'rows'],
  allowedPages: null,
}
