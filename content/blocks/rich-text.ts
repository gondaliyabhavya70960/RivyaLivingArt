import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * A long-form prose band: a document heading and paragraphs beneath it. FEAT §8 element 9.
 *
 * PAYLOAD FAMILY: NONE. Every word is a shared copy field, like `statement` and `manifesto`.
 *
 * WHAT THIS IS NOT, AND THE DISTINCTION IS AMENDMENT A14's. A14 declined to build `rich-text` in
 * Phase 16 with a specific reason: "a rich-text document needs a sanitiser, an allow-list of
 * elements, a decision about embedded media and a Studio editor that is not a JSON textarea." That
 * reasoning is correct and it is about a MARKUP block — one whose payload holds HTML an editor
 * pastes. This is not that block and never becomes it. `body` is plain text, split on blank lines
 * into paragraphs by the same `SectionCopy` every other band uses; there is no markup to allow, so
 * there is nothing to sanitise and no editor to build. What A14 refused, this still refuses.
 *
 * HOW IT DIFFERS FROM `statement`, which is the fair question to ask of a block with no payload.
 * `statement` is an editorial band — a `display-lg` heading, a short paragraph, a scheme change,
 * one idea. This is a DOCUMENT band: a heading at heading scale rather than display scale, body at
 * reading measure, and no call to action, because a privacy policy does not have one. `/privacy`
 * and `/terms` are several of these in a row, each with its own `h2`, which is how a legal document
 * is actually shaped. Rendering that as a stack of `statement` bands would set every clause in
 * 48px display type.
 *
 * NO COPY SHIPS WITH IT. `/privacy` and `/terms` stay 404 until somebody writes the text: legal
 * copy asserts things about a real business, so D10 puts it with the owner and not with us.
 */
const schema = z.object({})

export type RichTextPayload = z.infer<typeof schema>

export const richTextBlock: BlockModule<RichTextPayload> = {
  type: 'rich-text',
  state: 'BUILT',
  label: 'Rich text',
  description: 'A long-form prose band: a document heading and paragraphs of plain text.',
  sharedFields: ['eyebrow', 'heading', 'body', 'supporting'],
  schema,
  defaults: {},
  payloadFields: [],
  entryArrays: [],
  mediaSlots: [],
  /*
   * `prose` IS THE DEFAULT AND IS THE POINT: 68 characters is a measure somebody can read for a
   * page at a time. `wide` exists for the one case prose measure gets wrong — a clause with a long
   * unbreakable term, an address, a reference number — where the narrower column hyphenates badly.
   */
  layoutVariants: ['prose', 'wide'],
  allowedPages: null,
}
