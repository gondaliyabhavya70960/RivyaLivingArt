import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'

import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * A long-form prose band: a document heading and paragraphs beneath it. FEAT §8 element 9.
 *
 * PLAIN TEXT, NOT MARKUP, AND THAT IS THE WHOLE OF AMENDMENT A14's OBJECTION ANSWERED. A14 declined
 * to build this in Phase 16 because "a rich-text document needs a sanitiser, an allow-list of
 * elements, a decision about embedded media and a Studio editor that is not a JSON textarea". Every
 * one of those costs belongs to a block whose payload holds HTML. This block has no payload at all:
 * `body` is the same plain-text field every other band uses, and `SectionCopy` splits it on blank
 * lines into paragraphs. There is no markup to allow, so there is nothing to sanitise.
 *
 * `display-sm`, NOT `display-lg`. This is where it differs from `StatementSection`, which is the
 * fair question to ask of a second block with no payload. A statement is one editorial idea set
 * large; this is a clause in a document, and `/privacy` is a dozen of them in a row. At display
 * scale a legal page reads as a series of announcements.
 *
 * NO CALL TO ACTION, deliberately, and that is why `cta_label` is not among the block's shared
 * fields. A terms page does not have a next step; a band that offers one is an editorial band, and
 * the editorial band is `statement`.
 *
 * RETURNS NULL WHEN NOTHING IS WRITTEN, like every band: the shell would otherwise paint a scheme
 * stripe with nothing in it, which reads as a rendering fault rather than as absent copy.
 */
export function RichTextSection({ section }: SectionRenderProps): React.ReactElement | null {
  if (!hasSectionCopy(section)) return null

  const wide = (section.layout_variant ?? 'prose') === 'wide'

  return (
    <SectionShell section={section} container={wide ? 'default' : 'prose'}>
      <Stack gap={6}>
        <SectionCopy section={section} size="display-sm" maxWidth={wide ? 'none' : 'prose'} />
      </Stack>
    </SectionShell>
  )
}
