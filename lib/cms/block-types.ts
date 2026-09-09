import { z } from 'zod'

/**
 * Every block type the CMS knows: the PHASE-05-09 §08 catalogue of 28, plus the two an exhibition
 * page needs (amendment A14).
 *
 * THE TUPLE IS THE SOURCE. `BlockType` is derived from it, the registry is keyed by it, and
 * `blockTypeSchema` validates against it — so adding a block means adding one string here and
 * then following the compile errors, which is a far better guide than a checklist in a document.
 *
 * ALL 30 ARE LISTED EVEN THOUGH NOT ALL ARE BUILT. The alternative — listing only what ships —
 * would make `block_type` on an unbuilt block fail validation at read time rather than render an
 * honest "not built yet", and would hide from a reader how much of the catalogue is outstanding.
 * `lib/cms/registry.ts` records each one's state; `tests/unit/cms-registry.test.ts` asserts that a
 * block claiming to be BUILT actually has its three parts.
 *
 * `z.enum(BLOCK_TYPES)` NEEDS THE `as const`, and must NOT be given the
 * `as [string, ...string[]]` cast that Zod examples often show — that widens every member to
 * `string` and destroys the union, taking the compile-time exhaustiveness with it.
 */
export const BLOCK_TYPES = [
  // Homepage, SEED §10
  'hero',
  'manifesto',
  'category-grid',
  'selected-works',
  'material-story',
  'material-palette',
  'commission-cta',
  'three-d-resin',
  'portfolio-strip',
  'process-steps',
  'secondary-objects',
  'journal-strip',
  'final-cta',
  // Editorial and category surfaces
  'statement',
  'scale-statement',
  'category-intro',
  'category-list',
  'customization-note',
  'checklist',
  'numbered-steps',
  // Collections and exhibitions, FEAT §8 — added in Phase 16
  'signature-media',
  'collection-products',
  // Query-backed
  'faq-list',
  'contact-details',
  'contact-form',
  // Generic, editor-composable
  'empty-state',
  'rich-text',
  'media-split',
  'quote',
  'divider',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export const blockTypeSchema = z.enum(BLOCK_TYPES)

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && (BLOCK_TYPES as readonly string[]).includes(value)
}
