import type { BlockType } from '@/lib/cms/block-types'

import { CategoryGridSection } from './CategoryGridSection'
import { CommissionCtaSection } from './CommissionCtaSection'
import { DividerSection } from './DividerSection'
import { EmptyStateSection } from './EmptyStateSection'
import { FinalCtaSection } from './FinalCtaSection'
import { HeroSection } from './HeroSection'
import { JournalStripSection } from './JournalStripSection'
import { ManifestoSection } from './ManifestoSection'
import { MaterialPaletteSection } from './MaterialPaletteSection'
import { MaterialStorySection } from './MaterialStorySection'
import { PortfolioStripSection } from './PortfolioStripSection'
import { ProcessStepsSection } from './ProcessStepsSection'
import { ScaleStatementSection } from './ScaleStatementSection'
import { SecondaryObjectsSection } from './SecondaryObjectsSection'
import { SelectedWorksSection } from './SelectedWorksSection'
import { StatementSection } from './StatementSection'
import { ThreeDResinSection } from './ThreeDResinSection'
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
  manifesto: ManifestoSection,
  'category-grid': CategoryGridSection,
  'selected-works': SelectedWorksSection,
  'material-story': MaterialStorySection,
  'material-palette': MaterialPaletteSection,
  'commission-cta': CommissionCtaSection,
  'three-d-resin': ThreeDResinSection,
  'portfolio-strip': PortfolioStripSection,
  'process-steps': ProcessStepsSection,
  'secondary-objects': SecondaryObjectsSection,
  'journal-strip': JournalStripSection,
  'final-cta': FinalCtaSection,
  statement: StatementSection,
  'scale-statement': ScaleStatementSection,
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
