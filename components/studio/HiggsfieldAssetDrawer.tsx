'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'

import { Drawer } from '@/components/patterns/Drawer'
import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

/**
 * One Higgsfield asset, opened from the tracker.
 *
 * THERE IS NO REGENERATE CONTROL, AND ITS ABSENCE IS THE FEATURE. Every asset reachable from here
 * is already in the manifest, which under the media rule makes it the thing to USE — regenerating
 * it would spend credits to replace a known picture with a different one, orphan the ledger entry
 * keyed on its `higgsfield_generation_id`, and break any `media_usages` row bound to it. The
 * temptation is real enough that `scripts/media/assert-no-regeneration.ts` fails the build if a
 * generation call ever appears in this directory; a comment alone would not have held.
 *
 * IT IS READ-ONLY, so it composes `patterns/Drawer` rather than `DrawerForm`. A form with a submit
 * button would invite exactly the edit this surface must not offer, and alt-text editing belongs
 * to the media library where the asset has a `media_assets` row to write to.
 *
 * URL-DRIVEN. `?asset=<rivya_asset_id>` opens it, so the state survives a reload, is linkable into
 * a message, and is what the e2e test navigates to. This component is a Client Component only
 * because closing means a `router.push`; everything it renders is plain markup.
 */

export type DrawerAsset = {
  readonly rivyaAssetId: string
  readonly family: string
  readonly page: string
  readonly aspectRatio: string
  readonly model: string
  readonly generationId: string
  readonly publicId: string
  readonly width: number
  readonly height: number
  readonly prompt: string
  readonly altTextDraft: string
  readonly migrated: boolean
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack gap={1}>
      <Text size="2xs" uppercase tone="tertiary">
        {label}
      </Text>
      {/* `break-words` because a Cloudinary public id and a 900-character prompt both overflow a
          420px drawer, and a horizontal scrollbar inside a dialog is a trap for a touch reader. */}
      <Text size="sm" className={mono ? 'font-mono break-words' : 'break-words'}>
        {value}
      </Text>
    </Stack>
  )
}

export function HiggsfieldAssetDrawer({
  asset,
  returnTo,
}: {
  /** `null` closes the drawer — the page passes null when `?asset=` names nothing real. */
  asset: DrawerAsset | null
  /** Where closing navigates, carrying the current tab so the reader lands where they left. */
  returnTo: string
}) {
  const router = useRouter()

  return (
    <Drawer
      open={asset !== null}
      onClose={() => {
        // `typedRoutes` cannot type a string assembled at runtime. The cast is confined to this
        // one line and the value is built by the page from a literal path plus its own tab.
        router.push(returnTo as Route, { scroll: false })
      }}
      // The asset id names the drawer. It is an identifier rather than copy, so it is not routed
      // through `t()` — the same reasoning as StatusPill's enum labels.
      title={asset?.rivyaAssetId ?? ''}
      closeLabel={t('studio.higgsfield.drawerClose')}
      side="right"
    >
      {asset === null ? null : (
        <Stack gap={5}>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{asset.family}</Badge>
            <Badge tone="neutral">{asset.aspectRatio}</Badge>
            <Badge tone={asset.migrated ? 'success' : 'warning'}>
              {asset.migrated
                ? t('studio.higgsfield.stateMigrated')
                : t('studio.higgsfield.stateUnmigrated')}
            </Badge>
          </div>

          <Row label={t('studio.higgsfield.colPage')} value={asset.page} />
          <Row label={t('studio.higgsfield.drawerModel')} value={asset.model} />
          <Row label={t('studio.higgsfield.drawerGenerationId')} value={asset.generationId} mono />
          <Row label={t('studio.higgsfield.drawerPublicId')} value={asset.publicId} mono />

          <Stack gap={1}>
            <Text size="2xs" uppercase tone="tertiary">
              {t('studio.higgsfield.drawerDimensions')}
            </Text>
            <Text size="sm">{`${String(asset.width)} × ${String(asset.height)}`}</Text>
            <Text size="xs" tone="tertiary">
              {t('studio.higgsfield.drawerDimensionsHelp')}
            </Text>
          </Stack>

          <Row label={t('studio.higgsfield.drawerAlt')} value={asset.altTextDraft} />
          <Row label={t('studio.higgsfield.drawerPrompt')} value={asset.prompt} />
        </Stack>
      )}
    </Drawer>
  )
}
