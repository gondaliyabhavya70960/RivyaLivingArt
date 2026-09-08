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
 * /studio/media/models — FEAT §13's 3D Models section.
 *
 * A GLB has no thumbnail Cloudinary can derive, so rows fall back to the frame's label rather than
 * showing a broken image. `model_thumbnail_id` and `model_poster_id` (0030) are how an editor
 * attaches one; the viewer that would generate it is Phase 21's.
 */
export const metadata = studioMetadata('/studio/media/models')

const PATH = '/studio/media/models'

// Reserved by 0030's folder registry for Phase 21's viewer.
const MODEL_FOLDERS = ['rivya/models'] as const

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
    kind: 'MODEL_3D',
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
        <MediaUploader
          kind="MODEL_3D"
          folders={MODEL_FOLDERS}
          saveAction={saveUploadedAssetAction}
        />
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
