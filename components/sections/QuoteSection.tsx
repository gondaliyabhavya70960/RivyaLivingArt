import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { quoteBlock } from '@/content/blocks/quote'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * A pulled quotation with an attribution.
 *
 * `<blockquote>` AND `<cite>`, NOT A STYLED PARAGRAPH. The element is what tells a screen reader
 * that these are somebody else's words, and that distinction is the entire content of the band: a
 * sentence the studio wrote and a sentence a customer said look identical in a `<p>`.
 *
 * `cite` IS AN ATTRIBUTE AND NEVER A LINK. HTML's `cite` attribute is machine-readable provenance;
 * rendering it as an anchor would put a destination on the page that the visible text does not
 * name. A publication an editor wants people to see goes in `source`, which is text.
 *
 * AN UNATTRIBUTED QUOTATION IS THE SAFE CASE AND IS FULLY SUPPORTED. A name here is a claim about a
 * real customer, which D10 puts with the owner: the section carries `owner_verification` and the
 * Phase 08 publish trigger withholds the whole band until they confirm it — the right mechanism
 * because there is nothing left of a quote once its words are withheld. Nothing in this repository
 * seeds one with a name attached.
 *
 * THE ATTRIBUTION RENDERS ONLY WITH A QUOTATION. A name under an empty blockquote would attribute
 * silence to somebody.
 */
export function QuoteSection({ section }: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(quoteBlock, section.payload)
  const quote = payload.quote.trim()
  if (quote === '') return null

  const attribution = payload.attribution.trim()
  const source = payload.source.trim()
  const cite = payload.cite.trim()
  const centred = (section.layout_variant ?? 'centred') === 'centred'

  return (
    <SectionShell section={section} container="prose">
      <Stack gap={6} className={centred ? 'items-center text-center' : ''}>
        <SectionCopy
          section={section}
          size="display-xs"
          align={centred ? 'centre' : 'start'}
          maxWidth="none"
        />

        <blockquote {...(cite === '' ? {} : { cite })} data-quote>
          <Text as="p" size="lg" className="font-display leading-display text-ink">
            {quote}
          </Text>
        </blockquote>

        {attribution === '' ? null : (
          <Text as="p" size="sm" tone="tertiary">
            <cite className="not-italic">{attribution}</cite>
            {source === '' ? null : <span className="block">{source}</span>}
          </Text>
        )}
      </Stack>
    </SectionShell>
  )
}
