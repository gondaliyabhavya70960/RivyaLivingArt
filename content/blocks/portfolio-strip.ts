import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * A band of delivered projects. SEED §10-09.
 *
 * A REFERENCE BLOCK, like `selected-works`: it renders entities that may not exist. Rivya has no
 * confirmed delivered work in the database and §10 says not to seed fictional client projects, so
 * with an empty `portfolio_projects` table this renders its seeded editorial fallback and no cards
 * at all.
 *
 * ITS MEDIA IS ATMOSPHERE, NEVER A PROJECT. The `gallery-scene` family sits behind the editorial
 * statement as a backdrop and is never captioned, credited or laid out as a case study — a
 * photograph presented beside the word "projects" reads as a project whatever the alt text says,
 * and that is a delivered-work claim nobody has made.
 */
const schema = z.object({
  limit: z.number().int().min(1).max(12),
  /**
   * Whether this band draws the seeded `EMPTY_STATE.portfolio` sentence when there are no projects.
   *
   * IT EXISTS BECAUSE `/portfolio` ALREADY SAYS IT. That page carries a dedicated `empty-state`
   * block seeded in Phase 09 with the same key, so a strip that also fell back would print "Verified
   * Rivya projects will appear here as the portfolio develops." twice, one under the other. The
   * homepage's strip has no such neighbour and keeps the fallback, which is why this is a per-band
   * choice rather than a change to the renderer.
   *
   * OPTIONAL IN THE SCHEMA, PRESENT IN THE DEFAULTS, and read as `?? true` — the convention `hero`
   * and `category-grid` both record: a row written before this key existed must still parse, and the
   * behaviour it parses to must be the one those rows already had.
   */
  show_empty_state: z.boolean().optional(),
})

export type PortfolioStripPayload = z.infer<typeof schema>

export const portfolioStripBlock: BlockModule<PortfolioStripPayload> = {
  type: 'portfolio-strip',
  state: 'BUILT',
  label: 'Portfolio strip',
  description: 'A row of delivered projects, or its editorial fallback when there are none.',
  sharedFields: [
    'eyebrow',
    'heading',
    'body',
    'cta_label',
    'cta_url',
    'media_desktop_id',
    'media_mobile_id',
    'media_alt_override',
  ],
  schema,
  defaults: { limit: 3, show_empty_state: true },
  payloadFields: [{ name: 'limit', kind: 'number', label: 'How many to show' }],
  entryArrays: [],
  mediaSlots: [
    { id: 'backdrop', role: 'DESKTOP', repeating: false, desktopRatio: '21:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['strip', 'grid'],
  allowedPages: null,
}
