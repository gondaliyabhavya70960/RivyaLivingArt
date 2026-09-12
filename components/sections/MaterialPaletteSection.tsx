import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { materialPaletteBlock } from '@/content/blocks/material-palette'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionCopy, cardHeadingLevel } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * One card per material.
 *
 * IT MUST LOOK RIGHT AT THREE CARDS AS WELL AS FOUR, and that is a requirement rather than a
 * nicety: SEED §10-06 marks the third statement, "Fabricated Form", `OWNER_VERIFICATION_REQUIRED`,
 * so the published band carries Resin, Wood and Finish until the owner confirms the fourth claim.
 * A grid hard-coded to four columns would leave a hole exactly where the withheld card was, which
 * tells a visitor something has been removed — the opposite of what withholding is for.
 *
 * SO THE COLUMN COUNT FOLLOWS WHAT SURVIVED THE FILTER, capped at four. The classes are written
 * out as literals rather than composed from the number, because Tailwind's scanner reads source
 * text: `lg:grid-cols-${n}` produces no CSS at all and the grid silently stays one column.
 */
/** Indexed by how many cards there are, so the lookup is total for 0-4 and clamped above. */
const COLUMN_CLASS = [
  '',
  'lg:grid-cols-1',
  'lg:grid-cols-2',
  'lg:grid-cols-3',
  'lg:grid-cols-4',
] as const

export function MaterialPaletteSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(materialPaletteBlock, section.payload)
  const materials = visibleEntries(payload.materials).filter(
    (material) => material.title.trim() !== '',
  )
  if (materials.length === 0) return null

  const assets = media.slot('materials')
  const columns = COLUMN_CLASS[Math.min(materials.length, 4)] ?? ''

  return (
    <SectionShell section={section}>
      <Stack gap={10}>
        <SectionCopy section={section} />
        <Grid gap={6} className={`grid-cols-1 sm:grid-cols-2 ${columns}`}>
          {materials.map((material) => {
            const index = material.media_index ?? null
            return (
              <Stack key={material.key} data-entry-key={material.key} gap={3}>
                <BlockImage
                  asset={index === null ? null : (assets[index] ?? null)}
                  ratio="1:1"
                  mobileRatio="4:5"
                  preset="card"
                  sizes="(min-width: 1024px) 25vw, (min-width: 430px) 50vw, 100vw"
                  strings={strings}
                  cloudName={cloudName}
                />
                <Heading level={cardHeadingLevel(section)} size="display-xs">
                  {material.title}
                </Heading>
                {material.description.trim() === '' ? null : (
                  <Text size="base" tone="secondary">
                    {material.description}
                  </Text>
                )}
              </Stack>
            )
          })}
        </Grid>
      </Stack>
    </SectionShell>
  )
}
