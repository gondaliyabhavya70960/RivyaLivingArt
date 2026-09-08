import type { BlockType } from '@/lib/cms/block-types'

import { CategoryGridSection } from './CategoryGridSection'
import { DividerSection } from './DividerSection'
import { EmptyStateSection } from './EmptyStateSection'
import { HeroSection } from './HeroSection'
import { ProcessStepsSection } from './ProcessStepsSection'
import { StatementSection } from './StatementSection'
import type { SectionRenderer } from './types'

/**
 * Block type to renderer.
 *
 * A SECOND REGISTRY, DELIBERATELY. `lib/cms/registry.ts` holds the schemas, defaults and labels
 * and imports no React, which is what lets the schedule cron and the seed runner read block
 * metadata in a process with no component tree. This one holds the components. Merging them would
 * pull React into every Node script that wants to know what fields a hero has.
 *
 * `null` MEANS PLANNED, AND EXHAUSTIVENESS IS THE POINT: `Record<BlockType, …>` forces a decision
 * for every one of the 28. A block cannot be forgotten here — only explicitly declared as having
 * no renderer yet. `tests/unit/cms-sections.test.tsx` asserts the two registries agree: every
 * block the module registry calls BUILT has a renderer, and every PLANNED one has null.
 */
export const SECTION_RENDERERS = {
  hero: HeroSection,
  manifesto: null,
  'category-grid': CategoryGridSection,
  'selected-works': null,
  'material-story': null,
  'material-palette': null,
  'commission-cta': null,
  'three-d-resin': null,
  'portfolio-strip': null,
  'process-steps': ProcessStepsSection,
  'secondary-objects': null,
  'journal-strip': null,
  'final-cta': null,
  statement: StatementSection,
  'scale-statement': null,
  'category-intro': null,
  'category-list': null,
  'customization-note': null,
  checklist: null,
  'numbered-steps': null,
  'faq-list': null,
  'contact-details': null,
  'contact-form': null,
  'empty-state': EmptyStateSection,
  'rich-text': null,
  'media-split': null,
  quote: null,
  divider: DividerSection,
} satisfies Record<BlockType, SectionRenderer | null>

export function sectionRenderer(type: BlockType): SectionRenderer | null {
  return SECTION_RENDERERS[type]
}
