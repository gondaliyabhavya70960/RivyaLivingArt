'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { rejectionMessage, warningMessage } from '@/components/studio/model-findings'
import { t } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { roleHasPermission } from '@/lib/auth/permissions'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { requiredEnv } from '@/lib/env'
import { getMediaProvider } from '@/lib/media'
import { isAllowedFolder } from '@/lib/media/folders'
import { fetchModelBytes, inspectModel } from '@/lib/media/inspect-server'
import { detectModelFormat, modelFileUrl, viewerSettingsSchema } from '@/lib/media/model'
import { rawUrl } from '@/lib/media/url'
import { getProductById } from '@/lib/supabase/repositories/catalog-admin'
import { getMediaAssetById, insertMediaAsset } from '@/lib/supabase/repositories/media'
import {
  listVariantLabels,
  replaceVariantLabels,
  setModelAssociation,
  syncVariantKeys,
  updateModelMetadata,
} from '@/lib/supabase/repositories/models'
import { createClient } from '@/lib/supabase/server'

/**
 * The 3D model surface's Server Actions.
 *
 * METADATA IS PARSED, NEVER TYPED. `saveModelAction` runs after Cloudinary has the bytes: it
 * fetches the file back from the delivery origin, inspects it with the same decoders the viewer
 * uses, and writes `model_format`, `file_size_bytes`, `poly_count` and `texture_count` from what
 * it read. Nothing in the request can set those columns. A file the inspector refuses is
 * DESTROYED at the provider and gets no row; the reasons come back in words.
 *
 * TWO PERMISSIONS ARE NOT ONE. Every action here needs `media.write`. Marking a finish label
 * VERIFIED additionally needs `content.verify` (owner, admin) because a material name is a product
 * fact (D10) — the 0194 trigger refuses it anyway, and the check here turns that refusal into a
 * sentence and a DENIED audit row. Attaching a model to a product additionally needs
 * `catalog.write`, because `products.model_media_id` is a catalogue column and RLS inside
 * `set_model_association()` would refuse the second write without it.
 */

export type ModelActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved'; readonly message: string }
  | {
      readonly status: 'error'
      readonly issues: readonly { readonly field: string; readonly message: string }[]
    }

const STUDIO_PATH = '/studio/media/models'

function formError(message: string, field = '_form'): ModelActionState {
  return { status: 'error', issues: [{ field, message }] }
}

function refusal(error: unknown): ModelActionState {
  if (error instanceof AuthenticationError) return formError(t('studio.models.expired'))
  if (error instanceof AuthorizationError) return formError(t('studio.models.forbidden'))
  return formError(t('studio.models.failed'))
}

function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

async function denied(
  session: Awaited<ReturnType<typeof requirePermission>>,
  action: string,
  entityId: string | undefined,
  summary: string,
): Promise<void> {
  await writeAudit({
    action,
    result: 'DENIED',
    actorUserId: session.userId,
    actorRole: session.role,
    entityType: 'media_assets',
    entityId,
    summary,
  })
}

// --- Upload -------------------------------------------------------------------------------------

const saveSchema = z.object({
  publicId: z.string().min(1).max(400),
  folder: z.string().min(1).max(200),
  kind: z.literal('MODEL_3D'),
  source: z.enum(['REAL', 'USER_UPLOAD', 'RENDER', 'FALLBACK']),
  altText: z.string().min(1).max(1000),
  filename: z.string().min(1).max(400),
  mimeType: z.string().min(1).max(120),
})

export type SaveModelResult =
  { ok: true; id: string; notes: readonly string[] } | { ok: false; error: string }

/** Best effort: a refused or unreadable upload should not linger in the library's folder. */
async function discard(publicId: string): Promise<void> {
  try {
    await getMediaProvider().destroy({ publicId, resourceType: 'raw' })
  } catch {
    // The row was never written; an orphaned file is a cost, not a correctness problem.
  }
}

export async function saveModelAction(input: unknown): Promise<SaveModelResult> {
  let session
  try {
    session = await requirePermission('media.write')
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { ok: false, error: t('studio.media.upload.refused') }
    }
    throw error
  }

  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('studio.media.upload.refused') }
  const { publicId, folder, altText, filename, mimeType, source } = parsed.data

  if (!isAllowedFolder(folder)) {
    await denied(session, 'media.save', undefined, `Refused to record a model in "${folder}".`)
    return { ok: false, error: t('studio.media.upload.refused') }
  }

  const format = detectModelFormat({ mimeType, filename, publicId })
  if (format === null) {
    await discard(publicId)
    await denied(session, 'models.save', undefined, `Refused ${publicId}: not GLB or GLTF.`)
    return { ok: false, error: t('studio.models.reject.wrongFormat') }
  }

  const cloudName = requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
  let bytes: Uint8Array
  try {
    bytes = await fetchModelBytes(rawUrl(cloudName, { publicId, resourceType: 'raw' }))
  } catch {
    await discard(publicId)
    return { ok: false, error: t('studio.models.fetchFailed') }
  }

  const report = await inspectModel(bytes, format)
  if (!report.ok) {
    const reasons = report.rejections.map(rejectionMessage)
    await discard(publicId)
    await denied(session, 'models.save', undefined, `Refused ${publicId}: ${reasons.join(' ')}`)
    return { ok: false, error: `${t('studio.models.rejected')}: ${reasons.join(' ')}` }
  }

  try {
    const client = await createClient()
    const asset = await insertMediaAsset(client, {
      public_id: publicId,
      folder,
      resource_type: 'raw',
      kind: 'MODEL_3D',
      source,
      alt_text: altText,
      is_ai_generated: false,
      is_concept: false,
      filename,
      mime_type: mimeType,
      bytes: report.bytes,
      uploaded_by: session.userId,
      model_format: report.format,
      file_size_bytes: report.bytes,
      poly_count: report.triangles,
      texture_count: report.textureCount,
    })
    // One placeholder label per finish the file declares, so the drawer has rows to edit.
    await syncVariantKeys(client, asset.id, report.variants, session.userId)

    await writeAudit({
      action: 'models.save',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'media_assets',
      entityId: asset.id,
      summary: `Recorded model ${publicId}: ${report.triangles ?? '?'} triangles, ${report.textureCount ?? '?'} textures, ${report.bytes} bytes.`,
    })
    revalidatePath('/studio/media', 'layout')
    return { ok: true, id: asset.id, notes: report.warnings.map(warningMessage) }
  } catch {
    return { ok: false, error: t('studio.media.upload.failed') }
  }
}

// --- Re-inspect ----------------------------------------------------------------------------------

export async function reinspectModelAction(
  _state: ModelActionState,
  form: FormData,
): Promise<ModelActionState> {
  try {
    const session = await requirePermission('media.write')
    const assetId = text(form, 'asset_id')
    if (assetId === null) return formError(t('studio.models.failed'))

    const client = await createClient()
    const asset = await getMediaAssetById(client, assetId)
    const cloudName = requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
    const url = modelFileUrl(cloudName, asset)
    const format =
      asset.model_format ??
      detectModelFormat({
        mimeType: asset.mime_type,
        filename: asset.filename,
        publicId: asset.public_id,
      })
    if (url === null || format === null) return formError(t('studio.models.failed'))

    const report = await inspectModel(await fetchModelBytes(url), format)
    if (!report.ok) {
      const reasons = report.rejections.map(rejectionMessage)
      await denied(
        session,
        'models.reinspect',
        asset.id,
        `Model ${asset.public_id} now fails: ${reasons.join(' ')}`,
      )
      return formError(`${t('studio.models.rejected')}: ${reasons.join(' ')}`)
    }

    await updateModelMetadata(
      client,
      asset.id,
      {
        model_format: report.format,
        file_size_bytes: report.bytes,
        bytes: report.bytes,
        poly_count: report.triangles,
        texture_count: report.textureCount,
      },
      session.userId,
    )
    await syncVariantKeys(client, asset.id, report.variants, session.userId)
    await writeAudit({
      action: 'models.reinspect',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'media_assets',
      entityId: asset.id,
      summary: `Re-inspected ${asset.public_id}: ${report.triangles ?? '?'} triangles, ${report.textureCount ?? '?'} textures.`,
    })
    revalidatePath(STUDIO_PATH)
    return { status: 'saved', message: t('studio.models.meta.reinspected') }
  } catch (error) {
    return refusal(error)
  }
}

// --- Poster and thumbnail --------------------------------------------------------------------------

export async function saveModelStillsAction(
  _state: ModelActionState,
  form: FormData,
): Promise<ModelActionState> {
  try {
    const session = await requirePermission('media.write')
    const assetId = text(form, 'asset_id')
    if (assetId === null) return formError(t('studio.models.failed'))
    const posterId = text(form, 'poster_id')
    const thumbnailId = text(form, 'thumbnail_id')
    if (
      (posterId !== null && !z.uuid().safeParse(posterId).success) ||
      (thumbnailId !== null && !z.uuid().safeParse(thumbnailId).success)
    ) {
      return formError(t('studio.models.failed'))
    }

    const client = await createClient()
    await updateModelMetadata(
      client,
      assetId,
      { model_poster_id: posterId, model_thumbnail_id: thumbnailId },
      session.userId,
    )
    await writeAudit({
      action: 'models.stills',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'media_assets',
      entityId: assetId,
      summary: `Set poster ${posterId ?? 'none'} and thumbnail ${thumbnailId ?? 'none'}.`,
    })
    revalidatePath(STUDIO_PATH)
    return { status: 'saved', message: t('studio.models.saved') }
  } catch (error) {
    return refusal(error)
  }
}

// --- Viewer settings --------------------------------------------------------------------------------

export async function saveViewerSettingsAction(
  _state: ModelActionState,
  form: FormData,
): Promise<ModelActionState> {
  try {
    const session = await requirePermission('media.write')
    const assetId = text(form, 'asset_id')
    const raw = text(form, 'settings')
    if (assetId === null || raw === null) return formError(t('studio.models.failed'))

    let candidate: unknown
    try {
      candidate = JSON.parse(raw)
    } catch {
      return formError(t('studio.models.settings.invalid'))
    }
    const parsed = viewerSettingsSchema.safeParse(candidate)
    if (!parsed.success) return formError(t('studio.models.settings.invalid'))

    const client = await createClient()
    await updateModelMetadata(client, assetId, { viewer_settings: parsed.data }, session.userId)
    await writeAudit({
      action: 'models.settings',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'media_assets',
      entityId: assetId,
      summary: `Viewer settings updated: ${Object.keys(parsed.data).join(', ') || 'defaults'}.`,
    })
    revalidatePath(STUDIO_PATH)
    return { status: 'saved', message: t('studio.models.saved') }
  } catch (error) {
    return refusal(error)
  }
}

// --- Variant labels ---------------------------------------------------------------------------------

const labelsSchema = z.array(
  z.object({
    variant_key: z.string().min(1).max(120),
    label: z.string().min(1).max(120),
    material_id: z.uuid().nullable(),
    position: z.number().int().nonnegative(),
    owner_verification: z.enum(['NOT_REQUIRED', 'OWNER_VERIFICATION_REQUIRED', 'VERIFIED']),
  }),
)

export async function saveVariantLabelsAction(
  _state: ModelActionState,
  form: FormData,
): Promise<ModelActionState> {
  try {
    const session = await requirePermission('media.write')
    const assetId = text(form, 'asset_id')
    const raw = text(form, 'labels')
    if (assetId === null || raw === null) return formError(t('studio.models.failed'))

    let candidate: unknown
    try {
      candidate = JSON.parse(raw)
    } catch {
      return formError(t('studio.models.failed'))
    }
    const parsed = labelsSchema.safeParse(candidate)
    if (!parsed.success) return formError(t('studio.models.failed'))

    // The CHECK in words, before the round trip: a material lifts the row out of NOT_REQUIRED.
    const unverifiedMaterial = parsed.data.find(
      (label) => label.material_id !== null && label.owner_verification === 'NOT_REQUIRED',
    )
    if (unverifiedMaterial !== undefined) {
      return formError(
        t('studio.models.labels.materialNeedsVerification'),
        unverifiedMaterial.variant_key,
      )
    }

    const client = await createClient()
    const before = await listVariantLabels(client, assetId)
    const verifiedBefore = new Set(
      before.filter((row) => row.owner_verification === 'VERIFIED').map((row) => row.variant_key),
    )
    const newlyVerified = parsed.data.filter(
      (label) => label.owner_verification === 'VERIFIED' && !verifiedBefore.has(label.variant_key),
    )
    if (newlyVerified.length > 0 && !roleHasPermission(session.role, 'content.verify')) {
      await denied(
        session,
        'models.labels',
        assetId,
        `Refused to mark ${newlyVerified.map((l) => l.variant_key).join(', ')} VERIFIED: role ${session.role} lacks content.verify.`,
      )
      return formError(t('studio.models.labels.verifyRefused'))
    }

    await replaceVariantLabels(client, assetId, parsed.data, session.userId)
    await writeAudit({
      action: 'models.labels',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'model_variant_labels',
      entityId: assetId,
      summary: `Saved ${parsed.data.length} finish label(s)${newlyVerified.length > 0 ? `, ${newlyVerified.length} newly verified` : ''}.`,
    })
    revalidatePath(STUDIO_PATH)
    return { status: 'saved', message: t('studio.models.saved') }
  } catch (error) {
    return refusal(error)
  }
}

// --- Association -----------------------------------------------------------------------------------

export async function associateModelAction(
  _state: ModelActionState,
  form: FormData,
): Promise<ModelActionState> {
  try {
    const session = await requirePermission('media.write')
    const assetId = text(form, 'asset_id')
    const target = text(form, 'target') ?? 'none'
    const productId = target === 'product' ? text(form, 'product_id') : null
    const projectId = target === 'project' ? text(form, 'project_id') : null
    if (assetId === null) return formError(t('studio.models.failed'))
    if (
      (target === 'product' && productId === null) ||
      (target === 'project' && projectId === null)
    ) {
      return formError(
        t('studio.models.association.pick'),
        target === 'product' ? 'product_id' : 'project_id',
      )
    }

    const client = await createClient()
    const asset = await getMediaAssetById(client, assetId)
    if (target !== 'none' && asset.model_poster_id === null) {
      return formError(t('studio.models.association.needsPoster'))
    }

    if (productId !== null && !roleHasPermission(session.role, 'catalog.write')) {
      await denied(
        session,
        'models.associate',
        assetId,
        `Role ${session.role} lacks catalog.write.`,
      )
      return formError(t('studio.models.association.productRefused'))
    }

    await setModelAssociation(client, assetId, productId, projectId)
    await writeAudit({
      action: 'models.associate',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'media_assets',
      entityId: assetId,
      summary:
        target === 'none'
          ? 'Model detached from every page.'
          : `Model shown on ${target} ${productId ?? projectId}.`,
    })

    revalidatePath(STUDIO_PATH)
    revalidatePath('/studio/catalog', 'layout')
    if (productId !== null) {
      const product = await getProductById(client, productId)
      revalidatePath(`/product/${product.slug}`)
    }
    return { status: 'saved', message: t('studio.models.saved') }
  } catch (error) {
    return refusal(error)
  }
}
