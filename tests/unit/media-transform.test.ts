import { describe, expect, it } from 'vitest'

import {
  ALLOWED_FOLDERS,
  DisallowedFolderError,
  assertFolder,
  isAllowedFolder,
} from '@/lib/media/folders'
import {
  ASPECT_RATIOS,
  PRESETS,
  PRESET_MAP,
  UnsupportedRatioError,
  WIDTH_LADDER,
  clampDpr,
  heightFor,
  ratioCrop,
  resolveSpec,
  snapWidth,
  srcSet,
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

describe('srcSet', () => {
  it('offers up to 2× the box and no further', () => {
    // More rungs than that inflate the attribute on every page for a size no layout picks.
    const widths = srcSet(640)
    expect(widths[0]).toBe(640)
    expect(Math.max(...widths)).toBe(1280)
  })

  it('always offers at least one width', () => {
    expect(srcSet(1).length).toBeGreaterThan(0)
    expect(srcSet(4000).length).toBeGreaterThan(0)
  })

  it('returns rungs in ascending order, with no duplicates', () => {
    const widths = srcSet(480)
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
  it('is exactly the six the phase document fixes, under its own names', () => {
    // Named rather than counted: an earlier draft of transform.ts invented a different set, and
    // the miss that mattered was `og` — SECURITY.md §7.2 tells the owner what to supply for a
    // default social card by referring to "the Phase 06 `og` preset's output size".
    expect(Object.keys(PRESET_MAP).sort()).toEqual(
      ['card', 'grid', 'hero', 'hero-xl', 'og', 'thumb'].sort(),
    )
  })

  it('carries the widths PHASE-05-09.md §06 states, and og carries both dimensions', () => {
    expect(PRESETS.thumb.width).toBe(160)
    expect(PRESETS.card.width).toBe(480)
    expect(PRESETS.grid.width).toBe(768)
    expect(PRESETS.hero.width).toBe(1600)
    expect(PRESETS['hero-xl'].width).toBe(2560)
    // 1200 x 630 is an external specification, which is why it is the one preset with a height.
    expect(PRESETS.og.width).toBe(1200)
    expect(PRESETS.og.height).toBe(630)
  })

  it('pins the og format instead of negotiating it', () => {
    // A crawler's Accept header cannot be relied on, so f_auto could serve a WebP to a scraper
    // that wanted JPEG — a social card that silently does not render.
    expect(PRESETS.og.format).toBe('jpg')
    for (const name of ['thumb', 'card', 'grid', 'hero', 'hero-xl'] as const) {
      expect(PRESET_MAP[name].format, name).toBe('auto')
    }
  })

  it('spends eco quality only where quality is not noticed', () => {
    expect(PRESETS.thumb.quality).toBe('auto:eco')
    for (const name of ['card', 'grid', 'hero', 'hero-xl', 'og'] as const) {
      expect(PRESET_MAP[name].quality, name).toBe('auto:good')
    }
  })

  it('leaves the ratio to the slot, so one source is never cropped into desktop and mobile both', () => {
    // D6: desktop and mobile are separate CMS slots. A preset carrying a ratio would make the
    // component decide the crop, which is exactly the decision that belongs to the editor.
    for (const [name, spec] of Object.entries(PRESET_MAP)) {
      expect(spec.ratio, name).toBeUndefined()
    }
  })

  it('does not require preset widths to be rungs — three of the six are not', () => {
    // The two sets are independent, and an earlier draft wrongly tried to reconcile them. The
    // ladder is what a RESPONSIVE image offers the browser; a preset is one fixed delivery size
    // for a box that never negotiates.
    const offLadder = Object.entries(PRESET_MAP)
      .filter(([, spec]) => spec.width !== undefined && !WIDTH_LADDER.includes(spec.width as never))
      .map(([name]) => name)
    expect(offLadder.sort()).toEqual(['hero', 'og', 'thumb'])
  })

  it('delivers a preset at exactly its stated width, never snapped', () => {
    // The regression this guards: routing preset widths through snapWidth turned `hero` into 1920
    // and `thumb` into 320, so the preset delivered something other than its own table entry.
    for (const [name, spec] of Object.entries(PRESET_MAP)) {
      const resolved = resolveSpec(name as keyof typeof PRESET_MAP)
      expect(resolved.width, name).toBe(spec.width)
    }
  })

  it('lets a call site override without editing the preset', () => {
    expect(resolveSpec('card', { width: 320 })).toMatchObject({ width: 320, crop: 'fill' })
  })

  it('resolves a ratio override into concrete dimensions at the call site', () => {
    // Resolved here rather than in the provider so a bad ratio throws where it was asked for,
    // instead of producing a URL nobody checks. 1600 is kept, not snapped to 1920.
    expect(resolveSpec('hero', { ratio: '21:9' })).toMatchObject({ width: 1600, height: 686 })
  })

  it('throws on a bad ratio override too, not only through ratioCrop', () => {
    // @ts-expect-error -- the runtime guard behind the type
    expect(() => resolveSpec('hero', { ratio: '5:2' })).toThrow(UnsupportedRatioError)
  })
})

describe('the 2560 delivery cap, against the real canary sources', () => {
  // PHASE-05-09.md §06 verification step 4 asserts this of PROCESS-STUDIO-001 specifically. The
  // library masters run to 6336px wide and nobody needs 6336px of a hero; serving it is the
  // easiest single way to fail Core Web Vitals (CLOUDINARY.md §5).
  it.each([
    ['PROCESS-STUDIO-001', 4800],
    ['LARGEFORMAT-MONUMENTAL-001', 6336],
  ])('offers no candidate above 2560 for %s (%ipx source)', (_id, sourceWidth) => {
    for (const width of srcSet(sourceWidth)) {
      expect(width).toBeLessThanOrEqual(2560)
    }
    expect(snapWidth(sourceWidth)).toBe(2560)
  })

  it('still offers at least one candidate for a source far above the cap', () => {
    // The cap must not empty the srcset — a source wider than every rung still needs serving.
    expect(srcSet(6336).length).toBeGreaterThan(0)
  })
})

describe('ratioCrop', () => {
  it('snaps the width to a rung and derives the height', () => {
    expect(ratioCrop(700, '16:9')).toEqual({ width: 768, height: 432 })
    expect(ratioCrop(1024, '1:1')).toEqual({ width: 1024, height: 1024 })
  })

  it('accepts all eight D6 ratios and nothing else', () => {
    expect(ASPECT_RATIOS).toHaveLength(8)
    for (const ratio of ASPECT_RATIOS) {
      expect(() => ratioCrop(640, ratio), ratio).not.toThrow()
    }
  })

  it('throws on an unsupported ratio rather than falling back to the source shape', () => {
    // Silently keeping the source's shape produces an image that does not fill its box, which
    // reads as a CSS bug rather than as the bad argument it is.
    // @ts-expect-error -- the point of the test is the runtime guard behind the type
    expect(() => ratioCrop(640, '5:2')).toThrow(UnsupportedRatioError)
  })

  it('does not treat an inherited Object property as a supported ratio', () => {
    // `ratio in RATIO_VALUE` would accept 'toString' and then divide by undefined.
    // @ts-expect-error -- deliberately off-contract
    expect(() => ratioCrop(640, 'toString')).toThrow(UnsupportedRatioError)
  })
})
