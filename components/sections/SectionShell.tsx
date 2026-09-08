import * as React from 'react'

import { Container, type ContainerSize } from '@/components/primitives/Container'
import { Section, type SectionScheme, type SectionSpacing } from '@/components/primitives/Section'
import type { PageSection } from '@/lib/supabase/schemas'

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

export type SectionShellProps = {
  readonly section: PageSection
  readonly spacing?: SectionSpacing
  readonly container?: ContainerSize | 'none'
  readonly defaultScheme?: SectionScheme
  readonly className?: string
  readonly children: React.ReactNode
}

/**
 * `id` IS THE SECTION'S UUID, prefixed. Anchor links need a stable target, and a slug derived
 * from the heading would change the moment an editor reworded it — quietly breaking every link
 * anyone had shared. A uuid is ugly in a URL and permanent, which is the right trade for an
 * anchor nobody types by hand.
 */
export function SectionShell({
  section,
  spacing = 'lg',
  container = 'default',
  defaultScheme = 'DEEP',
  className,
  children,
}: SectionShellProps): React.ReactElement {
  const body = container === 'none' ? children : <Container size={container}>{children}</Container>

  return (
    <Section
      id={`section-${section.id}`}
      scheme={schemeOf(section.theme, defaultScheme)}
      spacing={spacing}
      className={className}
    >
      {body}
    </Section>
  )
}
