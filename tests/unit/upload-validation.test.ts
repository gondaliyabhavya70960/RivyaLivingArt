import { describe, expect, it } from 'vitest'

import {
  BRAND_SLOTS,
  looksLikeMarkup,
  sniffMime,
  validateBrandUpload,
  validateUpload,
} from '@/lib/media/validate-upload'

/**
 * UPLOAD VALIDATION AGAINST THE BYTES — Phase 41, tested in Phase 42.
 *
 * EVERY CASE HERE IS A LIE SOMEBODY COULD TELL. A declared MIME type is a string the client chose;
 * so is an extension. What this module trusts is the first few bytes, and these tests are the
 * catalogue of what happens when the bytes and the claim disagree.
 *
 * THE BUFFERS ARE HEADERS, NOT FILES. A valid PNG signature followed by nothing is exactly what the
 * validator reads — it inspects a prefix by design (SECURITY §7.3), so a fixture that were a real
 * image would test nothing the header does not.
 */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const MP4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])
const SVG = new TextEncoder().encode(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">',
)
const HTML = new TextEncoder().encode('<!DOCTYPE html><html><body>hello')

describe('sniffing', () => {
  it('recognises the formats the product accepts', () => {
    expect(sniffMime(PNG)).toBe('image/png')
    expect(sniffMime(JPEG)).toBe('image/jpeg')
    expect(sniffMime(PDF)).toBe('application/pdf')
    expect(sniffMime(MP4)).toBe('video/mp4')
  })

  it('returns null for bytes it does not know, rather than guessing', () => {
    // Null must mean UNRECOGNISED and the caller must refuse. An allowlist that fell open on an
    // unknown signature would accept anything nobody had thought of.
    expect(sniffMime(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull()
    expect(sniffMime(new Uint8Array())).toBeNull()
  })
})

describe('markup', () => {
  it('sees SVG, XML and HTML by CONTENT, because none has magic bytes', () => {
    expect(looksLikeMarkup(SVG)).toBe(true)
    expect(looksLikeMarkup(HTML)).toBe(true)
  })

  it('does not mistake a raster image for markup', () => {
    expect(looksLikeMarkup(PNG)).toBe(false)
    expect(looksLikeMarkup(JPEG)).toBe(false)
  })
})

describe('validateUpload', () => {
  it('accepts a PNG as an image', () => {
    expect(validateUpload({ kind: 'IMAGE', buffer: PNG, declaredMime: 'image/png' })).toMatchObject(
      {
        ok: true,
        sniffed: 'image/png',
      },
    )
  })

  it('refuses an empty file before anything else', () => {
    expect(validateUpload({ kind: 'IMAGE', buffer: new Uint8Array() })).toMatchObject({
      ok: false,
      reason: 'EMPTY',
    })
  })

  it('refuses SVG on the IMAGE path', () => {
    expect(validateUpload({ kind: 'IMAGE', buffer: SVG })).toMatchObject({
      ok: false,
      reason: 'MARKUP_REJECTED',
    })
  })

  it('refuses SVG on the BRAND path too — the ban is unconditional', () => {
    /*
     * THE BRAND PATH IS THE ONE SOMEBODY WILL ARGUE ABOUT, because a logo is exactly the file a
     * designer hands over as SVG. An SVG is XML the browser executes in the same origin; a
     * sanitiser must be right forever. The answer is a PNG export at 2×, and `/studio/media/brand`
     * says so before a file is chosen.
     */
    expect(validateUpload({ kind: 'BRAND', buffer: SVG })).toMatchObject({
      ok: false,
      reason: 'MARKUP_REJECTED',
    })
  })

  it('refuses markup BEFORE the allowlist, so a polyglot cannot pass', () => {
    /*
     * A FILE THAT OPENS AS MARKUP AND ALSO CARRIES RASTER BYTES must be refused as markup. The
     * ordering is what decides it: `looksLikeMarkup` runs before the sniff, so a document that a
     * browser would parse as XML is refused whatever else is inside it. Checking the allowlist
     * first would accept exactly the file this ordering exists to stop.
     */
    const polyglot = new Uint8Array([...SVG, ...PNG])
    expect(validateUpload({ kind: 'IMAGE', buffer: polyglot })).toMatchObject({
      ok: false,
      reason: 'MARKUP_REJECTED',
    })
  })

  it('refuses an unrecognised signature rather than accepting it', () => {
    expect(
      validateUpload({ kind: 'IMAGE', buffer: new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9]) }),
    ).toMatchObject({ ok: false, reason: 'UNRECOGNISED_FORMAT' })
  })

  it('refuses a type that is real but not on this kind’s allowlist', () => {
    // A PDF is a legitimate DOCUMENT and is not an image.
    expect(validateUpload({ kind: 'IMAGE', buffer: PDF })).toMatchObject({
      ok: false,
      reason: 'TYPE_NOT_ALLOWED',
      sniffed: 'application/pdf',
    })
  })

  it('refuses a declared type that disagrees with the bytes, separately from "not allowed"', () => {
    /*
     * TWO DIFFERENT FACTS, TWO DIFFERENT CODES. "The product does not take this" and "the client is
     * lying or the browser guessed badly" send whoever is debugging to different places.
     */
    expect(
      validateUpload({ kind: 'IMAGE', buffer: PNG, declaredMime: 'image/jpeg' }),
    ).toMatchObject({ ok: false, reason: 'DECLARED_TYPE_MISMATCH' })
  })

  it('ignores a missing declared type rather than refusing', () => {
    expect(validateUpload({ kind: 'IMAGE', buffer: PNG })).toMatchObject({ ok: true })
    expect(validateUpload({ kind: 'IMAGE', buffer: PNG, declaredMime: '' })).toMatchObject({
      ok: true,
    })
  })

  it('refuses on size LAST, so an unacceptable type is refused for what it is', () => {
    const verdict = validateUpload({ kind: 'IMAGE', buffer: PDF, byteLength: 10 ** 9 })
    // Huge AND the wrong type: the answer names the type, because that is the useful half.
    expect(verdict.reason).toBe('TYPE_NOT_ALLOWED')
  })

  it('takes the real length from `byteLength` when the buffer is only a prefix', () => {
    /*
     * THE PROPERTY THE SAVE PATH DEPENDS ON. A 200 MB video is never pulled into memory: the action
     * reads 4 kB and passes the length the delivery origin reported. Without this the ceiling would
     * be measured against the prefix and every file would look tiny.
     */
    expect(validateUpload({ kind: 'IMAGE', buffer: PNG, byteLength: 10 ** 9 })).toMatchObject({
      ok: false,
      reason: 'TOO_LARGE',
    })
    expect(validateUpload({ kind: 'IMAGE', buffer: PNG, byteLength: 1000 })).toMatchObject({
      ok: true,
    })
  })

  it('treats a zero reported length as empty even when the prefix is not', () => {
    expect(validateUpload({ kind: 'IMAGE', buffer: PNG, byteLength: 0 })).toMatchObject({
      ok: false,
      reason: 'EMPTY',
    })
  })
})

describe('brand slots', () => {
  it('name no SVG anywhere', () => {
    // The panel on /studio/media/brand renders these strings. If one said SVG the page would
    // promise a format the validator refuses.
    for (const slot of Object.values(BRAND_SLOTS)) {
      expect(slot.mimeTypes).not.toContain('image/svg+xml')
      expect(slot.describe.toLowerCase()).not.toContain('svg')
    }
  })

  it('refuses a logo below the minimum long edge', () => {
    expect(
      validateBrandUpload({ slot: 'logo', buffer: PNG, dimensions: { width: 400, height: 400 } }),
    ).toMatchObject({ ok: false, reason: 'BRAND_TOO_SMALL' })
    expect(
      validateBrandUpload({ slot: 'logo', buffer: PNG, dimensions: { width: 2048, height: 1024 } }),
    ).toMatchObject({ ok: true })
  })

  it('requires the OG asset at exactly 1200 × 630', () => {
    // The Phase 06 `og` preset outputs that size; anything else is letterboxed or cropped by a
    // social platform in a way nobody controls.
    expect(
      validateBrandUpload({ slot: 'og', buffer: PNG, dimensions: { width: 1200, height: 630 } }),
    ).toMatchObject({ ok: true })
    expect(
      validateBrandUpload({ slot: 'og', buffer: PNG, dimensions: { width: 1200, height: 628 } }),
    ).toMatchObject({ ok: false, reason: 'BRAND_WRONG_SIZE' })
  })

  it('refuses a JPEG logo, because a logo needs transparency', () => {
    expect(
      validateBrandUpload({
        slot: 'logo',
        buffer: JPEG,
        dimensions: { width: 2048, height: 1024 },
      }),
    ).toMatchObject({ ok: false, reason: 'BRAND_FORMAT' })
  })
})
