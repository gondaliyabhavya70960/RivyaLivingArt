import * as React from 'react'

import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Heading, type HeadingLevel, type HeadingSize } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * The five shared copy fields, rendered the same way everywhere they appear.
 *
 * EVERY FIELD IS OPTIONAL AND AN ABSENT ONE RENDERS NOTHING — no placeholder, no dash, no
 * "Untitled". A section with no heading is a section whose heading has not been written, and
 * inventing one is the SEED §55 failure. This is also why there is no `heading ?? 'Section'`
 * anywhere below: the fallback would be indistinguishable from real copy on the rendered page.
 *
 * `heading_highlight` IS A SUBSTRING OF `heading`, not a suffix appended to it. `Heading`'s
 * `highlight` prop wraps the matching run in `HeadingHighlight`; a highlight that does not occur
 * in the heading simply does not match and the heading renders plain, which is the right failure
 * for an editor who reworded one field and not the other.
 */
export type SectionCopyProps = {
  readonly section: PageSection
  /** `1` for the page's own opener, `2` for every band beneath it. Never skips a level. */
  readonly level?: HeadingLevel
  readonly size?: HeadingSize
  readonly align?: 'start' | 'centre'
  readonly maxWidth?: 'prose' | 'none'
}

/**
 * Does this section have any copy at all?
 *
 * EXPORTED BECAUSE A CALLER CANNOT ASK THE COMPONENT. `<SectionCopy … />` is a React element
 * whether or not it will render null — the element is always truthy — so a block deciding
 * "render nothing if there is no copy" has to ask the data, not the JSX. A guard written as
 * `const copy = <SectionCopy … />; if (copy === null)` compiles, type-checks, and never fires.
 */
export function hasSectionCopy(section: PageSection): boolean {
  return (
    section.eyebrow !== null ||
    section.heading !== null ||
    section.body !== null ||
    section.supporting !== null
  )
}

export function SectionCopy({
  section,
  level = 2,
  size = 'display-md',
  align = 'start',
  maxWidth = 'prose',
}: SectionCopyProps): React.ReactElement | null {
  const { eyebrow, heading, heading_highlight, body, supporting } = section
  if (!hasSectionCopy(section)) return null

  return (
    <Stack
      gap={4}
      className={[
        align === 'centre' ? 'items-center text-center' : '',
        maxWidth === 'prose' ? 'max-w-(--rv-container-prose)' : '',
        align === 'centre' && maxWidth === 'prose' ? 'mx-auto' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {eyebrow !== null ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {heading !== null ? (
        <Heading level={level} size={size} highlight={heading_highlight ?? undefined}>
          {heading}
        </Heading>
      ) : null}
      {body !== null ? (
        <Text size="lg" tone="secondary">
          {body}
        </Text>
      ) : null}
      {supporting !== null ? (
        <Text size="base" tone="tertiary">
          {supporting}
        </Text>
      ) : null}
    </Stack>
  )
}
