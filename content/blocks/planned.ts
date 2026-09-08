import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import type { BlockType } from '@/lib/cms/block-types'

/**
 * The 22 catalogue blocks that are declared but not yet built.
 *
 * WHY THEY EXIST AT ALL, rather than the registry simply omitting them. Three reasons, in
 * increasing order of importance:
 *
 * 1. `Record<BlockType, BlockModule>` is only exhaustive if every key is present. A partial
 *    registry would compile, and the missing 22 would surface as `undefined` at render time.
 * 2. The Studio's block picker can show the whole catalogue with the unbuilt ones disabled, which
 *    is honest about scope in the one place an editor will ask the question.
 * 3. Promoting one to BUILT is a deletion from this file and an addition of a real module — the
 *    compiler then requires the registry entry to change, so the two cannot drift.
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

function planned(type: BlockType, label: string, description: string): BlockModule<PlannedPayload> {
  return {
    type,
    state: 'PLANNED',
    label,
    description,
    sharedFields: [],
    schema: plannedSchema,
    defaults: {},
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
 * Ordered as `BLOCK_TYPES` orders them, so a reader can diff the two lists by eye. Labels and
 * descriptions are the catalogue's own, so they are already right when a block ships.
 */
export const PLANNED_BLOCKS = {
  manifesto: planned('manifesto', 'Manifesto', 'The brand statement band with a supporting image.'),
  'selected-works': planned(
    'selected-works',
    'Selected works',
    'A curated set of pieces pulled from the catalogue.',
  ),
  'material-story': planned(
    'material-story',
    'Material story',
    'A single material told at length, with detail media.',
  ),
  'material-palette': planned(
    'material-palette',
    'Material palette',
    'Swatches with names and short notes.',
  ),
  'commission-cta': planned(
    'commission-cta',
    'Commission call to action',
    'The commissioning prompt with a WhatsApp handoff.',
  ),
  'three-d-resin': planned(
    'three-d-resin',
    '3D resin viewer',
    'An interactive resin piece with a static fallback.',
  ),
  'portfolio-strip': planned(
    'portfolio-strip',
    'Portfolio strip',
    'A horizontal run of delivered work.',
  ),
  'secondary-objects': planned(
    'secondary-objects',
    'Secondary objects',
    'Smaller pieces shown as a secondary grid.',
  ),
  'journal-strip': planned('journal-strip', 'Journal strip', 'Recent journal entries as cards.'),
  'final-cta': planned('final-cta', 'Final call to action', 'The closing band before the footer.'),
  'scale-statement': planned(
    'scale-statement',
    'Scale statement',
    'A piece shown against a human reference for scale.',
  ),
  'category-intro': planned(
    'category-intro',
    'Category introduction',
    'The opening band of a category page.',
  ),
  'category-list': planned(
    'category-list',
    'Category list',
    'Categories as a vertical list with descriptions.',
  ),
  'customization-note': planned(
    'customization-note',
    'Customisation note',
    'What can and cannot be varied on a commission.',
  ),
  checklist: planned('checklist', 'Checklist', 'A list of points, each with a mark.'),
  'numbered-steps': planned(
    'numbered-steps',
    'Numbered steps',
    'Steps without media — the lighter sibling of process steps.',
  ),
  'faq-list': planned('faq-list', 'FAQ list', 'Questions and answers drawn from the FAQ table.'),
  'contact-details': planned(
    'contact-details',
    'Contact details',
    'Address, hours and channels from global content.',
  ),
  'contact-form': planned(
    'contact-form',
    'Contact form',
    'The inquiry form, which persists before any handoff.',
  ),
  'rich-text': planned('rich-text', 'Rich text', 'A long-form prose band.'),
  'media-split': planned('media-split', 'Media split', 'An image beside copy, either way round.'),
  quote: planned('quote', 'Quote', 'A pulled quotation with an attribution.'),
} as const satisfies Partial<Record<BlockType, BlockModule<PlannedPayload>>>
