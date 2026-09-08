import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { MediaUploader } from '@/components/studio/MediaUploader'
import { PermissionGate } from '@/components/studio/PermissionGate'
import { MediaLibrary } from '@/components/studio/MediaLibrary'
import { requirePermission } from '@/lib/auth/require'
import { requiredEnv } from '@/lib/env'
import { MANIFEST_FOLDERS } from '@/lib/media/folders'

import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { createClient } from '@/lib/supabase/server'

import { saveUploadedAssetAction } from '../actions'

/**
 * /studio/media/videos — FEAT §13's Videos section.
 *
 * Rows show a poster frame, never a mounted `<video>`: twenty autoplaying clips in a table is a
 * browser tab that heats a laptop. See `MediaLibrary`.
 */
export const metadata = studioMetadata('/studio/media/videos')

const PATH = '/studio/media/videos'

// Same tree as images: a process clip lives beside the process stills.
const VIDEO_FOLDERS = MANIFEST_FOLDERS

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
    kind: 'VIDEO',
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
        <MediaUploader kind="VIDEO" folders={VIDEO_FOLDERS} saveAction={saveUploadedAssetAction} />
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
