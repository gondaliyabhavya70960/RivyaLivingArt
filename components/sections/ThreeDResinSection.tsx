import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { LazyModelViewerMount } from '@/components/patterns/ModelViewerMount/lazy'
import { Stack } from '@/components/primitives/Stack'

import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The digital-fabrication band.
 *
 * AS SEEDED IT RENDERS ON NO PUBLIC PAGE, and that is the correct launch state rather than a
 * reason to leave the block unbuilt. SEED §10-08: "do not publish as a current capability until
 * owner confirms actual fabrication capability" — the claim is the whole section, so the flag sits
 * on `page_sections.owner_verification` and the Phase 08 publish trigger refuses the row. The
 * owner confirming it must then be one field in Studio, not a phase of engineering.
 *
 * THE MODEL SLOT IS PHASE 21's, AND IT IS KEPT HERE. When `reference.model` arrives — the flag is
 * on, `payload.model_media_id` names a model, and that model is public with a poster — the band's
 * media column becomes the viewer's mount: the model's poster first, the viewer on intent. When it
 * does not arrive, the band draws its scene imagery exactly as before: no frame, no placeholder, no
 * "3D coming soon". The editor's imagery is the fallback and the default, not a leftover.
 */
export function ThreeDResinSection({
  section,
  media,
  strings,
  cloudName,
  livePaths,
  reference,
}: SectionRenderProps): React.ReactElement | null {
  const fullBleed = (section.layout_variant ?? 'split') === 'full-bleed'
  const model = reference?.model ?? null

  const copy = (
    <Stack gap={6}>
      <SectionCopy section={section} />
      <SectionActions section={section} livePaths={livePaths} />
    </Stack>
  )

  const scene =
    model !== null ? (
      <LazyModelViewerMount
        model={model.model}
        materials={model.materials}
        dimensions={null}
        title={section.heading ?? ''}
        strings={strings}
        cloudName={cloudName}
        enabled
        ratio={fullBleed ? '16:9' : '4:3'}
        sizes={fullBleed ? '100vw' : '(min-width: 768px) 50vw, 100vw'}
      />
    ) : (
      <ResponsiveMedia
        desktop={media.desktop}
        mobile={media.mobile}
        desktopRatio="16:9"
        mobileRatio="4:5"
        preset={fullBleed ? 'hero' : 'grid'}
        sizes={fullBleed ? '100vw' : '(min-width: 768px) 50vw, 100vw'}
        altOverride={section.media_alt_override}
        strings={strings}
        cloudName={cloudName}
      />
    )

  if (fullBleed) {
    return (
      <SectionShell section={section} spacing="lg">
        <Stack gap={10}>
          {scene}
          {copy}
        </Stack>
      </SectionShell>
    )
  }

  return (
    <SectionShell section={section} spacing="lg">
      <div className="grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
        {copy}
        {scene}
      </div>
    </SectionShell>
  )
}
