import * as React from 'react'

import { Container, type ContainerSize } from '@/components/primitives/Container'
import { Section, type SectionScheme, type SectionSpacing } from '@/components/primitives/Section'
import type { BlockType } from '@/lib/cms/block-types'
import type { PageSection } from '@/lib/supabase/schemas'
import { cn } from '@/lib/ui/cn'

/**
 * The chrome every block shares: the scheme band, the vertical rhythm and the container.
 *
 * WHY `theme` IS PARSED HERE AND NOT VALIDATED IN THE DATABASE. `page_sections.theme` is a
 * nullable text column with no check constraint, deliberately: DESIGN_SYSTEM's scheme list is a
 * front-end concern that will grow, and a constraint would mean a migration every time it did.
 * The cost is that an unknown value can reach this component, so it falls back to the section's
 * default rather than throwing — a page must not 500 because someone typed "dark".
 */
const SCHEMES: Record<string, SectionScheme> = {
  DEEP: 'DEEP',
  INK: 'INK',
  BONE: 'BONE',
}

export function schemeOf(theme: string | null, fallback: SectionScheme = 'DEEP'): SectionScheme {
  if (theme === null) return fallback
  return SCHEMES[theme] ?? fallback
}

/**
 * How much silence a band gets, by what the band IS.
 *
 * FOUR STEPS WERE DECLARED IN PHASE 02 AND ONE WAS USED. Twenty-seven of the thirty call sites
 * passed `spacing="lg"`, so `sm` and `xl` were dead tokens and ten consecutive bands on `/` were
 * spaced identically — `DESIGN_SYSTEM.md` §50 asks for deliberate negative space and uniform
 * padding is the opposite of a decision. The audit recorded it as a composition finding.
 *
 * RHYTHM IS A PROPERTY OF THE BLOCK TYPE, NOT OF A CALL SITE. A manifesto wants silence around it
 * wherever it appears; a divider wants none wherever it appears. Putting the decision here means
 * it is made once, read in one place, and cannot drift between two renderers that should agree —
 * and it means the answer for a block is visible beside the answer for every other block, which
 * is the only way to see a rhythm at all.
 *
 * THE FOUR STEPS, AS EDITORIAL INTENT RATHER THAN NUMBERS:
 *
 *   `xl` — the held moment. A statement, a manifesto, the material story, the closing call. These
 *          earn their weight from what is NOT around them, and they are the reason `xl` exists.
 *   `lg` — the working rhythm. Galleries, grids, process bands: substantial, self-contained, read
 *          one after another.
 *   `md` — the sentence above a list. A category introduction, a journal strip, a testimonial row:
 *          bands that belong to their neighbour rather than standing alone.
 *   `sm` — connective tissue. A divider, an empty state, a note. Present, not announced.
 *
 * `Record<BlockType, …>` RATHER THAN A PARTIAL, for the reason `SECTION_RENDERERS` is one: it
 * forces a decision for all thirty-four, including the seven with no renderer yet. A block cannot
 * arrive later and silently inherit a default nobody chose for it.
 *
 * A RENDERER MAY STILL OVERRIDE, and two do. `divider` reads its step from its own payload because
 * the size of a gap is exactly what an editor is choosing when they place one; `hero` picks by
 * layout variant, because a full-bleed hero wants to meet the header and a contained one does not.
 * An override is a stated reason in the renderer, never a habit.
 */
const SECTION_RHYTHM: Record<BlockType, SectionSpacing> = {
  hero: 'sm',
  manifesto: 'xl',
  statement: 'xl',
  'scale-statement': 'xl',
  'material-story': 'xl',
  'signature-media': 'xl',
  'commission-cta': 'xl',
  'final-cta': 'xl',
  'category-grid': 'lg',
  'category-list': 'lg',
  'selected-works': 'lg',
  'material-palette': 'lg',
  'three-d-resin': 'lg',
  'portfolio-strip': 'lg',
  'process-steps': 'lg',
  'featured-collections': 'lg',
  'collection-products': 'lg',
  'project-gallery': 'lg',
  'commission-configurator': 'lg',
  'contact-form': 'lg',
  'media-split': 'lg',
  'category-intro': 'md',
  'journal-strip': 'md',
  'secondary-objects': 'md',
  'testimonial-strip': 'md',
  'faq-list': 'md',
  'rich-text': 'md',
  'numbered-steps': 'md',
  checklist: 'md',
  quote: 'xl',
  'contact-details': 'md',
  'customization-note': 'sm',
  'empty-state': 'sm',
  divider: 'sm',
}

/** The rhythm for a block, falling back to the working step for a value not in the union. */
export function rhythmOf(blockType: string): SectionSpacing {
  return SECTION_RHYTHM[blockType as BlockType] ?? 'lg'
}

export type SectionShellProps = {
  readonly section: PageSection
  /** Overrides the block type's own rhythm. Pass one only with a reason; see `SECTION_RHYTHM`. */
  readonly spacing?: SectionSpacing
  readonly container?: ContainerSize | 'none'
  readonly defaultScheme?: SectionScheme
  /**
   * The §4.2 entrance. On by default, and off for the first band on a page.
   *
   * A HERO MUST NEVER ANIMATE. It holds the LCP element, and §4.2's third cross-cutting rule is
   * that motion never moves it — an entrance on the largest image on the page is the one place the
   * rule has a measurable cost rather than a stylistic one. `SectionList` turns this off for
   * `isFirst`; nothing else should need to.
   */
  readonly reveal?: boolean
  readonly className?: string
  readonly children: React.ReactNode
}

/**
 * `id` IS THE SECTION'S UUID, prefixed. Anchor links need a stable target, and a slug derived
 * from the heading would change the moment an editor reworded it — quietly breaking every link
 * anyone had shared. A uuid is ugly in a URL and permanent, which is the right trade for an
 * anchor nobody types by hand.
 *
 * `data-block-type` IS WHAT MAKES AN ENTRY ADDRESSABLE, and it exists for one specific reason.
 * `data-entry-key` is unique inside its own payload array and NOT across a page: the homepage's
 * material palette has a card keyed `finish` and its process band has a step keyed `finish`, one
 * published and one withheld. A page-wide `[data-entry-key="finish"]` assertion therefore proves
 * nothing about either. Phase 11's own verification SQL already selects `s.block_type` beside the
 * entry key, and this attribute is the other half of that pair — so the test asserts what the
 * query returned, `[data-block-type="process-steps"] [data-entry-key="finish"]`, rather than
 * something weaker that happens to pass.
 */
export function SectionShell({
  section,
  spacing,
  container = 'default',
  defaultScheme = 'DEEP',
  reveal = true,
  className,
  children,
}: SectionShellProps): React.ReactElement {
  const body = container === 'none' ? children : <Container size={container}>{children}</Container>

  return (
    <Section
      id={`section-${section.id}`}
      data-block-type={section.block_type}
      scheme={schemeOf(section.theme, defaultScheme)}
      spacing={spacing ?? rhythmOf(section.block_type)}
      className={reveal ? cn('rv-reveal', className) : className}
    >
      {body}
    </Section>
  )
}
