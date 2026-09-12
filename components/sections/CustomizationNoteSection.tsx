import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * What changes when a piece is made to order. SEED §12-04.
 *
 * IT REFUSES TO RENDER UNVERIFIED, AND THAT CHECK SHOULD BE UNREACHABLE. Phase 08's publish trigger
 * already refuses to move a section carrying `OWNER_VERIFICATION_REQUIRED` to `PUBLISHED`, and a
 * page only renders published sections — so a flagged section cannot reach this component through
 * the normal path. The branch exists for the paths that are not normal: the Studio preview, which
 * renders drafts by design, and any future surface that composes sections without going through
 * the publish gate.
 *
 * WHY THIS SECTION AND NOT EVERY SECTION. The statement describes what a large-format commission
 * involves — access, weight, structural considerations, base design — which is a service claim
 * about work Rivya would have to actually do. Most sections describe materials or intent, where an
 * accidental early publish is a copy error; here it would be a promise. Two mechanisms for one
 * rule is the right ratio only where the cost of being wrong is that high, which is why this is
 * the one renderer that carries the check.
 */
export function CustomizationNoteSection({
  section,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  if (section.owner_verification === 'OWNER_VERIFICATION_REQUIRED') return null
  if (!hasSectionCopy(section)) return null

  const banded = (section.layout_variant ?? 'banded') === 'banded'

  return (
    <SectionShell
      section={section}

      container="prose"
      defaultScheme={banded ? 'INK' : 'DEEP'}
    >
      <Stack gap={6}>
        <SectionCopy section={section} size="display-md" />
        <SectionActions section={section} livePaths={livePaths} />
      </Stack>
    </SectionShell>
  )
}
