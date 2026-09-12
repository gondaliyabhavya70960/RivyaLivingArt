import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import type { BlockType } from '@/lib/cms/block-types'

/**
 * The mechanism for declaring a block that exists in the catalogue and has no renderer.
 *
 * **THE LIST IS EMPTY. Every one of the 34 block types is BUILT.** Phase 45 promoted the last
 * seven — `checklist`, `numbered-steps`, `faq-list`, `contact-details`, `rich-text`, `media-split`
 * and `quote` — and the file stays because the mechanism is what is worth keeping, not the list.
 * The next block declared ahead of its renderer is one entry below and three lines of change.
 *
 * WHY A PLANNED BLOCK EXISTS AT ALL, rather than the registry simply omitting it. Three reasons,
 * in increasing order of importance:
 *
 * 1. `Record<BlockType, BlockModule>` is only exhaustive if every key is present. A partial
 *    registry would compile, and the missing types would surface as `undefined` at render time.
 * 2. The Studio's block picker can show the whole catalogue with the unbuilt ones disabled, which
 *    is honest about scope in the one place an editor will ask the question.
 * 3. Promoting one to BUILT is a deletion from this file and an addition of a real module — the
 *    compiler then requires the registry entry to change, so the two cannot drift. That is the
 *    path all seven have now taken.
 *
 * A PLANNED BLOCK RENDERS NOTHING ON THE PUBLIC SITE. It is not a placeholder card, not a
 * "coming soon", not a grey box: a section whose block is unbuilt is skipped entirely by the
 * renderer. Anything else would put a sentence on the site that nobody wrote (SEED §55), and a
 * grey box is still a sentence.
 *
 * `schema` is a permissive object rather than `z.object({})` because a planned block may already
 * hold payload seeded ahead of its renderer, and a strict empty object would strip it on the next
 * save. `.loose()` keeps unknown keys.
 */
const plannedSchema = z.object({}).loose()

export type PlannedPayload = z.infer<typeof plannedSchema>

export function planned(
  type: BlockType,
  label: string,
  description: string,
): BlockModule<PlannedPayload> {
  return {
    type,
    state: 'PLANNED',
    label,
    description,
    sharedFields: [],
    schema: plannedSchema,
    defaults: {},
    payloadFields: [],
    // A planned block declares none: it renders nothing, so it has no entries to withhold. The
    // module that replaces it names its own.
    entryArrays: [],
    mediaSlots: [],
    layoutVariants: [],
    allowedPages: null,
  }
}

/**
 * KEYED BY TYPE, NOT AN ARRAY, and that is load-bearing rather than a style choice: the registry's
 * exhaustiveness check is `satisfies Record<BlockType, …>` over a spread of object literals, and a
 * spread only carries its keys into the result type if the source has literal keys. Built from an
 * array via a `Record<string, …>` helper, every key would widen to `string` and the check would
 * pass with blocks missing.
 *
 * EMPTY, AND IT TYPE-CHECKS EMPTY. `Partial<Record<…>>` admits `{}`, and the registry's own
 * `satisfies Record<BlockType, …>` over the spread is what now requires `BUILT_BLOCKS` to cover
 * all 34 on its own — so deleting this object would remove nothing the compiler is relying on,
 * and keeping it costs a line.
 */
export const PLANNED_BLOCKS = {} as const satisfies Partial<
  Record<BlockType, BlockModule<PlannedPayload>>
>
