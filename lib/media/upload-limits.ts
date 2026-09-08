import type { Enums } from '../supabase/database.types'

/**
 * What the staff sign endpoint will accept, per media kind.
 *
 * THESE NUMBERS ARE SECURITY.md §7.1's, and that table is the one to edit. It is reproduced here
 * as code rather than referenced in a comment because a ceiling that lives only in prose is not a
 * ceiling. §7.1 notes it takes its own values from CLOUDINARY.md §4 with one deliberate exception
 * — the `BRAND` row — so where the two disagree, §7.1 wins and CLOUDINARY.md is the one to correct.
 *
 * SVG IS ABSENT FROM EVERY ROW, INCLUDING BRAND, AND THAT IS NOT AN OVERSIGHT. SECURITY.md §7.2:
 * an SVG is XML the browser executes in the same origin, a sanitiser must be right forever, and no
 * Rivya surface needs an uploaded one. `CLOUDINARY.md` §4 and `MEDIA_GUIDE.md` §3 both still list
 * `image/svg+xml` for BRAND; Phase 43 owns correcting them, and until it does an engineer working
 * from those two documents alone would ship the one file type the ban exists to keep out. If a
 * brand mark exists only as SVG, the answer is a PNG export at 2× from whoever supplies it —
 * never a sanitiser, and never an exception here.
 *
 * THE CLIENT IS TOLD THESE LIMITS AND THE SERVER ENFORCES THEM ANYWAY. Echoing them in the sign
 * response lets the uploader refuse a 300 MB file before spending the upload, which is a courtesy
 * to whoever is on a slow connection. It is never the control: the signature is what makes an
 * upload possible, so every limit is applied before signing.
 */

const MB = 1024 * 1024

export type UploadKind = Enums<'media_kind'>

export type UploadLimits = {
  readonly mimeTypes: readonly string[]
  readonly maxBytes: number
  /** Cloudinary's namespace for this kind. A GLB is `raw`: it is not an image and not a video. */
  readonly resourceType: 'image' | 'video' | 'raw'
}

export const UPLOAD_LIMITS: Record<UploadKind, UploadLimits> = {
  IMAGE: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    maxBytes: 25 * MB,
    resourceType: 'image',
  },
  VIDEO: {
    // MP4/H.264 only. WebM is refused on purpose: delivery re-encoding is Cloudinary's job, and
    // accepting a second source container doubles the transcode matrix for no editorial gain.
    mimeTypes: ['video/mp4'],
    maxBytes: 200 * MB,
    resourceType: 'video',
  },
  MODEL_3D: {
    mimeTypes: ['model/gltf-binary', 'model/gltf+json'],
    maxBytes: 50 * MB,
    resourceType: 'raw',
  },
  DOCUMENT: {
    mimeTypes: ['application/pdf'],
    maxBytes: 25 * MB,
    resourceType: 'raw',
  },
  BRAND: {
    // §7.2's row, which differs from CLOUDINARY.md §4 deliberately. ICO is here because a favicon
    // has no other honest format; SVG is not, for the reason in this file's header.
    mimeTypes: ['image/png', 'image/jpeg', 'image/vnd.microsoft.icon'],
    maxBytes: 5 * MB,
    resourceType: 'image',
  },
}

export const UPLOAD_KINDS = Object.keys(UPLOAD_LIMITS) as readonly UploadKind[]

/** Every MIME type accepted on the staff path, across all kinds. */
export const ALL_STAFF_MIME_TYPES: readonly string[] = [
  ...new Set(UPLOAD_KINDS.flatMap((kind) => UPLOAD_LIMITS[kind].mimeTypes)),
]

/**
 * SVG, by every spelling that has ever reached a server.
 *
 * Checked as an explicit denial rather than left to the allowlist's silence. An allowlist alone
 * would already refuse these — but the ban is unconditional across every path including the
 * owner's, so it is worth being able to point at the line that implements it, and worth failing
 * loudly if some future path is ever built on a wider allowlist.
 */
export const BANNED_MIME_TYPES: readonly string[] = [
  'image/svg+xml',
  'image/svg',
  'text/svg+xml',
  'application/svg+xml',
]

export type UploadRejection =
  | { readonly reason: 'banned-type'; readonly mimeType: string }
  | { readonly reason: 'disallowed-type'; readonly mimeType: string; readonly kind: UploadKind }
  | { readonly reason: 'too-large'; readonly bytes: number; readonly maxBytes: number }

/**
 * Check a declared MIME type and size against the kind's limits.
 *
 * WHAT THIS DOES NOT DO IS THE IMPORTANT PART. It checks the *declared* type, which is the only
 * thing available at signing time — the bytes have not been uploaded yet. SECURITY.md §7.1 fixes
 * type detection by magic bytes, and that check necessarily happens after the file exists, in
 * `lib/media/validate-upload.ts`. Neither check makes the other redundant: this one stops a signed
 * upload being issued for a category the folder should never contain, and the magic-byte check
 * stops a JPEG that claimed to be a PDF.
 */
export function checkUploadRequest(
  kind: UploadKind,
  mimeType: string,
  bytes: number,
): UploadRejection | null {
  const normalised = mimeType.trim().toLowerCase()

  if (BANNED_MIME_TYPES.includes(normalised)) {
    return { reason: 'banned-type', mimeType: normalised }
  }

  const limits = UPLOAD_LIMITS[kind]
  if (!limits.mimeTypes.includes(normalised)) {
    return { reason: 'disallowed-type', mimeType: normalised, kind }
  }
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > limits.maxBytes) {
    return { reason: 'too-large', bytes, maxBytes: limits.maxBytes }
  }
  return null
}
