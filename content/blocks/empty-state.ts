import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The honest empty surface. SEED §27, §28, §29.
 *
 * PAYLOAD FAMILY: QUERY-AND-GLOBAL — it renders nothing of its own. Its copy comes from
 * `global_content` in the `EMPTY_STATE` group, looked up by the key in its payload.
 *
 * WHY THE COPY IS NOT ON THE BLOCK. `/portfolio` is a deliberate empty state (D10: Rivya's
 * delivered work has not been confirmed), and so are `/journal` and `/collection` until Phase 09
 * fills them. Those three surfaces should say the same thing in the same voice, and an editor
 * fixing the wording should fix it once. A per-block copy field would give three near-identical
 * sentences that drift.
 *
 * PUBLIC RENDERERS SHIP NO FALLBACK COPY. If the `global_content` row is missing or disabled, this
 * block renders nothing at all — deliberately unlike `components/studio/strings.ts`, which does
 * carry fallbacks because Studio chrome must render before any content exists. An invented public
 * empty state is exactly the SEED §55 failure: a sentence nobody wrote appearing on the site.
 */
const schema = z.object({
  /**
   * The `global_content` key inside the `EMPTY_STATE` group.
   *
   * NULL UNTIL AN EDITOR PICKS ONE, and a null renders nothing — the same doctrine as a missing
   * row. A default of `''` would have been a lie the schema then rejected; a made-up default key
   * would have been worse, pointing the block at a message nobody wrote.
   */
  content_key: z.string().min(1).nullable(),
  /** Render the CTA from the shared fields beneath the message. */
  show_cta: z.boolean(),
})

export type EmptyStatePayload = z.infer<typeof schema>

export const emptyStateBlock: BlockModule<EmptyStatePayload> = {
  type: 'empty-state',
  state: 'BUILT',
  label: 'Empty state',
  description:
    'An honest "nothing here yet" surface. Copy comes from the global EMPTY_STATE group.',
  sharedFields: ['cta_label', 'cta_url'],
  schema,
  defaults: { content_key: null, show_cta: false },
  payloadFields: [
    {
      name: 'content_key',
      kind: 'text',
      label: 'Message key',
      help: 'The key in the EMPTY_STATE group of global content. With none, this block renders nothing.',
    },
    { name: 'show_cta', kind: 'boolean', label: 'Show the call to action' },
  ],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: [],
  allowedPages: null,
}
