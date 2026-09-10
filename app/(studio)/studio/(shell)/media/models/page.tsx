import { ModelInspectorDrawer } from '@/components/studio/ModelInspectorDrawer'
import { ModelTable } from '@/components/studio/ModelTable'
import { ModelUploader } from '@/components/studio/ModelUploader'
import { PermissionGate } from '@/components/studio/PermissionGate'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { optionalEnv } from '@/lib/env'
import { mediaRefOf } from '@/lib/media/ref'
import { modelFileUrl } from '@/lib/media/model'
import { resolveSpec } from '@/lib/media/transform'
import { imageUrl } from '@/lib/media/url'
import { NotFoundError } from '@/lib/supabase/errors'
import {
  listMaterialsForStudio,
  listProductsForStudio,
} from '@/lib/supabase/repositories/catalog-admin'
import { getMediaAssetById, listMediaAssets } from '@/lib/supabase/repositories/media'
import { listVariantLabels } from '@/lib/supabase/repositories/models'
import { listProjectsForStudio } from '@/lib/supabase/repositories/portfolio'
import { createClient } from '@/lib/supabase/server'

import {
  associateModelAction,
  reinspectModelAction,
  saveModelAction,
  saveModelStillsAction,
  saveVariantLabelsAction,
  saveViewerSettingsAction,
} from './actions'

/**
 * /studio/media/models — FEAT §13's 3D Models section, filled by Phase 21.
 *
 * UPLOAD WITH THE INSPECTOR IN FRONT OF IT (`ModelUploader`), a list of what the inspector read
 * (`ModelTable`), and — when `?asset=` names a model — the drawer: metadata, poster, viewer
 * settings with a live preview, finish labels and association. The drawer's data is loaded here,
 * on the server, in the same render as the list; nothing on this page fetches from the browser.
 *
 * ZERO MODELS TODAY. The list is empty on both databases, and the empty state says why: the
 * manifest holds none and none will be generated. The upload path is the first way a model can
 * arrive, and it arrives inspected.
 */
export const metadata = studioMetadata('/studio/media/models')

const PATH = '/studio/media/models'

// Reserved by 0030's folder registry for the viewer.
const MODEL_FOLDERS = ['rivya/models'] as const

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('media.read')

  const params = await searchParams
  const q = params.q
  const search = typeof q === 'string' ? q : ''
  const assetParam = typeof params.asset === 'string' ? params.asset : null

  const client = await createClient()
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') ?? ''
  const assets = await listMediaAssets(client, { kind: 'MODEL_3D', search })

  const selected =
    assetParam === null
      ? null
      : await getMediaAssetById(client, assetParam).catch((error: unknown) => {
          if (error instanceof NotFoundError) return null
          throw error
        })

  const drawer =
    selected === null || selected.kind !== 'MODEL_3D'
      ? null
      : await (async () => {
          const [labels, images, products, projects, materials] = await Promise.all([
            listVariantLabels(client, selected.id),
            listMediaAssets(client, { kind: 'IMAGE', limit: 200 }),
            listProductsForStudio(client),
            listProjectsForStudio(client),
            listMaterialsForStudio(client),
          ])
          return {
            labels,
            images: images.map((image) => ({
              id: image.id,
              label: image.title ?? image.filename ?? image.public_id,
              altText: image.alt_text,
              thumbnailUrl:
                cloudName === ''
                  ? null
                  : imageUrl(cloudName, mediaRefOf(image), resolveSpec('thumb')),
              status: image.status,
              ownerVerification: image.owner_verification,
            })),
            products: products.map((product) => ({
              id: product.id,
              label: product.title ?? product.slug,
            })),
            projects: projects.map((project) => ({ id: project.id, label: project.title })),
            materials: materials.map((material) => ({ id: material.id, label: material.name })),
          }
        })()

  return (
    <StudioPage path={PATH}>
      <PermissionGate role={session.role} permission="media.write">
        <ModelUploader folders={MODEL_FOLDERS} saveAction={saveModelAction} />
      </PermissionGate>

      <ModelTable path={PATH} assets={assets} search={search} />

      {selected === null || drawer === null ? null : (
        <ModelInspectorDrawer
          asset={selected}
          modelUrl={modelFileUrl(cloudName, selected)}
          labels={drawer.labels}
          images={drawer.images}
          products={drawer.products}
          projects={drawer.projects}
          materials={drawer.materials}
          canWrite={roleHasPermission(session.role, 'media.write')}
          canVerify={roleHasPermission(session.role, 'content.verify')}
          canAssociateProduct={roleHasPermission(session.role, 'catalog.write')}
          actions={{
            reinspect: reinspectModelAction,
            stills: saveModelStillsAction,
            settings: saveViewerSettingsAction,
            labels: saveVariantLabelsAction,
            associate: associateModelAction,
          }}
        />
      )}
    </StudioPage>
  )
}
