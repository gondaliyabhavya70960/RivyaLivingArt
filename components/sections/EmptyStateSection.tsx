import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { emptyStateBlock } from '@/content/blocks/empty-state'
import { parseBlockPayload } from '@/lib/cms/registry'
import { siteString } from '@/lib/cms/strings'

import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The honest empty surface (SEED §27–§29).
 *
 * ITS MESSAGE COMES FROM `global_content`, NOT FROM THE SECTION, so `/portfolio`, `/journal` and
 * `/collection` say the same thing in the same voice and an editor fixes the wording once.
 *
 * NO MESSAGE MEANS NO SECTION. If `content_key` is unset, or names a row that is missing or
 * disabled, this renders nothing at all — not a grey box, not "coming soon", not the key. This is
 * D10 in force: Rivya's delivered work has not been confirmed, so `/portfolio` must not imply
 * there is something to see. A placeholder here would be a sentence nobody wrote appearing on the
 * site, which is precisely what an empty state exists to avoid.
 */
export function EmptyStateSection({
  section,
  strings,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(emptyStateBlock, section.payload)
  if (payload.content_key === null) return null

  const message = siteString(strings, `EMPTY_STATE.${payload.content_key}`)
  if (message === null) return null

  return (
    <SectionShell section={section} container="prose">
      <Stack gap={6} className="items-center text-center">
        <SectionCopy section={section} align="centre" size="display-sm" />
        <Text size="lg" tone="secondary">
          {message}
        </Text>
        {payload.show_cta ? (
          <SectionActions section={section} livePaths={livePaths} align="centre" />
        ) : null}
      </Stack>
    </SectionShell>
  )
}
