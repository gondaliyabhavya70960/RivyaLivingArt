import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * A band of journal articles. SEED §10-12.
 *
 * THE THIRD REFERENCE BLOCK. `journal_articles` does not exist as a table until Phase 18, and the
 * nineteen records Phase 09 authored are deferred until it does — so the selector returns empty,
 * this renders its seeded fallback, and it will keep doing so after the table arrives until an
 * article is published. Both states are the same code path, which is what makes the fallback
 * trustworthy rather than a thing that only ever ran in development.
 */
const schema = z.object({
  limit: z.number().int().min(1).max(12),
  /** Restrict to one journal category by slug, or null for the most recent across all of them. */
  category_slug: z.string().nullable(),
})

export type JournalStripPayload = z.infer<typeof schema>

export const journalStripBlock: BlockModule<JournalStripPayload> = {
  type: 'journal-strip',
  state: 'BUILT',
  label: 'Journal strip',
  description: 'A row of journal articles, or its editorial fallback when there are none.',
  sharedFields: ['eyebrow', 'heading', 'body', 'cta_label', 'cta_url'],
  schema,
  defaults: { limit: 3, category_slug: null },
  payloadFields: [
    { name: 'limit', kind: 'number', label: 'How many to show' },
    {
      name: 'category_slug',
      kind: 'text',
      label: 'Category slug',
      help: 'Leave empty for the most recent across all categories.',
    },
  ],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: ['strip', 'grid'],
  allowedPages: null,
}
