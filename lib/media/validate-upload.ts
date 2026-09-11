import 'server-only'

import { UPLOAD_LIMITS, type UploadKind } from './upload-limits'

/**
 * UPLOAD VALIDATION AGAINST THE BYTES — Phase 41, SECURITY.md §7.
 *
 * `app/api/media/sign` checks the DECLARED type before issuing a signature, which is the only thing
 * it can do: at signing time the file does not exist yet. This module checks the REAL type, after the
 * bytes are in hand, and the two are not redundant. A caller can declare `image/png`, receive a
 * signature, and upload anything at all.
 *
 * WHY A DECLARED MIME TYPE IS WORTH NOTHING. It is a string the client chose. So is the extension.
 * Browsers guess it from the extension in the first place, and a file renamed `.png` reports
 * `image/png` from the operating system onwards. The only fact about a file is its bytes, and the
 * first few of them say what it is.
 *
 * THE SVG BAN IS UNCONDITIONAL AND THAT INCLUDES STAFF. An SVG is XML the browser executes in the
 * same origin: it can carry `<script>`, an `onload`, a `<foreignObject>` with HTML inside, an
 * `<image>` referencing an external URL. A sanitiser is the usual answer and it is a permanent
 * liability — it has to be right about a format that keeps growing, forever, and being wrong once is
 * a stored XSS in the Studio's own origin. No Rivya surface needs an uploaded SVG. Brand marks, the
 * one case where a designer would normally hand over SVG, have their own raster format table below,
 * and `/studio/media/brand` states it before the person chooses a file rather than after the
 * validator rejects one.
 *
 * IT IS A PURE FUNCTION OVER A BUFFER. No network, no database, no Cloudinary client — which is what
 * lets `tests/unit/upload-validation.test.ts` feed it a JPEG renamed `.glb` and a PNG with an SVG
 * payload without a fixture or a server. The EXIF strip and the GLB parse are the two steps that
 * cannot be pure, and both are called out where they belong.
 */

/**
 * Magic-byte signatures, longest first so a prefix cannot shadow a longer match.
 *
 * `offset` exists for the container formats: an MP4's `ftyp` box sits at byte 4, and a WebP's `WEBP`
 * marker at byte 8 behind a RIFF header. Everything else starts at zero.
 */
interface Signature {
  readonly mime: string
  readonly bytes: readonly number[]
  readonly offset?: number
  /** A second window that must also match, for containers whose first bytes are a length. */
  readonly also?: { readonly bytes: readonly number[]; readonly offset: number }
}

const SIGNATURES: readonly Signature[] = [
  // PNG: \x89PNG\r\n\x1a\n — eight bytes, the most unambiguous signature in common use.
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // JPEG: FF D8 FF. The fourth byte varies by encoder, so three is the reliable prefix.
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  // WebP: RIFF....WEBP
  {
    mime: 'image/webp',
    bytes: [0x52, 0x49, 0x46, 0x46],
    also: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  },
  // AVIF: a `ftyp` box at 4 with the `avif` brand at 8.
  {
    mime: 'image/avif',
    bytes: [0x66, 0x74, 0x79, 0x70],
    offset: 4,
    also: { bytes: [0x61, 0x76, 0x69, 0x66], offset: 8 },
  },
  // HEIC: the same box with a `heic` brand. Accepted from visitors only (it is what an iPhone makes).
  {
    mime: 'image/heic',
    bytes: [0x66, 0x74, 0x79, 0x70],
    offset: 4,
    also: { bytes: [0x68, 0x65, 0x69, 0x63], offset: 8 },
  },
  // MP4: `ftyp` at 4. The brand varies far too much to pin (isom, mp42, avc1, iso5, …), so the box
  // name is the check and the codec is Cloudinary's problem after ingest.
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  // GLB: the glTF binary container — magic 'glTF', then a little-endian version.
  { mime: 'model/gltf-binary', bytes: [0x67, 0x6c, 0x54, 0x46] },
  // PDF: %PDF-
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  // ICO: a zero word then image type 1.
  { mime: 'image/vnd.microsoft.icon', bytes: [0x00, 0x00, 0x01, 0x00] },
]

function matches(buffer: Uint8Array, signature: Signature): boolean {
  const at = (bytes: readonly number[], offset: number): boolean =>
    bytes.every((byte, index) => buffer[offset + index] === byte)
  if (!at(signature.bytes, signature.offset ?? 0)) return false
  return signature.also === undefined ? true : at(signature.also.bytes, signature.also.offset)
}

/**
 * The type the BYTES say this is, or null.
 *
 * Null is not "safe" — it is "unrecognised", and the caller refuses it. An allowlist that fell open
 * on an unknown signature would accept every format nobody thought about.
 */
export function sniffMime(buffer: Uint8Array): string | null {
  // Longest signature first: MP4, AVIF and HEIC all begin with the same `ftyp` box, and the ones
  // carrying a brand check must win over the bare one.
  const ordered = [...SIGNATURES].sort(
    (a, b) =>
      b.bytes.length + (b.also?.bytes.length ?? 0) - (a.bytes.length + (a.also?.bytes.length ?? 0)),
  )
  for (const signature of ordered) {
    if (matches(buffer, signature)) return signature.mime
  }
  return null
}

/**
 * Does this look like SVG or any other XML or HTML document?
 *
 * SNIFFED SEPARATELY AND BY CONTENT, NOT BY SIGNATURE, because SVG has no magic bytes. It is text,
 * it may open with a byte-order mark, an XML declaration, a DOCTYPE, a comment or whitespace, and
 * only then the `<svg` element. So the check reads the first kilobyte as text and looks for the
 * markers — which also catches an HTML file, and an XML bomb, and a PHP file with an `<svg` in it.
 *
 * IT RUNS BEFORE THE ALLOWLIST, so a file that is BOTH — an SVG renamed `.png`, or a polyglot
 * crafted to satisfy a PNG signature — is refused on this rule rather than accepted on the other.
 */
export function looksLikeMarkup(buffer: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(buffer.slice(0, 1024))
    // Strip a UTF-8 BOM, which is legal at the start of an XML document.
    .replace(/^﻿/, '')
    .trimStart()
    .toLowerCase()
  return (
    head.startsWith('<?xml') ||
    head.startsWith('<!doctype') ||
    head.startsWith('<svg') ||
    head.startsWith('<html') ||
    head.startsWith('<!--') ||
    head.includes('<svg')
  )
}

/**
 * The brand-mark format table — SECURITY.md §7.3, and Phase 43's handoff depends on it.
 *
 * WHY THESE FOUR SLOTS HAVE THEIR OWN RULES. The SVG ban would otherwise block the exact files a
 * designer hands over, so the accepted raster formats are stated per slot and the Studio shows them
 * BEFORE the owner picks a file. A raster mark at twice its largest rendered size is
 * indistinguishable at every D6 ratio the site uses, and it costs one validator instead of a
 * sanitiser that must be right forever.
 */
export const BRAND_SLOTS = {
  logo: {
    mimeTypes: ['image/png'],
    minLongEdge: 1024,
    describe: 'PNG with transparency, at least 1024 px on the long edge',
  },
  wordmark: {
    mimeTypes: ['image/png'],
    minLongEdge: 1024,
    describe: 'PNG with transparency, at least 1024 px on the long edge',
  },
  favicon: {
    mimeTypes: ['image/vnd.microsoft.icon', 'image/png'],
    minLongEdge: 512,
    describe: 'ICO containing 16, 32 and 48 px, or a 512 × 512 PNG',
  },
  og: {
    mimeTypes: ['image/png', 'image/jpeg'],
    exactSize: { width: 1200, height: 630 },
    describe: 'PNG or JPEG, exactly 1200 × 630',
  },
} as const

export type BrandSlot = keyof typeof BRAND_SLOTS

/** Fixed codes, so the Studio can map each to seeded copy rather than rendering a sentence from here. */
export type UploadRejection =
  | 'EMPTY'
  | 'MARKUP_REJECTED'
  | 'UNRECOGNISED_FORMAT'
  | 'TYPE_NOT_ALLOWED'
  | 'DECLARED_TYPE_MISMATCH'
  | 'TOO_LARGE'
  | 'BRAND_FORMAT'
  | 'BRAND_TOO_SMALL'
  | 'BRAND_WRONG_SIZE'

export interface UploadVerdict {
  readonly ok: boolean
  readonly reason?: UploadRejection
  /** The type the bytes actually are, when it could be determined. */
  readonly sniffed?: string
  /** Names the rule, never the file. Diagnostic; never rendered to a visitor. */
  readonly detail?: string
}

const ok = (sniffed: string): UploadVerdict => ({ ok: true, sniffed })
const no = (reason: UploadRejection, detail: string, sniffed?: string): UploadVerdict => ({
  ok: false,
  reason,
  detail,
  ...(sniffed === undefined ? {} : { sniffed }),
})

/**
 * Validate a file's bytes against the limits for its kind.
 *
 * ORDER MATTERS AND IS DELIBERATE:
 *
 *   1. NOT EMPTY. A zero-byte file sniffs as nothing and would fail later with a confusing reason.
 *   2. MARKUP. Before the allowlist, so a polyglot cannot pass by satisfying a raster signature.
 *   3. SNIFF. Unrecognised is refused, not accepted.
 *   4. THE ALLOWLIST, against the SNIFFED type — never the declared one.
 *   5. THE DECLARED TYPE MUST AGREE, when one was given. A mismatch is refused separately from
 *      "not allowed", because the two mean different things to whoever is debugging: one is a file
 *      the product does not take, the other is a client lying or a browser guessing badly.
 *   6. SIZE, last, because a 200 MB file that was never going to be accepted should be refused on
 *      what it is rather than on how big it is.
 */
export function validateUpload(input: {
  readonly kind: UploadKind
  readonly buffer: Uint8Array
  readonly declaredMime?: string
  /**
   * The file's real length, when `buffer` is only a prefix of it.
   *
   * A 200 MB video is not pulled into memory to be sniffed — the caller reads the first few
   * kilobytes and passes the length the delivery origin reported. Omitted, the buffer IS the file
   * and its own length is used, which is the case every test and every in-memory caller wants.
   */
  readonly byteLength?: number
}): UploadVerdict {
  const { kind, buffer, declaredMime } = input
  const limits = UPLOAD_LIMITS[kind]
  const size = input.byteLength ?? buffer.byteLength

  if (buffer.byteLength === 0 || size === 0) return no('EMPTY', 'zero bytes')

  if (looksLikeMarkup(buffer)) {
    return no(
      'MARKUP_REJECTED',
      'the bytes begin as XML, HTML or SVG; SVG is refused on every upload path including staff (SECURITY.md §7.2)',
    )
  }

  const sniffed = sniffMime(buffer)
  if (sniffed === null) {
    return no('UNRECOGNISED_FORMAT', 'no known magic-byte signature matched the first bytes')
  }

  if (!limits.mimeTypes.includes(sniffed)) {
    return no('TYPE_NOT_ALLOWED', `${sniffed} is not in the ${kind} allowlist`, sniffed)
  }

  if (declaredMime !== undefined && declaredMime !== '' && declaredMime !== sniffed) {
    /*
     * ONE TOLERATED DISAGREEMENT: a GLB may be declared `model/gltf+json`, because that is the type
     * a browser reports for a `.gltf` and some tools emit the binary container under it. The bytes
     * decide and both names describe the same acceptable thing.
     */
    const tolerated =
      kind === 'MODEL_3D' && sniffed === 'model/gltf-binary' && declaredMime === 'model/gltf+json'
    if (!tolerated) {
      return no(
        'DECLARED_TYPE_MISMATCH',
        `declared ${declaredMime} but the bytes are ${sniffed}`,
        sniffed,
      )
    }
  }

  if (size > limits.maxBytes) {
    return no(
      'TOO_LARGE',
      `${String(size)} bytes exceeds the ${kind} ceiling of ${String(limits.maxBytes)}`,
      sniffed,
    )
  }

  return ok(sniffed)
}

/**
 * The extra rules for a brand slot, on top of `validateUpload({ kind: 'BRAND' })`.
 *
 * DIMENSIONS ARE PASSED IN RATHER THAN READ HERE. Decoding an image to measure it needs `sharp`,
 * which is a Node-only dependency and would make this module impossible to unit-test without one.
 * The caller — `/studio/media/brand`'s action — has already decoded the file to build a preview, so
 * it knows the dimensions and hands them over. A slot with no size rule needs none.
 */
export function validateBrandUpload(input: {
  readonly slot: BrandSlot
  readonly buffer: Uint8Array
  readonly declaredMime?: string
  readonly dimensions?: { readonly width: number; readonly height: number }
}): UploadVerdict {
  const base = validateUpload({
    kind: 'BRAND',
    buffer: input.buffer,
    declaredMime: input.declaredMime,
  })
  if (!base.ok) return base

  const rules = BRAND_SLOTS[input.slot]
  const sniffed = base.sniffed ?? ''

  if (!(rules.mimeTypes as readonly string[]).includes(sniffed)) {
    return no(
      'BRAND_FORMAT',
      `${input.slot} accepts ${rules.describe}; the bytes are ${sniffed}`,
      sniffed,
    )
  }

  const size = input.dimensions
  if (size === undefined) return ok(sniffed)

  if ('exactSize' in rules) {
    const { width, height } = rules.exactSize
    if (size.width !== width || size.height !== height) {
      return no(
        'BRAND_WRONG_SIZE',
        `${input.slot} must be exactly ${String(width)} × ${String(height)}`,
        sniffed,
      )
    }
    return ok(sniffed)
  }

  const longEdge = Math.max(size.width, size.height)
  if (longEdge < rules.minLongEdge) {
    return no(
      'BRAND_TOO_SMALL',
      `${input.slot} needs at least ${String(rules.minLongEdge)} px on the long edge`,
      sniffed,
    )
  }

  return ok(sniffed)
}
