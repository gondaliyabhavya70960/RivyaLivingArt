import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { MediaLibrary } from '@/components/studio/MediaLibrary'
import { requirePermission } from '@/lib/auth/require'
import { requiredEnv } from '@/lib/env'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
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
  const assets = await listMediaAssets(client, {
    search,
  })

  return (
    <StudioPage path={PATH}>
      <MediaLibrary
        path={PATH}
        assets={assets}
        cloudName={requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')}
        search={search}
      />
    </StudioPage>
  )
}
