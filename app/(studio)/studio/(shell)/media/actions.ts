'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { t } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { requiredEnv } from '@/lib/env'
import { getMediaProvider } from '@/lib/media'
import { checkMediaAgainstResearch, type GuardVerdict } from '@/lib/media/duplicate-guard'
import { isAllowedFolder } from '@/lib/media/folders'
import { hashImageBytes, sha256OfStream, type MediaHashes } from '@/lib/media/hashes'
import { UPLOAD_KINDS, UPLOAD_LIMITS } from '@/lib/media/upload-limits'
import { originalUrl } from '@/lib/media/url'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertMediaAsset } from '@/lib/supabase/repositories/media'
import {
  listMediaAssetHashes,
  upsertMediaAssetHash,
} from '@/lib/supabase/repositories/media-hashes'
import {
  listResearchImageHashes,
  sourceSlugsById,
} from '@/lib/supabase/repositories/research/similarity'
import { createClient } from '@/lib/supabase/server'

/**
 * The Media Manager's Server Actions.
 *
 * A SEPARATE FILE FROM THE REPOSITORY. `'use server'` publishes every export in a module as a
 * callable HTTP endpoint, so the directive may never sit on `lib/supabase/repositories/media.ts` —
 * that would turn `insertMediaAsset` into an endpoint taking a raw row, which is every column
 * including `status` and `is_concept`.
 *
 * IT RE-CHECKS THE PERMISSION, and that is not redundancy. A Server Action is reachable with
 * `curl` and a session cookie: it passes through no page body, no layout and no proxy matcher, so
 * the check inside it is the only one that runs.
 *
 * THE SIGNATURE THIS FOLLOWS IS ALREADY SPENT. By the time this is called Cloudinary holds the
 * bytes, so this cannot refuse the upload — only the row. That is why the folder and kind are
 * re-validated here anyway: a caller who reached this directly could otherwise record an asset
 * against a folder the sign endpoint would never have signed, and the row is what the rest of the
 * product reads.
 *
 * THE DUPLICATE GUARD RUNS HERE, BEFORE THE ROW (Phase 33). Cloudinary holds the bytes, so the
 * action fetches the ORIGINAL back from the delivery origin, hashes it in memory, and asks
 * `checkMediaAgainstResearch()` — two reads, compared in TypeScript — whether this picture is
 * already a Rivya asset or a competitor's photograph held in research. A refusal destroys the
 * Cloudinary object, writes a DENIED audit row naming what it matched, and records nothing. The
 * guard's reads use the service role: an editor's session cannot see the research table, and a
 * guard that could only see what the uploader may read would let a competitor's photograph past
 * exactly the person most likely to upload one. Images and videos only; a video is caught by
 * exact checksum, which is all a checksum can promise.
 */

const saveSchema = z.object({
  publicId: z.string().min(1).max(400),
  folder: z.string().min(1).max(200),
  kind: z.enum(UPLOAD_KINDS as [string, ...string[]]),
  // HIGGSFIELD is absent: that provenance belongs to Phase 07's importer, and an uploader
  // asserting it would be claiming an asset came from a library it was never in.
  source: z.enum(['REAL', 'USER_UPLOAD', 'RENDER', 'FALLBACK']),
  // Non-empty mirrors the column. The uploader refuses to send an empty one, but the uploader is
  // not the control.
  altText: z.string().min(1).max(1000),
  filename: z.string().min(1).max(400),
  mimeType: z.string().min(1).max(120),
})

export type SaveMediaAssetResult = { ok: true; id: string } | { ok: false; error: string }

export async function saveUploadedAssetAction(input: unknown): Promise<SaveMediaAssetResult> {
  try {
    const session = await requirePermission('media.write')

    const parsed = saveSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: t('studio.media.upload.refused') }

    const { publicId, folder, altText, filename, mimeType } = parsed.data
    const kind = parsed.data.kind as keyof typeof UPLOAD_LIMITS

    if (!isAllowedFolder(folder)) {
      await writeAudit({
        action: 'media.save',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'media_assets',
        summary: `Refused to record an asset in "${folder}", which is not on the allowlist.`,
      })
      return { ok: false, error: t('studio.media.upload.refused') }
    }

    // --- Phase 33: the duplicate guard, before the insert -----------------------------------
    let hashes: MediaHashes | null = null
    if (kind === 'IMAGE' || kind === 'VIDEO') {
      try {
        hashes = await fetchAndHash(kind, publicId)
      } catch {
        await discardUpload(publicId, kind)
        await writeAudit({
          action: 'media.save',
          result: 'DENIED',
          actorUserId: session.userId,
          actorRole: session.role,
          entityType: 'media_assets',
          summary: `Could not fetch ${publicId} back for the duplicate check; not recorded.`,
        })
        return { ok: false, error: t('studio.media.upload.guardUnavailable') }
      }
      const verdict = await guard(hashes)
      if (!verdict.ok) {
        await discardUpload(publicId, kind)
        await writeAudit({
          action: 'media.save',
          result: 'DENIED',
          actorUserId: session.userId,
          actorRole: session.role,
          entityType: 'media_assets',
          summary: `Refused ${publicId}: ${verdict.code} of ${verdict.label} (${verdict.matchId}, distance ${String(verdict.distance)}).`,
        })
        return { ok: false, error: refusalMessage(verdict) }
      }
    }

    const client = await createClient()
    const asset = await insertMediaAsset(client, {
      public_id: publicId,
      folder,
      resource_type: UPLOAD_LIMITS[kind].resourceType,
      kind,
      source: parsed.data.source,
      alt_text: altText,
      // An uploaded file is not AI-generated and is not a concept. Both columns are `not null`,
      // and neither may be inferred from the file — Phase 07's importer sets them true for the
      // Higgsfield library, which is the only place they are true today.
      is_ai_generated: false,
      is_concept: false,
      filename,
      mime_type: mimeType,
      uploaded_by: session.userId,
      ...(hashes === null ? {} : { checksum: hashes.checksum }),
    })

    if (hashes !== null) {
      // The asset's own hash row, so the NEXT upload of this picture is refused by name.
      await upsertMediaAssetHash(createAdminClient(), {
        media_asset_id: asset.id,
        kind: hashes.kind,
        checksum: hashes.checksum,
        phash: hashes.phash,
        dhash: hashes.dhash,
      })
    }

    await writeAudit({
      action: 'media.save',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'media_assets',
      entityId: asset.id,
      summary: `Recorded ${kind} asset ${publicId} in ${folder}.`,
    })

    // Every media surface lists from the same table, so a new asset changes all of them. The
    // layout segment is revalidated rather than six paths, which cannot fall out of step with the
    // route list the way an enumeration would.
    revalidatePath('/studio/media', 'layout')

    return { ok: true, id: asset.id }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      // Deliberately the same message as a malformed request. A Studio user who has lost their
      // session and one who never had the permission both need to be told the upload was refused;
      // neither needs to learn which.
      return { ok: false, error: t('studio.media.upload.refused') }
    }
    // A repository failure — a constraint, a dropped connection. The row was not written, which is
    // the only thing the person needs to know.
    return { ok: false, error: t('studio.media.upload.failed') }
  }
}

// --- Phase 33 helpers -----------------------------------------------------------------------------

/** The original bytes, from the delivery origin — the same URL `media:hash` fetches. */
async function fetchAndHash(kind: 'IMAGE' | 'VIDEO', publicId: string): Promise<MediaHashes> {
  const cloudName = requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
  const resourceType = kind === 'IMAGE' ? 'image' : 'video'
  const response = await fetch(originalUrl(cloudName, { publicId, resourceType }), {
    signal: AbortSignal.timeout(60_000),
    cache: 'no-store',
  })
  if (!response.ok || response.body === null) {
    throw new Error(`delivery answered ${String(response.status)}`)
  }
  if (kind === 'VIDEO') {
    return {
      kind: 'VIDEO',
      checksum: await sha256OfStream(response.body),
      phash: null,
      dhash: null,
    }
  }
  return hashImageBytes(new Uint8Array(await response.arrayBuffer()))
}

/** Two reads under the service role, compared in `lib/media/duplicate-guard.ts`. */
async function guard(hashes: MediaHashes): Promise<GuardVerdict> {
  const admin = createAdminClient()
  return checkMediaAgainstResearch(
    { checksum: hashes.checksum, phash: hashes.phash },
    {
      rivya: async () =>
        (await listMediaAssetHashes(admin)).map((row) => ({
          id: row.media_asset_id,
          checksum: row.checksum,
          phash: row.phash,
          label:
            row.media_assets?.rivya_asset_id ?? row.media_assets?.public_id ?? row.media_asset_id,
        })),
      research: async () => {
        const [rows, slugs] = await Promise.all([
          listResearchImageHashes(admin),
          sourceSlugsById(admin),
        ])
        return rows.map((row) => ({
          id: row.id,
          checksum: row.checksum,
          phash: row.phash,
          label: slugs.get(row.source_id) ?? row.source_id,
        }))
      },
    },
  )
}

function refusalMessage(verdict: Extract<GuardVerdict, { ok: false }>): string {
  const own = verdict.code === 'EXACT_RIVYA' || verdict.code === 'NEAR_DUPLICATE_RIVYA'
  const lead = own
    ? t('studio.media.upload.duplicateRivya')
    : t('studio.media.upload.duplicateResearch')
  return `${lead} ${verdict.label}.`
}

/** Best effort: a refused upload should not linger in the library's folder. */
async function discardUpload(publicId: string, kind: 'IMAGE' | 'VIDEO'): Promise<void> {
  try {
    await getMediaProvider().destroy({
      publicId,
      resourceType: kind === 'IMAGE' ? 'image' : 'video',
    })
  } catch {
    // The row was never written; an orphaned file is a cost, not a correctness problem.
  }
}
