import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { interpolate, siteString } from '@/lib/cms/strings'

import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Quotes from real people. Renders nothing today, and for as long as there are none.
 *
 * NO EMPTY STATE, DELIBERATELY, and this is the one band on the site that gets none. The other
 * empty surfaces say something true about themselves — "this collection is being prepared", "the
 * project archive is being prepared" — because a visitor arriving at `/collection` or `/portfolio`
 * came looking for that thing and deserves an answer. Nobody navigates to a testimonial band. A
 * sentence explaining that Rivya has no testimonials yet would be an announcement of an absence
 * nobody asked about, printed under a heading, on a page about something else.
 *
 * SO THE WHOLE SECTION IS ABSENT, heading included. `SectionCopy` renders only alongside quotes;
 * with none there is nothing for the heading to head.
 *
 * THE ATTRIBUTION IS RENDERED ONLY WHERE CONSENT IS GRANTED, and that is guaranteed upstream rather
 * than checked here: `enforce_testimonial_evidence_gate` refuses to publish a quote that names
 * someone without GRANTED consent, and withdrawal archives the row on the same statement it
 * arrives. A published, attributed quote therefore has consent behind it by construction — and an
 * unattributed one is a quote whose author chose not to be named, which is rendered as written.
 */

const HEADING_KEY = 'UI_LABEL.testimonial.heading'
const ATTRIBUTION_KEY = 'UI_LABEL.testimonial.attribution'

export function TestimonialStripSection({
  section,
  strings,
  reference,
}: SectionRenderProps): React.ReactElement | null {
  const quotes = reference?.result.cards ?? []
  if (quotes.length === 0) return null

  const heading = siteString(strings, HEADING_KEY)
  const attribution = siteString(strings, ATTRIBUTION_KEY)

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={6}>
        {heading === null ? null : (
          <Text size="sm" tone="secondary" data-testimonial-heading="">
            {heading}
          </Text>
        )}
        <SectionCopy section={section} />

        <ul role="list" data-testimonial-strip="" className="grid gap-6 sm:grid-cols-2">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <figure className="m-0">
                <blockquote className="m-0">
                  <Text>{quote.title}</Text>
                </blockquote>
                {/*
                  `summary` carries the attribution the selector already assembled from the row's
                  consent-gated columns. Absent when the quote is unattributed, which is a choice
                  its author made rather than a missing field.
                */}
                {quote.summary === null || attribution === null ? null : (
                  <figcaption
                    data-testimonial-attribution=""
                    className="text-ink-secondary mt-2 text-sm"
                  >
                    {interpolate(attribution, { name: quote.summary, role: quote.key })}
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      </Stack>
    </SectionShell>
  )
}
