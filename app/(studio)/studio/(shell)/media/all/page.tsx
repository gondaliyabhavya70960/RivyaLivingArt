import { Stack } from '@/components/primitives/Stack'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { MediaLibrary } from '@/components/studio/MediaLibrary'
import { AltTextQueue } from '@/components/studio/media/AltTextQueue'
import { requirePermission } from '@/lib/auth/require'
import { requiredEnv } from '@/lib/env'
import { listMediaAssets, listSlotBindings } from '@/lib/supabase/repositories/media'
import { altTextWarnings } from '@/lib/media/alt-text-quality'
import { createClient } from '@/lib/supabase/server'

/**
 * /studio/media/all — every asset, unfiltered by kind.
 *
 * The only section whose query passes no `kind`, which is what makes it the place to answer "where
 * did this asset go" when somebody uploaded a PDF into an image section by mistake.
 */
export const metadata = studioMetadata('/studio/media/all')

const PATH = '/studio/media/all'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // First line of the body, before anything renders. `proxy.ts` redirects an unauthenticated
  // request and decides nothing else, and this page is reachable by a role that holds
  // `studio.access` without holding `media.read`.
  await requirePermission('media.read')

  const params = await searchParams
  const q = params.q
  const search = typeof q === 'string' ? q : ''

  const client = await createClient()
  const [assets, bindings] = await Promise.all([
    listMediaAssets(client, { search }),
    listSlotBindings(client),
  ])

  /*
   * PHASE 43: THE QUEUE SITS UNDER THE LIBRARY, on the one section that filters by nothing. It lists
   * only assets that still need a person — a clean sentence leaves the queue, which is what makes a
   * shrinking list mean something. An asset marked decorative is finished by definition and is not
   * listed as work.
   */
  const boundCounts = new Map<string, number>()
  for (const binding of bindings) {
    boundCounts.set(binding.media_id, (boundCounts.get(binding.media_id) ?? 0) + 1)
  }

  const queue = assets
    .filter((asset) => !asset.is_decorative && altTextWarnings(asset.alt_text).length > 0)
    .map((asset) => ({
      id: asset.id,
      label: asset.title ?? asset.filename ?? asset.public_id,
      rivyaAssetId: asset.rivya_asset_id,
      altText: asset.alt_text,
      isDecorative: asset.is_decorative,
      boundCount: boundCounts.get(asset.id) ?? 0,
    }))

  return (
    <StudioPage path={PATH}>
      <Stack gap={8}>
        <MediaLibrary
          path={PATH}
          assets={assets}
          cloudName={requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')}
          search={search}
        />

        <AltTextQueue rows={queue} />
      </Stack>
    </StudioPage>
  )
}
