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
 * `heading_highlight` IS APPENDED TO THE HEADING, inside the same element so that it lands in the
 * accessible name — `Heading` states the contract and `HeadingHighlight` is exported for the case
 * this cannot express, a highlighted run in the MIDDLE of a sentence. An editor who wants that
 * writes the whole heading here and the section gets a plain one, which is a visible outcome
 * rather than a silent one.
 *
 * THE EDITOR'S OWN LINE BREAKS SURVIVE. SEED §10 writes two of the homepage's headings as line
 * sequences — "Objects shaped by flow. / Built to live with." and the four words LIQUID. FORM.
 * CRAFT. OBJECT. — and in HTML a newline is whitespace, so without `whitespace-pre-line` the
 * cadence the specification set collapses into one run of text. The alternative, a `<br>` per
 * break, would mean an editor typing markup into a text field.
 *
 * A BLANK LINE STARTS A NEW PARAGRAPH, for the same reason and one step further: `body` holds two
 * paragraphs in several seeded sections, and a single `<p>` containing both is wrong for a screen
 * reader (one paragraph announced), wrong for typography (no paragraph rhythm) and wrong for
 * selection. Splitting on a blank line is the convention every plain-text field in the project
 * already uses, and it needs nothing of the editor.
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

/** A blank line — one newline, optional spaces, another newline — separates two paragraphs. */
const PARAGRAPH_BREAK = /\n\s*\n/

function paragraphsOf(copy: string): readonly string[] {
  return copy
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
}

/**
 * One CMS text field as one or more paragraphs.
 *
 * `whitespace-pre-line` RATHER THAN `pre-wrap`: the editor's line breaks are meaning and their
 * indentation is not. `pre-wrap` would preserve the leading spaces of a pasted paragraph as a
 * visible indent nobody typed on purpose.
 */
function CopyParagraphs({
  copy,
  size,
  tone,
}: {
  readonly copy: string
  readonly size: 'lg' | 'base'
  readonly tone: 'secondary' | 'tertiary'
}): React.ReactElement | null {
  const paragraphs = paragraphsOf(copy)
  if (paragraphs.length === 0) return null

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} size={size} tone={tone} className="whitespace-pre-line">
          {paragraph}
        </Text>
      ))}
    </>
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
        <Heading
          level={level}
          size={size}
          highlight={heading_highlight ?? undefined}
          className="whitespace-pre-line"
        >
          {heading}
        </Heading>
      ) : null}
      {body !== null ? <CopyParagraphs copy={body} size="lg" tone="secondary" /> : null}
      {supporting !== null ? (
        <CopyParagraphs copy={supporting} size="base" tone="tertiary" />
      ) : null}
    </Stack>
  )
}
