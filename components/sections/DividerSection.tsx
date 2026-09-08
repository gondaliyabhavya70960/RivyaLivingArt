import * as React from 'react'

import { Divider } from '@/components/primitives/Divider'
import { dividerBlock } from '@/content/blocks/divider'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Space, optionally with a rule.
 *
 * IT STILL GOES THROUGH `SectionShell`, which looks like ceremony for a horizontal line and is
 * not: the shell is what gives the block its scheme band and its `section-<id>` anchor. A divider
 * between a DEEP band and a BONE one has to be one or the other, and an editor who set its theme
 * expects to see it.
 */
const SPACING = {
  tight: 'sm',
  normal: 'md',
  loose: 'xl',
} as const

export function DividerSection({ section }: SectionRenderProps): React.ReactElement {
  const payload = parseBlockPayload(dividerBlock, section.payload)

  return (
    <SectionShell section={section} spacing={SPACING[payload.spacing]} container="default">
      {payload.rule ? <Divider /> : <div aria-hidden="true" />}
    </SectionShell>
  )
}
