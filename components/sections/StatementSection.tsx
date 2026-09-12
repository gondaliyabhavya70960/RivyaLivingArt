import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * An editorial band with no media. The smallest block that renders anything.
 *
 * RETURNS NULL WHEN NOTHING IS WRITTEN. `SectionCopy` already returns null for an empty section;
 * without this check the shell would still paint a scheme band and its vertical rhythm, so an
 * unfilled statement would appear as a stripe of colour with nothing in it — which reads as a
 * rendering fault rather than as absent copy.
 */
export function StatementSection({
  section,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  if (!hasSectionCopy(section)) return null

  const centred = section.layout_variant === 'centred'

  return (
    <SectionShell section={section} container="prose">
      <Stack gap={6} className={centred ? 'items-center' : ''}>
        <SectionCopy section={section} size="display-lg" align={centred ? 'centre' : 'start'} />
        <SectionActions
          section={section}
          livePaths={livePaths}
          align={centred ? 'centre' : 'start'}
        />
      </Stack>
    </SectionShell>
  )
}
