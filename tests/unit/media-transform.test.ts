import { describe, expect, it } from 'vitest'

import {
  ALLOWED_FOLDERS,
  DisallowedFolderError,
  assertFolder,
  isAllowedFolder,
} from '@/lib/media/folders'
import {
  PRESETS,
  WIDTH_LADDER,
  clampDpr,
  heightFor,
  resolveSpec,
  snapWidth,
  srcSetWidths,
} from '@/lib/media/transform'

/**
 * The media layer's two jobs: never sign an upload to somewhere it should not go, and never ask
 * the CDN for a size nothing will use.
 *
 * The folder tests matter more. `assertFolder` runs BEFORE a signature is produced, and the
 * signature is what makes an upload possible — so a hole here is not "an odd folder name", it is a
 * signed write to an arbitrary path in the Cloudinary account.
 */

describe('the folder allowlist', () => {
  it('accepts every folder the manifest actually uses', () => {
    for (const folder of ALLOWED_FOLDERS) {
      expect(isAllowedFolder(folder), folder).toBe(true)
    }
  })

  it('accepts a product folder minted from a slug', () => {
    expect(isAllowedFolder('rivya/product/walnut-river-table')).toBe(true)
    expect(isAllowedFolder('rivya/product/x1')).toBe(true)
  })

  it('refuses a traversal out of the account prefix', () => {
    // The pattern admits only lower-case, digits and single hyphens, so `..` cannot appear at all.
    for (const hostile of [
      'rivya/product/../../secrets',
      'rivya/product/..',
      '../rivya/material',
      '/etc/passwd',
      'rivya/material/../../other-account',
    ]) {
      expect(isAllowedFolder(hostile), hostile).toBe(false)
    }
  })

  it('refuses a folder that merely starts like an allowed one', () => {
    // `startsWith` on its own would let all of these through.
    for (const hostile of [
      'rivya/materials',
      'rivya/material-2',
      'rivya/materialX',
      'rivya/product',
      'rivya/productX/thing',
    ]) {
      expect(isAllowedFolder(hostile), hostile).toBe(false)
    }
  })

  it('refuses a product folder with a deeper path', () => {
    // One folder per product, not a tree — otherwise the reserved prefix becomes a free-for-all.
    expect(isAllowedFolder('rivya/product/table/nested')).toBe(false)
  })

  it('refuses shapes a slug can never take', () => {
    for (const hostile of [
      'rivya/product/',
      'rivya/product/Upper-Case',
      'rivya/product/trailing-',
      'rivya/product/-leading',
      'rivya/product/double--hyphen',
      'rivya/product/has space',
      'rivya/product/has.dot',
    ]) {
      expect(isAllowedFolder(hostile), hostile).toBe(false)
    }
  })

  it('refuses an empty string', () => {
    expect(isAllowedFolder('')).toBe(false)
  })

  it('throws a named error, so the sign endpoint can answer 400 rather than 500', () => {
    expect(() => assertFolder('rivya/nope')).toThrow(DisallowedFolderError)
    expect(() => assertFolder('rivya/material')).not.toThrow()
  })
})

describe('the width ladder', () => {
  it('snaps UP, so an image is never scaled past its delivered size', () => {
    expect(snapWidth(300)).toBe(320)
    expect(snapWidth(321)).toBe(480)
    expect(snapWidth(640)).toBe(640)
  })

  it('brackets every FEAT §45 QA width with a rung at or above it', () => {
    // The reason the rungs are what they are. A QA width served by a smaller rung is a soft image
    // at exactly the size somebody is reviewing.
    for (const qa of [360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
      expect(snapWidth(qa), `${qa}px`).toBeGreaterThanOrEqual(qa)
    }
  })

  it('stops at the top rung rather than inventing a derivation', () => {
    expect(snapWidth(4000)).toBe(2560)
  })

  it('survives nonsense instead of producing a negative width', () => {
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(WIDTH_LADDER).toContain(snapWidth(bad))
    }
  })
})

describe('srcSetWidths', () => {
  it('offers up to 2× the box and no further', () => {
    // More rungs than that inflate the attribute on every page for a size no layout picks.
    const widths = srcSetWidths(640)
    expect(widths[0]).toBe(640)
    expect(Math.max(...widths)).toBe(1280)
  })

  it('always offers at least one width', () => {
    expect(srcSetWidths(1).length).toBeGreaterThan(0)
    expect(srcSetWidths(4000).length).toBeGreaterThan(0)
  })

  it('returns rungs in ascending order, with no duplicates', () => {
    const widths = srcSetWidths(480)
    expect([...widths].sort((a, b) => a - b)).toEqual(widths)
    expect(new Set(widths).size).toBe(widths.length)
  })
})

describe('clampDpr', () => {
  it('caps at 3, because 4× costs 78% more pixels for no visible gain', () => {
    expect(clampDpr(4)).toBe(3)
    expect(clampDpr(10)).toBe(3)
  })

  it('never goes below 1', () => {
    expect(clampDpr(0)).toBe(1)
    expect(clampDpr(-2)).toBe(1)
  })

  it('treats a missing or unusable value as 1 rather than as an error', () => {
    expect(clampDpr(undefined)).toBe(1)
    expect(clampDpr(Number.NaN)).toBe(1)
  })

  it('keeps the half-steps real devices report', () => {
    expect(clampDpr(1.5)).toBe(1.5)
    expect(clampDpr(2)).toBe(2)
  })
})

describe('heightFor', () => {
  it('derives the height a D6 ratio implies', () => {
    expect(heightFor(1920, '16:9')).toBe(1080)
    expect(heightFor(1000, '1:1')).toBe(1000)
    expect(heightFor(640, '4:5')).toBe(800)
    expect(heightFor(1080, '9:16')).toBe(1920)
  })
})

describe('presets', () => {
  it('names every ratio it uses from the D6 set', () => {
    const d6 = ['21:9', '16:9', '4:3', '3:2', '1:1', '4:5', '3:4', '9:16']
    for (const [name, spec] of Object.entries(PRESETS)) {
      if (spec.ratio === undefined) continue
      expect(d6, name).toContain(spec.ratio)
    }
  })

  it('asks for a width that is already a rung', () => {
    // A preset that snapped would mean the named size and the delivered size differ silently.
    for (const [name, spec] of Object.entries(PRESETS)) {
      if (spec.width === undefined) continue
      expect(WIDTH_LADDER, name).toContain(spec.width)
    }
  })

  it('lets a call site override without editing the preset', () => {
    expect(resolveSpec('card', { width: 320 })).toMatchObject({ width: 320, ratio: '4:5' })
  })

  it("keeps the editorial preset uncropped, so a photographer's shape survives", () => {
    expect(PRESETS.editorial.crop).toBe('fit')
    expect(PRESETS.editorial).not.toHaveProperty('ratio')
  })
})
