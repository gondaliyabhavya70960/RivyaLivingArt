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
import { validateUpload, type UploadVerdict } from '@/lib/media/validate-upload'
import { originalUrl } from '@/lib/media/url'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertMediaAsset, updateMediaAsset } from '@/lib/supabase/repositories/media'
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

    // --- Phase 41: the bytes, before anything trusts the declared type ----------------------
    //
    // The signature is spent and Cloudinary holds the file, so this refuses the ROW and destroys
    // the object. That is the whole control: `media_assets` never gains a row for a file whose
    // bytes are not what the upload said they were, and nothing in the product reads Cloudinary
    // except through that table.
    const bytes = await inspectBytes(kind, publicId, mimeType)
    if (!bytes.ok) {
      await discardUpload(publicId, kind)
      await writeAudit({
        action: 'media.save',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'media_assets',
        // The rule and the sniffed type, never the file's contents.
        summary: `Refused ${publicId}: ${bytes.reason ?? 'UNVERIFIED'} — ${bytes.detail ?? 'the bytes could not be read back'}.`,
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

/**
 * Best effort: a refused upload should not linger in the library's folder.
 *
 * Phase 41 widened this from the two hashable kinds to all five, because the byte check refuses
 * documents and models too and an orphaned PDF is no more welcome than an orphaned JPEG. The
 * resource type comes from the limits table rather than a ternary, so a new kind cannot be
 * destroyed under the wrong namespace.
 */
async function discardUpload(publicId: string, kind: keyof typeof UPLOAD_LIMITS): Promise<void> {
  try {
    await getMediaProvider().destroy({
      publicId,
      resourceType: UPLOAD_LIMITS[kind].resourceType,
    })
  } catch {
    // The row was never written; an orphaned file is a cost, not a correctness problem.
  }
}

/* --- Phase 41: byte verification --------------------------------------------------------------- */

/**
 * The first 4 kB of the stored original, plus the length the delivery origin reports, run through
 * `validateUpload` — Phase 41, SECURITY.md §7.
 *
 * A PREFIX RATHER THAN THE WHOLE FILE. Every rule that can refuse a file reads the first bytes: the
 * magic-byte signature, the markup sniff, the declared-type agreement. Size is the one that needs
 * the whole file, and the origin already knows it and says so in a header — so a 200 MB video is
 * judged without 200 MB crossing the wire. 4 kB is far more than any signature needs and enough for
 * `looksLikeMarkup` to see past a byte-order mark and leading whitespace.
 *
 * A `Range` HEADER THE ORIGIN MAY IGNORE. If it answers 200 with the whole body the read is
 * cancelled after the first chunks, so the cost is bounded either way.
 *
 * UNREADABLE IS REFUSED, NOT WAVED THROUGH. A verdict that fell open on a network error would make
 * this gate absent exactly when the origin is misbehaving.
 */
async function inspectBytes(
  kind: keyof typeof UPLOAD_LIMITS,
  publicId: string,
  declaredMime: string,
): Promise<UploadVerdict> {
  const cloudName = requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
  const { resourceType } = UPLOAD_LIMITS[kind]
  const url = originalUrl(cloudName, { publicId, resourceType })

  let head: Uint8Array
  let byteLength: number
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-4095' },
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    })
    if (!response.ok || response.body === null) {
      return {
        ok: false,
        reason: 'UNRECOGNISED_FORMAT',
        detail: `delivery answered ${String(response.status)}`,
      }
    }
    byteLength = totalLength(response.headers)
    head = await readPrefix(response.body, 4096)
  } catch {
    return {
      ok: false,
      reason: 'UNRECOGNISED_FORMAT',
      detail: 'the original could not be read back',
    }
  }

  return validateUpload({
    kind,
    buffer: head,
    declaredMime,
    // A `content-range` total, a `content-length` on a full answer, or the prefix itself — in
    // which case the file is no larger than what was read and the ceiling cannot be exceeded.
    byteLength: byteLength === -1 ? head.byteLength : byteLength,
  })
}

/**
 * The file's real length: `Content-Range`'s total when the range was honoured, else
 * `Content-Length`.
 *
 * THE CANONICAL SPELLING, not the lower-case one. `Headers.get` is case-insensitive either way, and
 * `'content-range'` is indistinguishable from a Tailwind utility to `scripts/design/check-utilities.mjs`
 * — `content-` is a real prefix — so the gate reported it as a class that generates no CSS.
 */
function totalLength(headers: Headers): number {
  const range = headers.get('Content-Range')
  const total = range === null ? null : /\/(\d+)\s*$/.exec(range)?.[1]
  if (total !== null && total !== undefined) return Number.parseInt(total, 10)
  const length = headers.get('Content-Length')
  // 206 with no content-range, or no length at all: unknown, and the caller falls back safely.
  if (length === null || range !== null) return -1
  return Number.parseInt(length, 10)
}

/** At most `limit` bytes, then the body is cancelled — the origin may have ignored the Range. */
async function readPrefix(body: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let taken = 0
  try {
    while (taken < limit) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      taken += value.byteLength
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  const out = new Uint8Array(Math.min(taken, limit))
  let offset = 0
  for (const chunk of chunks) {
    if (offset >= out.byteLength) break
    const slice = chunk.subarray(0, out.byteLength - offset)
    out.set(slice, offset)
    offset += slice.byteLength
  }
  return out
}

/* --- Phase 41: the accessibility panel -------------------------------------------------------- */

const accessibilitySchema = z.object({
  id: z.string().uuid(),
  altText: z.string().trim().min(1).max(500),
  isDecorative: z.boolean(),
})

export type AccessibilityResult = { ok: true } | { ok: false; error: string }

/**
 * Save an asset's text alternative and its decorative state — Phase 41, WCAG 1.1.1.
 *
 * THE TWO FIELDS ARE SAVED TOGETHER BECAUSE THE RULE IS ABOUT BOTH. An asset either has a usable
 * sentence or is explicitly marked as carrying nothing the surrounding text does not already give.
 * `0390`'s CHECK enforces exactly that, and editing the two in one act is what stops somebody
 * clearing the alt text, hitting the constraint, and reaching for the decorative toggle to get past
 * it — which would mark an informative image decorative to satisfy a database error.
 *
 * THE SENTENCE IS KEPT EVEN WHEN DECORATIVE. Marking an asset decorative changes what is RENDERED
 * (`alt=""`), not what is recorded. If the decision is reversed later the sentence is still there,
 * and an audit can read what somebody thought the image showed.
 *
 * `media.write`, and an audit row either way. Alt text is the thing a sighted reviewer never sees
 * change, which makes it exactly the field worth a record of who changed it.
 */
export async function saveAccessibilityAction(input: unknown): Promise<AccessibilityResult> {
  try {
    const session = await requirePermission('media.write')

    const parsed = accessibilitySchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: t('studio.media.a11y.refused') }

    const { id, altText, isDecorative } = parsed.data

    await updateMediaAsset(
      await createClient(),
      id,
      { alt_text: altText, is_decorative: isDecorative },
      session.userId,
    )

    await writeAudit({
      action: 'media.accessibility.save',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'media_assets',
      entityId: id,
      summary: isDecorative
        ? 'Marked decorative: the image renders alt="" and a screen reader skips it.'
        : 'Text alternative updated.',
    })

    revalidatePath('/studio/media')
    return { ok: true }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { ok: false, error: t('studio.media.a11y.refused') }
    }
    throw error
  }
}
