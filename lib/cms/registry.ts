import { collectionProductsBlock } from '@/content/blocks/collection-products'
import { projectGalleryBlock } from '@/content/blocks/project-gallery'
import { testimonialStripBlock } from '@/content/blocks/testimonial-strip'
import { categoryGridBlock } from '@/content/blocks/category-grid'
import { categoryIntroBlock } from '@/content/blocks/category-intro'
import { categoryListBlock } from '@/content/blocks/category-list'
import { customizationNoteBlock } from '@/content/blocks/customization-note'
import { commissionCtaBlock } from '@/content/blocks/commission-cta'
import { finalCtaBlock } from '@/content/blocks/final-cta'
import { journalStripBlock } from '@/content/blocks/journal-strip'
import { manifestoBlock } from '@/content/blocks/manifesto'
import { materialPaletteBlock } from '@/content/blocks/material-palette'
import { materialStoryBlock } from '@/content/blocks/material-story'
import { portfolioStripBlock } from '@/content/blocks/portfolio-strip'
import { secondaryObjectsBlock } from '@/content/blocks/secondary-objects'
import { selectedWorksBlock } from '@/content/blocks/selected-works'
import { signatureMediaBlock } from '@/content/blocks/signature-media'
import { threeDResinBlock } from '@/content/blocks/three-d-resin'
import { dividerBlock } from '@/content/blocks/divider'
import { emptyStateBlock } from '@/content/blocks/empty-state'
import { heroBlock } from '@/content/blocks/hero'
import { PLANNED_BLOCKS } from '@/content/blocks/planned'
import { processStepsBlock } from '@/content/blocks/process-steps'
import { scaleStatementBlock } from '@/content/blocks/scale-statement'
import { statementBlock } from '@/content/blocks/statement'

import { type AnyBlockModule, type BlockModule } from './block-module'
import { BLOCK_TYPES, type BlockType, isBlockType } from './block-types'

/**
 * The single place that knows which block modules exist.
 *
 * IT IMPORTS NO REACT, deliberately — see `block-block.ts`. Renderers are registered separately
 * in `components/sections/`, keyed by the same union, so a Node script can ask what fields a hero
 * has without loading a component tree.
 *
 * EXHAUSTIVENESS IS ENFORCED BY THE COMPILER, not by a test. `satisfies Record<BlockType, …>`
 * makes a missing key a build error naming the block. A test could only catch it at run time, and
 * only if someone remembered to write it.
 */
const BUILT_BLOCKS = {
  hero: heroBlock,
  manifesto: manifestoBlock,
  'category-grid': categoryGridBlock,
  'selected-works': selectedWorksBlock,
  'material-story': materialStoryBlock,
  'material-palette': materialPaletteBlock,
  'commission-cta': commissionCtaBlock,
  'three-d-resin': threeDResinBlock,
  'portfolio-strip': portfolioStripBlock,
  'process-steps': processStepsBlock,
  'secondary-objects': secondaryObjectsBlock,
  'journal-strip': journalStripBlock,
  'final-cta': finalCtaBlock,
  'scale-statement': scaleStatementBlock,
  'category-intro': categoryIntroBlock,
  'category-list': categoryListBlock,
  'customization-note': customizationNoteBlock,
  statement: statementBlock,
  'signature-media': signatureMediaBlock,
  'collection-products': collectionProductsBlock,
  'project-gallery': projectGalleryBlock,
  'testimonial-strip': testimonialStripBlock,
  'empty-state': emptyStateBlock,
  divider: dividerBlock,
} as const satisfies Partial<Record<BlockType, AnyBlockModule>>

/**
 * Every block, built and planned.
 *
 * The `satisfies` is the whole point of the file: drop a block from `BUILT_BLOCKS` without adding
 * it to `PLANNED_BLOCKS` and this line fails to compile, naming the type that went missing.
 *
 * NO `as` CAST ON THIS EXPRESSION. `x as Record<BlockType, …> satisfies Record<BlockType, …>`
 * compiles for any x at all — the assertion answers the question the `satisfies` was asked, and
 * the exhaustiveness it appears to prove is worth nothing. Both spread sources therefore carry
 * literal keys, so the object's own type has all 32 and the check is real. Delete `hero` from
 * `BUILT_BLOCKS` and this line fails, naming it.
 *
 * The payload parameter is erased to `unknown`. A registry entry is looked up by a runtime string,
 * so its payload type is not statically knowable at the call site anyway — `parseBlockPayload`
 * below is where the type comes back, narrowed by the block you pass it. `never` would be wrong in
 * the other direction: nothing is assignable to `BlockModule<never>`.
 *
 * Built entries are spread last so a type present in both wins as BUILT, which is the state that
 * has a renderer. `tests/unit/cms-registry.test.ts` asserts the two lists do not overlap.
 */
export const BLOCK_REGISTRY = {
  ...PLANNED_BLOCKS,
  ...BUILT_BLOCKS,
} satisfies Record<BlockType, AnyBlockModule>

/** The block for a block type. Total over `BlockType`, so no caller needs a null branch. */
export function blockModule(type: BlockType): AnyBlockModule {
  return BLOCK_REGISTRY[type]
}

/**
 * The block for a `block_type` string read from the database, or null if it is not a block type
 * at all. Use this at the read boundary; use `blockModule` everywhere downstream.
 */
export function blockModuleFor(type: string): AnyBlockModule | null {
  return isBlockType(type) ? BLOCK_REGISTRY[type] : null
}

export function isBuilt(type: BlockType): boolean {
  return BLOCK_REGISTRY[type].state === 'BUILT'
}

/** Block types with a renderer, in catalogue order. */
export const BUILT_BLOCK_TYPES: readonly BlockType[] = BLOCK_TYPES.filter(isBuilt)

/**
 * Blocks an editor may add to a page, in catalogue order.
 *
 * Planned blocks are excluded rather than shown disabled: this list feeds the picker's options,
 * and Studio renders the outstanding catalogue separately so the exclusion is visible rather than
 * silent.
 */
export function addableBlocks(path: string | null): readonly AnyBlockModule[] {
  return BUILT_BLOCK_TYPES.map(blockModule).filter((block) => {
    if (block.allowedPages === null) return true
    return path !== null && block.allowedPages.includes(path)
  })
}

/**
 * Parse a section's `payload` against its block's schema.
 *
 * RETURNS THE DEFAULTS ON A PARSE FAILURE rather than throwing. A payload that no longer matches
 * its schema is a migration that has not caught up, and a page of otherwise-good sections should
 * not 500 because one block gained a required field. The Studio surfaces the mismatch; the public
 * site renders the block's default shape, which is the same thing a newly added block shows.
 */
export function parseBlockPayload<Payload>(
  block: Pick<BlockModule<Payload>, 'schema' | 'defaults'>,
  payload: unknown,
): Payload {
  const parsed = block.schema.safeParse(payload ?? {})
  return parsed.success ? parsed.data : block.defaults
}
