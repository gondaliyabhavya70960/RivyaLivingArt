import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Tag } from '@/components/primitives/Tag'
import { commissionCtaBlock } from '@/content/blocks/commission-cta'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The commission invitation, and the list of what a client may specify.
 *
 * AT LAUNCH THE LIST IS EMPTY AND THE BAND STILL PUBLISHES. SEED §10-07 says "only publish
 * capabilities confirmed by owner", and all six chips are seeded `OWNER_VERIFICATION_REQUIRED` —
 * so what a visitor sees is the heading, the paragraph and the call to action, none of which
 * claims a capability, and no list at all. That is the entry-level mechanism doing exactly what it
 * was built for: withholding the section would have withheld the invitation too.
 *
 * NO EMPTY CHIP RAIL. When nothing survives the filter the `<ul>` is not rendered — an empty list
 * is announced as "list, 0 items" and drawn as a gap in the layout, which reads as a load that
 * failed rather than as a list nobody has confirmed yet.
 *
 * THE CHIPS ARE A LIST, NOT A SENTENCE. Each is a term a client can ask for; `Cluster as="ul"`
 * gives the group its `role="list"` and `Tag as="li"` its members, so the six are announced as six
 * rather than run together.
 */
export function CommissionCtaSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(commissionCtaBlock, section.payload)
  const capabilities = visibleEntries(payload.capabilities).filter(
    (capability) => capability.label.trim() !== '',
  )

  const banded = (section.layout_variant ?? 'split') === 'banded'

  const copy = (
    <Stack gap={6}>
      <SectionCopy section={section} />
      {capabilities.length === 0 ? null : (
        <Cluster as="ul" gap={2}>
          {capabilities.map((capability) => (
            <Tag as="li" key={capability.key} data-entry-key={capability.key}>
              {capability.label}
            </Tag>
          ))}
        </Cluster>
      )}
      <SectionActions section={section} />
    </Stack>
  )

  if (banded) {
    return (
      <SectionShell section={section} spacing="lg" container="prose">
        {copy}
      </SectionShell>
    )
  }

  return (
    <SectionShell section={section} spacing="lg">
      <div className="grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
        {copy}
        <ResponsiveMedia
          desktop={media.desktop}
          mobile={media.mobile}
          desktopRatio="3:2"
          mobileRatio="4:5"
          preset="grid"
          sizes="(min-width: 768px) 50vw, 100vw"
          altOverride={section.media_alt_override}
          strings={strings}
          cloudName={cloudName}
        />
      </div>
    </SectionShell>
  )
}
