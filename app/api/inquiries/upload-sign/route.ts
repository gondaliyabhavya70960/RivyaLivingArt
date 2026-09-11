import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getMediaProvider } from '@/lib/media'
import { inquiryFolder } from '@/lib/media/folders'
import { isSameOrigin } from '@/lib/security/origin'
import {
  INQUIRY_UPLOAD_WINDOWS,
  bucketKey,
  callerAddress,
  consume,
} from '@/lib/security/rate-limit'

/**
 * Issue a signed direct-upload credential to an ANONYMOUS VISITOR.
 *
 * THIS IS THE ONLY UNAUTHENTICATED WRITE-ADJACENT ENDPOINT ON THE SITE, and every line below exists
 * because of that. `app/api/media/sign` has a staff session and a permission to lean on; this one
 * has neither, by design — D1 forbids customer accounts, so a visitor attaching a reference image to
 * a bespoke brief is nobody. What stops it becoming an open file host is not identity but the shape
 * of what it will sign.
 *
 * THE FIVE CONSTRAINTS, IN THE ORDER THEY ARE APPLIED:
 *
 *   1. Same-origin. A POST whose Origin is not this site is refused before anything else runs. The
 *      endpoint is only ever called by our own configurator, so cross-origin traffic is either a
 *      mistake or somebody using our Cloudinary account from their own page.
 *   2. Rate limit — 3 a minute and 10 an hour, per hashed address, both consumed. Before the body
 *      is parsed, so a malformed flood costs the attacker the same as a well-formed one.
 *   3. Zod. Two declared values and nothing else; there is no field a caller can use to steer this.
 *   4. MIME allowlist and byte ceiling, from this file's own table rather than the staff limits.
 *   5. THE FOLDER IS MINTED HERE. `rivya/inquiries/incoming/<uuid v4>`, generated server-side and
 *      signed into the credential. Cloudinary recomputes the signature over what it receives, so a
 *      holder of one signature can write into that folder and nowhere else in the account.
 *
 * A CLIENT-SUPPLIED FOLDER IS NOT REFUSED — IT IS NOT READ. The phase document's verification step
 * sends `{"folder":"rivya/brand", …}` and expects the response to sign the inquiries path anyway.
 * Rejecting it would be defensible; ignoring it is stronger, because there is then no code path in
 * which a folder from the request reaches the signature at all.
 *
 * NO ROW IS WRITTEN HERE, and that is deliberate rather than deferred. The signature does not know
 * the public_id the browser will end up with, so a `media_assets` row minted now would name an asset
 * that may never exist. Phase 20 persists the inquiry and turns the references it carries into rows
 * — `source = 'USER_UPLOAD'`, `status = 'DRAFT'`, alt text from the original filename — after
 * checking each one is really under this prefix. Between the two, an abandoned upload is a
 * Cloudinary object with no row, which is exactly what the 30-day orphan purge exists for.
 */

const MB = 1024 * 1024

/**
 * What a visitor may attach. NARROWER THAN THE STAFF LIMITS, and every difference is a decision.
 *
 * HEIC is here and is absent from `UPLOAD_LIMITS.IMAGE`: it is what an iPhone produces by default,
 * and a visitor photographing their own dining room should not have to convert a file to ask a
 * question. AVIF and MP4 are not: a reference is a picture of a room or a page torn out of a
 * magazine, and accepting video from an anonymous caller buys nothing and costs bandwidth.
 *
 * PDF is here because references arrive as one — a floor plan, a moodboard, a page from an
 * architect. SVG is absent for the reason it is absent everywhere in this repository
 * (SECURITY.md §7.2): it is XML the browser executes in the same origin.
 */
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const

/** 10 MB per file, 5 files per submission. The count is enforced by the form schema, not here. */
const MAX_BYTES = 10 * MB
export const MAX_FILES = 5

const bodySchema = z.object({
  /** The browser's declared type. Checked here; the real one is checked after upload. */
  mime: z.string().min(1).max(120),
  /** The browser's declared size, from `File.size`. Cheap to lie about, which is why the ceiling
   *  is also signed into what Cloudinary will accept. */
  bytes: z.number().int().positive(),
  /**
   * An existing submission folder, so a second and third file land beside the first.
   *
   * IT IS VALIDATED AS A UUID AND NOTHING ELSE. The client may name a folder it was already given,
   * which is not the same as choosing one: the value is passed through `inquiryFolder()`, which
   * refuses anything that is not a uuid and assembles the path itself. A caller who guesses another
   * visitor's uuid could add a file to their folder and could not read one — Cloudinary listing is
   * an authenticated Admin API call, and nothing public enumerates it.
   */
  submissionId: z.uuid().optional(),
})

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { allowed } = await consume(
    bucketKey('inq_upload', callerAddress(request)),
    INQUIRY_UPLOAD_WINDOWS,
  )
  if (!allowed) {
    /*
     * 429 CARRIES THE COPY KEY, NOT THE COPY. D2 puts every visitor-readable string in
     * `global_content`, and SEED §49's upload error is already there as `FORM_COPY.error.upload`.
     * Returning the sentence from here would put a literal on a public surface that an editor could
     * not change; returning the key lets the configurator — which already holds the site strings —
     * render whatever the row says today.
     */
    return NextResponse.json(
      { error: 'rate-limited', copyKey: 'FORM_COPY.error.upload' },
      { status: 429, headers: { 'cache-control': 'no-store' } },
    )
  }

  let parsed
  try {
    parsed = bodySchema.safeParse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { mime, bytes, submissionId } = parsed.data

  if (!(ALLOWED_MIME as readonly string[]).includes(mime)) {
    // 422, not 400: the request was understood and refused on policy. A client that cannot tell
    // those apart retries a malformed body forever and gives up on a refusal it should surface.
    return NextResponse.json(
      {
        error: 'unsupported-type',
        allowedFormats: ALLOWED_MIME,
        copyKey: 'FORM_COPY.error.upload',
      },
      { status: 422, headers: { 'cache-control': 'no-store' } },
    )
  }

  if (bytes > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too-large', maxBytes: MAX_BYTES, copyKey: 'FORM_COPY.error.upload' },
      { status: 422, headers: { 'cache-control': 'no-store' } },
    )
  }

  // The uuid is minted here on the first file of a submission and echoed back, so the second and
  // third land beside the first. Nothing about it comes from the request except the choice to
  // continue an existing submission, and that choice is validated as a uuid before it is used.
  const id = submissionId ?? randomUUID()
  const folder = inquiryFolder(id)

  const signed = await getMediaProvider().signUpload({
    folder,
    kind: mime === 'application/pdf' ? 'DOCUMENT' : 'IMAGE',
    // Provenance without identity. The visitor has no account — D1 — so the folder's own uuid is
    // the most specific true thing that can be recorded about who uploaded this.
    uploadedBy: id,
  })

  return NextResponse.json(
    { ...signed, submissionId: id, maxBytes: MAX_BYTES, allowedFormats: ALLOWED_MIME },
    // A credential in a shared cache is a write into the Cloudinary account for whoever reads it
    // next. `no-store` is not optional on this route.
    { headers: { 'cache-control': 'no-store' } },
  )
}
