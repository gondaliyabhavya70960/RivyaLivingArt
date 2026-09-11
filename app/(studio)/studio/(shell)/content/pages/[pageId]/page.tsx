import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { PageEditor } from '@/components/studio/content/PageEditor'
import type { PickerAsset } from '@/components/studio/MediaPicker'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import { ROLE_PERMISSIONS } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { MEDIA_SLOTS } from '@/content/media-slots'
import { resolveStudioPage } from '@/lib/cms/resolve'
import { imageUrl } from '@/lib/media/url'
import { listGlobalContent } from '@/lib/supabase/repositories/cms'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { createClient } from '@/lib/supabase/server'

/**
 * /studio/content/pages/[pageId] — the page editor.
 *
 * `resolveStudioPage` RATHER THAN `resolvePage`. It accepts a uuid or a slug, returns SYSTEM pages
 * (the reserved `slug = 'global'` row is exactly what this surface is for), and never filters by
 * status or window — an editor opening a draft must see the draft, and one opening a scheduled
 * section must see it before its moment arrives.
 *
 * THE MEDIA LIST IS READ HERE, ONCE, AND HANDED DOWN. `MediaPicker` is given its candidates rather
 * than fetching them, so the list is exactly what RLS let this editor see and there is no second
 * endpoint returning media rows for that policy to be got wrong in.
 *
 * THE PERMISSIONS ARE RESOLVED SERVER-SIDE and passed as data. The client uses them only to decide
 * which controls to draw; every action re-checks. Offering a control that always refuses reads as
 * a bug in the product rather than as a boundary, which is the only reason the client needs to
 * know at all.
 */
export const metadata = { title: 'Page — Rivya Studio' }

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''

export default async function Page({ params }: { params: Promise<{ pageId: string }> }) {
  const session = await requirePermission('content.read')
  const { pageId } = await params

  const client = await createClient()
  const resolved = await resolveStudioPage(client, pageId)
  if (resolved === null) notFound()

  const assets = await listMediaAssets(client, { kind: 'IMAGE', limit: 200 })

  /*
   * THE VERIFICATION NOTES ARE READ HERE, NOT IN THE BOARD. `SectionBoard` is a Client Component —
   * it holds the editing state — and a Client Component cannot query. The rows are the
   * specification's own wording for the claims it names, keyed `verification.<section seed key>`
   * under `STUDIO_HELP`; a section with no row gets no note rather than a generic sentence.
   */
  const VERIFICATION_PREFIX = 'verification.'
  const verificationNotes = new Map(
    (await listGlobalContent(client, 'STUDIO_HELP'))
      .filter((row) => row.is_enabled && row.key.startsWith(VERIFICATION_PREFIX))
      // Keyed to match `page_sections.seed_key`, which carries the `section:` prefix the row's own
      // key cannot (a seed key holds exactly one colon).
      .map((row) => [`section:${row.key.slice(VERIFICATION_PREFIX.length)}`, row.value] as const),
  )

  const pickerAssets: readonly PickerAsset[] = assets.map((asset) => ({
    id: asset.id,
    label: asset.rivya_asset_id ?? asset.filename ?? asset.public_id,
    altText: asset.alt_text,
    // A thumbnail URL is built here rather than in the picker: the cloud name is server
    // configuration, and the picker is a Client Component that should not read the environment.
    thumbnailUrl:
      CLOUD_NAME === ''
        ? null
        : imageUrl(
            CLOUD_NAME,
            { publicId: asset.public_id, resourceType: asset.resource_type },
            {
              width: 160,
              crop: 'fill',
              format: 'auto',
              quality: 'auto:eco',
            },
          ),
    status: asset.status,
    ownerVerification: asset.owner_verification,
  }))

  return (
    <Stack gap={6}>
      {/*
       * PHASE 41: SKIP TO SECTIONS (WCAG 2.2 §2.4.1).
       *
       * The longest repeated block in the product sits above this: the Studio shell's sidebar, the
       * page header, the back link and the editor's own toolbar. A member of staff editing twenty
       * pages in an afternoon tabs past all of it twenty times. The Studio shell already has a "skip
       * to content" link, and this one goes further — past the editor chrome to the list of sections
       * they actually came to change.
       */}
      <a
        href="#page-sections"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-sm focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-ink"
      >
        {t('studio.shell.skipToSections')}
      </a>

      <PageHeader
        level={1}
        title={resolved.page.title}
        description={resolved.page.path ?? t('studio.content.pages.systemPath')}
        actions={<StatusPill status={resolved.page.status} />}
      />

      <Cluster gap={3}>
        <Link href={'/studio/content/pages' as Route} className="underline underline-offset-4">
          <Text size="sm" as="span">
            {t('studio.content.page.backLabel')}
          </Text>
        </Link>
      </Cluster>

      {/* `tabIndex={-1}` so the jump moves focus, not only the viewport. */}
      <div id="page-sections" tabIndex={-1}>
        <PageEditor
          pageId={resolved.page.id}
          pagePath={resolved.page.path}
          sections={resolved.sections}
          assets={pickerAssets}
          slotKeys={MEDIA_SLOTS.map((slot) => slot.key)}
          permissions={ROLE_PERMISSIONS[session.role]}
          verificationNotes={verificationNotes}
        />
      </div>
    </Stack>
  )
}
