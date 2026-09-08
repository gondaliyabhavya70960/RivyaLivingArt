import { NextResponse } from 'next/server'
import { z } from 'zod'

import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { getMediaProvider } from '@/lib/media'
import { DisallowedFolderError, assertFolder } from '@/lib/media/folders'
import { UPLOAD_KINDS, UPLOAD_LIMITS, checkUploadRequest } from '@/lib/media/upload-limits'

/**
 * Issue a signed direct-upload credential for Cloudinary.
 *
 * WHAT THIS ENDPOINT ACTUALLY IS. It is not "an upload endpoint" — the bytes never touch this
 * server. It mints a credential that lets the holder's browser write into the Rivya Cloudinary
 * account. Everything below therefore happens BEFORE the signature is produced, because after it
 * there is nothing left to enforce: the signature is the permission.
 *
 * The five gates, in order, and each is here for its own reason:
 *
 *   1. Session and `media.write`. The permission is `media.write` rather than the phase document's
 *      `media:upload`, which is not in the matrix — signing an upload IS a media write, and
 *      inventing a permission to match a phrase would put a name in the matrix that no policy uses.
 *   2. Zod. A body that does not parse never reaches the folder check.
 *   3. Folder allowlist. Without it a signed upload could be directed anywhere in the account.
 *   4. MIME allowlist and byte ceiling, per kind (SECURITY.md §7.1).
 *   5. Only then, the signature.
 *
 * WHAT IS NOT HERE, STATED RATHER THAN OMITTED. SECURITY.md §8 fixes a 20-per-hour limit on this
 * route keyed on the staff `user_id`. It is NOT enforced yet, because it is a fixed-window counter
 * over `rate_limit_buckets`, and that table belongs to Phase 41 (`0390_phase41_security.sql`).
 * Creating it here would take a table out of the phase that owns it, and pretending the limit
 * exists would be worse than either. The exposure in the meantime is bounded but real: a staff
 * session with `media.write` — or one that has been stolen — can mint signatures as fast as it can
 * ask. Phase 41 closes it; until then this comment is the record that it is open.
 *
 * TYPE DETECTION BY MAGIC BYTES IS ALSO NOT HERE, and cannot be. §7.1 requires it, and it needs
 * the bytes — which at signing time do not exist yet. This route checks the DECLARED type, which
 * stops a signature being issued for a category at all; `lib/media/validate-upload.ts` checks the
 * real one after upload. Neither makes the other redundant.
 */

const bodySchema = z.object({
  folder: z.string().min(1).max(200),
  kind: z.enum(UPLOAD_KINDS as [string, ...string[]]),
  // The browser's declared type. Checked, and then checked again for real after the upload.
  mimeType: z.string().min(1).max(120),
  // The browser's declared size, from `File.size`. Cheap to lie about, which is why the provider
  // is asked for the real figure by `probe()` before any of it reaches a row.
  bytes: z.number().int().positive(),
})

export async function POST(request: Request): Promise<NextResponse> {
  let session
  try {
    session = await requirePermission('media.write')
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    throw error
  }

  let parsed
  try {
    parsed = bodySchema.safeParse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { folder, mimeType, bytes } = parsed.data
  const kind = parsed.data.kind as keyof typeof UPLOAD_LIMITS

  try {
    assertFolder(folder)
  } catch (error) {
    if (error instanceof DisallowedFolderError) {
      // A refused folder is recorded. This is the one request shape that looks like somebody
      // probing for a writable path in the account, and a security log that shows only successful
      // signatures could not distinguish that from ordinary use.
      await writeAudit({
        action: 'media.sign',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'media_assets',
        summary: `Refused a signature for the folder "${folder}", which is not on the allowlist.`,
      })
      // The folder is echoed because it came from our own Studio client and naming it is what
      // makes the failure diagnosable by whoever hit it.
      return NextResponse.json({ error: 'disallowed-folder', folder }, { status: 400 })
    }
    throw error
  }

  const rejection = checkUploadRequest(kind, mimeType, bytes)
  if (rejection !== null) {
    if (rejection.reason === 'banned-type') {
      // SVG, by every spelling. Logged rather than merely refused: an attempt to upload one is
      // either a misunderstanding worth correcting or something worth seeing.
      await writeAudit({
        action: 'media.sign',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'media_assets',
        summary: `Refused a signature for banned type "${rejection.mimeType}" (SECURITY.md §7.2).`,
      })
    }
    // The limits are returned with the refusal so the uploader can say "PNG or JPEG, up to 5 MB"
    // rather than "rejected", which is the difference between a message somebody can act on and
    // one they have to ask about.
    return NextResponse.json(
      {
        error: rejection.reason,
        allowedFormats: UPLOAD_LIMITS[kind].mimeTypes,
        maxBytes: UPLOAD_LIMITS[kind].maxBytes,
      },
      { status: 400 },
    )
  }

  const signed = await getMediaProvider().signUpload({
    folder,
    kind,
    uploadedBy: session.userId,
  })

  await writeAudit({
    action: 'media.sign',
    result: 'SUCCESS',
    actorUserId: session.userId,
    actorRole: session.role,
    entityType: 'media_assets',
    summary: `Issued an upload signature for ${kind} into ${folder}.`,
  })

  // `no-store` is not optional here. The response carries a credential scoped to one staff member;
  // a shared cache holding it would hand the next reader a write into the Cloudinary account.
  return NextResponse.json(signed, { headers: { 'cache-control': 'no-store' } })
}
