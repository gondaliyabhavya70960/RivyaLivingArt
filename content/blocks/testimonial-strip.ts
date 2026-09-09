import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * Quotes from real people, of which there are none.
 *
 * THE BLOCK EXISTS AND RENDERS NOTHING, which is exactly what the phase document puts out of scope:
 * "public testimonial rendering with zero rows — the block exists and renders nothing". `testimonials`
 * ships empty, `consent` defaults to PENDING, and publishing a quote that names anyone needs GRANTED
 * consent on record (`enforce_testimonial_evidence_gate`, 0150). So this band is buildable, placeable
 * and completely silent until a real person says something and agrees to be quoted.
 *
 * D10 NAMES TESTIMONIALS OUTRIGHT, and one written in-house is the purest form of what it forbids.
 * That is why the payload carries no quotes: there is nowhere in this repository to type one, and a
 * block whose payload held an array of `{ quote, name }` would be exactly that place.
 */
const schema = z.object({
  /** A ceiling. With zero published testimonials it changes nothing, and it will not for a while. */
  limit: z.number().int().min(1).max(12),
})

export type TestimonialStripPayload = z.infer<typeof schema>

export const testimonialStripBlock: BlockModule<TestimonialStripPayload> = {
  type: 'testimonial-strip',
  state: 'BUILT',
  label: 'Testimonials',
  description: 'Published quotes from real people. Renders nothing until there are any.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { limit: 3 },
  payloadFields: [{ name: 'limit', kind: 'number', label: 'How many to show', min: 1, max: 12 }],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: ['row', 'stacked'],
  allowedPages: null,
}
