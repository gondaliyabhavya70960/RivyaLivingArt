import { describe, expect, it } from 'vitest'

import {
  ALL_STAFF_MIME_TYPES,
  BANNED_MIME_TYPES,
  UPLOAD_KINDS,
  UPLOAD_LIMITS,
  checkUploadRequest,
} from '@/lib/media/upload-limits'

const MB = 1024 * 1024

/**
 * SECURITY.md §7.1 and §7.2, as assertions.
 *
 * A table in prose is not a ceiling. These tests are what makes the numbers in `upload-limits.ts`
 * the same numbers as the ones in the security document — and, more usefully, what will fail if
 * somebody widens an allowlist without opening that document.
 */

describe('the SVG ban', () => {
  it('rejects SVG on every kind, including BRAND', () => {
    // §7.2: an SVG is XML the browser executes in the same origin, and a sanitiser must be right
    // forever. The ban is unconditional — the owner's own brand marks are not an exception, which
    // is exactly the case somebody would be tempted to carve out.
    for (const kind of UPLOAD_KINDS) {
      const rejection = checkUploadRequest(kind, 'image/svg+xml', 1024)
      expect(rejection?.reason, kind).toBe('banned-type')
    }
  })

  it('rejects the alternative spellings a server actually receives', () => {
    for (const spelling of BANNED_MIME_TYPES) {
      expect(checkUploadRequest('BRAND', spelling, 1024)?.reason, spelling).toBe('banned-type')
    }
  })

  it('is case- and whitespace-insensitive, because a browser is not a validator', () => {
    expect(checkUploadRequest('BRAND', '  IMAGE/SVG+XML ', 1024)?.reason).toBe('banned-type')
  })

  it('appears in no allowlist, so the ban is not the only thing keeping it out', () => {
    expect(ALL_STAFF_MIME_TYPES).not.toContain('image/svg+xml')
  })
})

describe('the per-kind allowlists', () => {
  it('matches SECURITY.md §7.1 exactly', () => {
    expect(UPLOAD_LIMITS.IMAGE.mimeTypes).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
    ])
    // MP4/H.264 only. Delivery re-encoding is Cloudinary's job, not the uploader's.
    expect(UPLOAD_LIMITS.VIDEO.mimeTypes).toEqual(['video/mp4'])
    expect(UPLOAD_LIMITS.MODEL_3D.mimeTypes).toEqual(['model/gltf-binary', 'model/gltf+json'])
    expect(UPLOAD_LIMITS.DOCUMENT.mimeTypes).toEqual(['application/pdf'])
    // §7.2's row, which deliberately differs from CLOUDINARY.md §4 — no SVG, ICO for the favicon.
    expect(UPLOAD_LIMITS.BRAND.mimeTypes).toEqual([
      'image/png',
      'image/jpeg',
      'image/vnd.microsoft.icon',
    ])
  })

  it('refuses WebM even though it is a perfectly good video container', () => {
    expect(checkUploadRequest('VIDEO', 'video/webm', 1024)?.reason).toBe('disallowed-type')
  })

  it('refuses a type that is allowed for a DIFFERENT kind', () => {
    // The check is per kind, not global: a PDF is fine as a DOCUMENT and wrong as a BRAND asset,
    // and a global allowlist would let the second through.
    expect(checkUploadRequest('DOCUMENT', 'application/pdf', 1024)).toBeNull()
    expect(checkUploadRequest('BRAND', 'application/pdf', 1024)?.reason).toBe('disallowed-type')
  })
})

describe('the byte ceilings', () => {
  it('matches SECURITY.md §7.1 exactly', () => {
    expect(UPLOAD_LIMITS.IMAGE.maxBytes).toBe(25 * MB)
    expect(UPLOAD_LIMITS.VIDEO.maxBytes).toBe(200 * MB)
    expect(UPLOAD_LIMITS.MODEL_3D.maxBytes).toBe(50 * MB)
    expect(UPLOAD_LIMITS.DOCUMENT.maxBytes).toBe(25 * MB)
    expect(UPLOAD_LIMITS.BRAND.maxBytes).toBe(5 * MB)
  })

  it('accepts exactly the ceiling and refuses one byte past it', () => {
    expect(checkUploadRequest('IMAGE', 'image/png', 25 * MB)).toBeNull()
    expect(checkUploadRequest('IMAGE', 'image/png', 25 * MB + 1)?.reason).toBe('too-large')
  })

  it('refuses a zero, negative or fractional size rather than signing for it', () => {
    // A zero-byte upload is a signature spent on nothing; a fractional one is a client that
    // computed a size rather than read one.
    for (const bytes of [0, -1, 1.5]) {
      expect(checkUploadRequest('IMAGE', 'image/png', bytes)?.reason, String(bytes)).toBe(
        'too-large',
      )
    }
  })
})

describe('resource types', () => {
  it('puts a GLB and a PDF in Cloudinary raw, not image', () => {
    // A model uploaded into the image namespace succeeds and is then unreachable, because
    // Cloudinary's resource types are separate namespaces rather than a hint.
    expect(UPLOAD_LIMITS.MODEL_3D.resourceType).toBe('raw')
    expect(UPLOAD_LIMITS.DOCUMENT.resourceType).toBe('raw')
    expect(UPLOAD_LIMITS.VIDEO.resourceType).toBe('video')
    expect(UPLOAD_LIMITS.IMAGE.resourceType).toBe('image')
    expect(UPLOAD_LIMITS.BRAND.resourceType).toBe('image')
  })

  it('covers every media_kind the database enum has', () => {
    // If Phase 07 or later adds a kind, this fails rather than letting an upload be signed
    // against `undefined` limits.
    expect([...UPLOAD_KINDS].sort()).toEqual(
      ['BRAND', 'DOCUMENT', 'IMAGE', 'MODEL_3D', 'VIDEO'].sort(),
    )
  })
})

describe('the order of the checks', () => {
  it('reports a banned type as banned even when it is also too large', () => {
    // The distinction is not cosmetic: a banned type is logged to the audit trail and a size
    // rejection is not, so reporting the wrong one loses the security signal.
    const rejection = checkUploadRequest('BRAND', 'image/svg+xml', 500 * MB)
    expect(rejection?.reason).toBe('banned-type')
  })
})
