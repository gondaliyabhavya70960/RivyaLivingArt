import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { MediaUploader } from '@/components/studio/MediaUploader'
import { PermissionGate } from '@/components/studio/PermissionGate'
import { MediaLibrary } from '@/components/studio/MediaLibrary'
import { requirePermission } from '@/lib/auth/require'
import { requiredEnv } from '@/lib/env'

import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { createClient } from '@/lib/supabase/server'

import { saveUploadedAssetAction } from '../actions'

/**
 * /studio/media/brand — FEAT §13's Brand Assets section.
 *
 * The accepted formats are narrower here than anywhere else and are stated BEFORE the owner
 * chooses a file rather than after a validator rejects one (SECURITY.md §7.2): PNG, JPEG and ICO,
 * with a 5 MB ceiling. SVG is refused on every path including this one — an SVG is XML the browser
 * executes in the same origin, and no sanitiser is right forever. If a mark exists only as SVG the
 * answer is a PNG export at 2x from whoever supplies it.
 */
export const metadata = studioMetadata('/studio/media/brand')

const PATH = '/studio/media/brand'

// Narrowed to one. A logo in `rivya/process/pour` is not a mistake worth allowing a
// dropdown to make, and the sign endpoint would happily sign it — the allowlist is about which
// folders EXIST, not which are sensible for this kind.
const BRAND_FOLDERS = ['rivya/brand'] as const

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // First line of the body, before anything renders. `proxy.ts` redirects an unauthenticated
  // request and decides nothing else, and this page is reachable by a role that holds
  // `studio.access` without holding `media.read`.
  const session = await requirePermission('media.read')

  const params = await searchParams
  const q = params.q
  const search = typeof q === 'string' ? q : ''

  const client = await createClient()
  const assets = await listMediaAssets(client, {
    kind: 'BRAND',
    search,
  })

  return (
    <StudioPage path={PATH}>
      {/* The uploader sits above the table rather than behind a button. Uploading is what this
          surface is FOR, and a section whose primary action is one click away reads as a list
          somebody else fills.

          Gated on `media.write` because `media.read` is held by researcher and viewer too, and a
          form that always fails is worse than no form. The gate protects nothing — the action
          re-checks, and RLS refuses underneath it; this is so the interface does not offer
          something that will be refused. */}
      <PermissionGate role={session.role} permission="media.write">
        <MediaUploader kind="BRAND" folders={BRAND_FOLDERS} saveAction={saveUploadedAssetAction} />
      </PermissionGate>
      <MediaLibrary
        path={PATH}
        assets={assets}
        cloudName={requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')}
        search={search}
      />
    </StudioPage>
  )
}
