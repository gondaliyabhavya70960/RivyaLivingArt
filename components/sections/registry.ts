import type { BlockType } from '@/lib/cms/block-types'

import { CategoryGridSection } from './CategoryGridSection'
import { CategoryIntroSection } from './CategoryIntroSection'
import { CategoryListSection } from './CategoryListSection'
import { CollectionProductsSection } from './CollectionProductsSection'
import { CommissionConfiguratorSection } from './CommissionConfiguratorSection'
import { ContactFormSection } from './ContactFormSection'
import { ProjectGallerySection } from './ProjectGallerySection'
import { TestimonialStripSection } from './TestimonialStripSection'
import { CustomizationNoteSection } from './CustomizationNoteSection'
import { CommissionCtaSection } from './CommissionCtaSection'
import { DividerSection } from './DividerSection'
import { EmptyStateSection } from './EmptyStateSection'
import { FeaturedCollectionsSection } from './FeaturedCollectionsSection'
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
import { SignatureMediaSection } from './SignatureMediaSection'
import { StatementSection } from './StatementSection'
import { ThreeDResinSection } from './ThreeDResinSection'
import type { SectionRenderer } from './types'

import { ChecklistSection } from './ChecklistSection'
import { ContactDetailsSection } from './ContactDetailsSection'
import { FaqListSection } from './FaqListSection'
import { MediaSplitSection } from './MediaSplitSection'
import { NumberedStepsSection } from './NumberedStepsSection'
import { QuoteSection } from './QuoteSection'
import { RichTextSection } from './RichTextSection'

/**
 * Block type to renderer.
 *
 * A SECOND REGISTRY, DELIBERATELY. `lib/cms/registry.ts` holds the schemas, defaults and labels
 * and imports no React, which is what lets the schedule cron and the seed runner read block
 * metadata in a process with no component tree. This one holds the components. Merging them would
 * pull React into every Node script that wants to know what fields a hero has.
 *
 * `null` MEANS PLANNED, AND EXHAUSTIVENESS IS THE POINT: `Record<BlockType, …>` forces a decision
 * for every one of the 34. A block cannot be forgotten here — only explicitly declared as having
 * no renderer yet. `tests/unit/cms-sections.test.tsx` asserts the two registries agree: every
 * block the module registry calls BUILT has a renderer, and every PLANNED one has null.
 *
 * **THERE ARE NO NULLS. All 34 are built** — Phase 45 promoted the last seven. The union keeps the
 * `| null` because the mechanism is what matters: the next block declared ahead of its renderer
 * goes in as `null` here, and `content/blocks/planned.ts` still holds the other half of it.
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
  'featured-collections': FeaturedCollectionsSection,
  'final-cta': FinalCtaSection,
  statement: StatementSection,
  'scale-statement': ScaleStatementSection,
  'category-intro': CategoryIntroSection,
  'category-list': CategoryListSection,
  'customization-note': CustomizationNoteSection,
  'signature-media': SignatureMediaSection,
  'collection-products': CollectionProductsSection,
  'project-gallery': ProjectGallerySection,
  'testimonial-strip': TestimonialStripSection,
  'commission-configurator': CommissionConfiguratorSection,
  checklist: ChecklistSection,
  'numbered-steps': NumberedStepsSection,
  'faq-list': FaqListSection,
  'contact-details': ContactDetailsSection,
  'contact-form': ContactFormSection,
  'empty-state': EmptyStateSection,
  'rich-text': RichTextSection,
  'media-split': MediaSplitSection,
  quote: QuoteSection,
  divider: DividerSection,
} satisfies Record<BlockType, SectionRenderer | null>

export function sectionRenderer(type: BlockType): SectionRenderer | null {
  return SECTION_RENDERERS[type]
}
