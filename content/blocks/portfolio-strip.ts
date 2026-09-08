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
  defaults: { limit: 3 },
  payloadFields: [{ name: 'limit', kind: 'number', label: 'How many to show' }],
  entryArrays: [],
  mediaSlots: [
    { id: 'backdrop', role: 'DESKTOP', repeating: false, desktopRatio: '21:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['strip', 'grid'],
  allowedPages: null,
}
