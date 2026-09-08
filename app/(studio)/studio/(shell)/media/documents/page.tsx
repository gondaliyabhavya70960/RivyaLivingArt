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
 * /studio/media/documents — FEAT §13's Documents section.
 *
 * Care guides and spec sheets. `resource_type` is `raw`, not `image`: a PDF uploaded into the
 * image namespace succeeds and is then unreachable, because Cloudinary's resource types are
 * separate namespaces rather than a hint.
 */
export const metadata = studioMetadata('/studio/media/documents')

const PATH = '/studio/media/documents'

// Care guides and spec sheets have one home.
const DOCUMENT_FOLDERS = ['rivya/documents'] as const

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
    kind: 'DOCUMENT',
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
          kind="DOCUMENT"
          folders={DOCUMENT_FOLDERS}
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
