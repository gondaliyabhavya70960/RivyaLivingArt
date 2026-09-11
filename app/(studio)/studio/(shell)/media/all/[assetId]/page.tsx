import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MediaImage } from '@/components/patterns/MediaImage'
import { Heading } from '@/components/primitives/Heading'
import { MediaFrame } from '@/components/primitives/MediaFrame'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { AccessibilityPanel } from '@/components/studio/media/AccessibilityPanel'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { requiredEnv } from '@/lib/env'
import { NotFoundError } from '@/lib/supabase/errors'
import { getMediaAssetById } from '@/lib/supabase/repositories/media'
import { createClient } from '@/lib/supabase/server'

import { saveAccessibilityAction } from '../../actions'

/**
 * /studio/media/all/[assetId] — one asset, and the accessibility decision attached to it.
 *
 * UNDER `/all/` RATHER THAN A DIRECTORY OF ITS OWN, because the Studio navigation manifest requires
 * a detail route's parent to be a navigable leaf — the same rule that puts
 * `/studio/inquiries/all/[inquiryId]` where it is. `/studio/media/asset/[assetId]` would have needed
 * a nav entry for `/studio/media/asset`, which is not a place anybody goes.
 *
 * THE PHASE DOCUMENT ASKS FOR A DRAWER AND THIS IS A PAGE, deliberately. The Media Manager's six
 * sections are one shared table with no per-asset surface at all, so a drawer would have meant
 * making the table a Client Component to own an open/closed state — turning six Server-rendered
 * routes into client ones to host a form that is itself a client island. A route has an address
 * instead: the alt-text queue in Phase 43 can link straight at one asset, and somebody can send a
 * colleague the thing that needs rewriting.
 *
 * THE PANEL IS THE POINT; the rest of the page is the context needed to judge the sentence. The
 * picture is shown large, because a text alternative written without looking at the image is how
 * 124 truncated prompt fragments came to be in the database in the first place.
 *
 * READ WITHOUT WRITE IS A REAL STATE HERE. `media.read` reaches this page and `media.write` is what
 * `saveAccessibilityAction` demands; a role holding only the first sees the asset and a sentence
 * saying who can change it, rather than a form that fails on submit.
 */

export const metadata = { title: 'Asset — Rivya Studio' }

const RENDERABLE = new Set(['IMAGE', 'BRAND'])

export default async function Page({ params }: { params: Promise<{ assetId: string }> }) {
  const session = await requirePermission('media.read')
  const { assetId } = await params

  const client = await createClient()
  const asset = await getMediaAssetById(client, assetId).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (asset === null) notFound()

  const canWrite = roleHasPermission(session.role, 'media.write')

  return (
    <Stack gap={6}>
      <PageHeader
        level={1}
        title={asset.title ?? asset.filename ?? asset.public_id}
        description={asset.public_id}
        actions={<StatusPill status={asset.status} />}
      />
      <Link href={'/studio/media/all' as Route} className="underline underline-offset-4">
        <Text size="sm" as="span">
          {t('studio.media.asset.back')}
        </Text>
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <Stack gap={3}>
          <MediaFrame ratio="4:5" fallbackLabel={asset.kind}>
            {RENDERABLE.has(asset.kind) ? (
              <MediaImage
                cloudName={requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')}
                media={{ publicId: asset.public_id, resourceType: 'image' }}
                preset="card"
                sizes="(min-width: 768px) 40vw, 100vw"
                /*
                 * The asset's own sentence, not a label. This page exists to judge whether that
                 * sentence is any good, and substituting a tidy one here would hide the thing
                 * being judged from exactly the reader who depends on it.
                 */
                alt={asset.alt_text}
              />
            ) : null}
          </MediaFrame>
          {RENDERABLE.has(asset.kind) ? null : (
            <Text size="sm" tone="secondary">
              {t('studio.media.asset.noPreview')}
            </Text>
          )}
        </Stack>

        <Stack gap={6}>
          {canWrite ? (
            <AccessibilityPanel
              assetId={asset.id}
              altText={asset.alt_text}
              isDecorative={asset.is_decorative}
              onSave={saveAccessibilityAction}
            />
          ) : (
            <Stack gap={2}>
              <Heading level={2} size="display-xs">
                {t('studio.media.a11y.heading')}
              </Heading>
              <Text>{asset.alt_text}</Text>
              <Text size="sm" tone="secondary">
                {t('studio.media.asset.readOnly')}
              </Text>
            </Stack>
          )}

          <Stack gap={2}>
            <Heading level={2} size="display-xs">
              {t('studio.media.asset.detailsHeading')}
            </Heading>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-ink-secondary">{t('studio.media.colFolder')}</dt>
              <dd>{asset.folder}</dd>
              <dt className="text-ink-secondary">{t('studio.media.colSource')}</dt>
              <dd>{asset.source}</dd>
            </dl>
          </Stack>
        </Stack>
      </div>
    </Stack>
  )
}
