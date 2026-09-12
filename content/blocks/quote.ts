import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * A pulled quotation with an attribution.
 *
 * PAYLOAD FAMILY: A SINGLE ITEM, which is why the verification flag is NOT in the payload here.
 * `testimonial-strip` holds several quotations and flags them one by one, because withholding the
 * band would take the confirmed ones with it. A `quote` band IS its quotation: there is nothing
 * left once it is withheld, so `page_sections.owner_verification` is the right column and the
 * Phase 08 publish trigger is the right mechanism.
 *
 * AN ATTRIBUTED QUOTATION IS A NAMED CUSTOMER, and D10 forbids inventing one outright. Nothing in
 * this repository may seed a `quote` with a person's name attached; what an editor types is the
 * owner's own claim about a real conversation, and the flag above is how it is checked. The block
 * renders an unattributed quotation perfectly well — a line from the studio's own writing, set
 * large — which is the use that needs nobody's confirmation.
 *
 * `cite` IS A URL AND IS NEVER SHOWN. HTML's `<blockquote cite>` is machine-readable provenance;
 * putting it on screen would be a link a visitor cannot tell the destination of. A publication an
 * editor wants visible goes in `source`, which is text.
 */
/*
 * EVERY FIELD DEFAULTS TO EMPTY, and that is not laziness about validation. `parseBlockPayload`
 * falls back to the block's DEFAULTS wholesale when a payload does not parse, so a required
 * `attribution` would mean a payload holding only `{ quote: '…' }` — the shape an editor types
 * first, and the shape a seeded unattributed line takes — parses as failure and renders nothing.
 * The block would appear broken for writing exactly the quotation it is safest to publish.
 */
const schema = z.object({
  quote: z.string().default(''),
  /** The person or publication. Empty for an unattributed line, which is the safe default. */
  attribution: z.string().default(''),
  /** Their role or the publication's title, shown under the attribution. */
  source: z.string().default(''),
  /** `<blockquote cite>`: provenance for a machine, never rendered as a link. */
  cite: z.string().default(''),
})

export type QuotePayload = z.infer<typeof schema>

export const quoteBlock: BlockModule<QuotePayload> = {
  type: 'quote',
  state: 'BUILT',
  label: 'Quote',
  description: 'A pulled quotation with an optional attribution.',
  sharedFields: ['eyebrow', 'heading'],
  schema,
  defaults: { quote: '', attribution: '', source: '', cite: '' },
  payloadFields: [
    { name: 'quote', kind: 'textarea', label: 'Quotation' },
    {
      name: 'attribution',
      kind: 'text',
      label: 'Attributed to',
      help: 'A real person or publication only. Leave empty for an unattributed line. A name here is a claim about a real customer — set owner_verification on the section so the owner confirms it before it publishes.',
    },
    { name: 'source', kind: 'text', label: 'Role or publication' },
    { name: 'cite', kind: 'text', label: 'Source URL', help: 'Provenance. Never shown.' },
  ],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: ['centred', 'left'],
  allowedPages: null,
}
