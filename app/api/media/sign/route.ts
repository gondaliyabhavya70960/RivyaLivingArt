import { NextResponse } from 'next/server'
import { z } from 'zod'

import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import {
  MEDIA_SIGN_WINDOWS,
  bucketKey,
  consume,
  retryAfterSeconds,
} from '@/lib/security/rate-limit'
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
 * THE RATE LIMIT PHASE 41 PROMISED IS NOW HERE, and the note that used to stand in its place is
 * gone. Twenty an hour, KEYED ON THE STAFF `user_id` RATHER THAN THE ADDRESS: a studio works from
 * one office and one connection, so an address key would make one editor's bulk upload refuse
 * another's. It is consumed AFTER the permission check, which is the opposite of the order the
 * public endpoints use — there, the limit protects an unauthenticated surface and must run before
 * anything expensive; here, an unauthenticated caller is already refused with a 401, and charging
 * their attempt against a staff member's window would let a stranger exhaust a colleague's quota.
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

  const { allowed } = await consume(bucketKey('media_sign', session.userId), MEDIA_SIGN_WINDOWS)
  if (!allowed) {
    return NextResponse.json(
      { error: 'rate-limited' },
      {
        status: 429,
        headers: {
          'cache-control': 'no-store',
          'Retry-After': String(retryAfterSeconds(MEDIA_SIGN_WINDOWS)),
        },
      },
    )
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
      //
      // 422, not 400, and the phase document specifies it. The distinction is real: 400 means the
      // request could not be understood, 422 means it was understood and refused. A client that
      // cannot tell those apart retries a malformed body forever and gives up on a policy refusal
      // it should surface to the person.
      return NextResponse.json({ error: 'disallowed-folder', folder }, { status: 422 })
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
    // 422 for the same reason as the folder: the request was understood, and refused on policy.
    // 400 is kept for a body that could not be parsed or did not match the schema.
    return NextResponse.json(
      {
        error: rejection.reason,
        allowedFormats: UPLOAD_LIMITS[kind].mimeTypes,
        maxBytes: UPLOAD_LIMITS[kind].maxBytes,
      },
      { status: 422 },
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
