import { describe, expect, it } from 'vitest'

import {
  boxFitsSource,
  cropFor,
  cropSegment,
  cropsByRatio,
  ratioDrift,
  type MediaCropRow,
} from '@/lib/media/crop'

/**
 * THE CROP RESOLVER — Phase 43, tested in Phase 42.
 *
 * The whole module is arithmetic and string building, and every assertion here is about a property
 * that would be invisible if it broke: a crop delivered in the wrong order, a box that Cloudinary
 * would clamp silently, a ratio quietly substituted for a nearby one.
 */

const box = (over: Partial<MediaCropRow> = {}): MediaCropRow => ({
  aspect_ratio: '9:16',
  x: 100,
  y: 50,
  width: 900,
  height: 1600,
  gravity: null,
  ...over,
})

const gravity = (over: Partial<MediaCropRow> = {}): MediaCropRow => ({
  aspect_ratio: '4:5',
  x: null,
  y: null,
  width: null,
  height: null,
  gravity: 'auto',
  ...over,
})

describe('cropSegment', () => {
  it('builds a c_crop from an explicit box', () => {
    expect(cropSegment(box())).toBe('c_crop,h_1600,w_900,x_100,y_50')
  })

  it('builds a c_crop from a gravity, and includes the ratio', () => {
    /*
     * `ar_` IS REQUIRED ON THE GRAVITY FORM. A gravity crop with no dimensions asks Cloudinary to
     * crop to nothing; the ratio is what gives it a shape. The box form states its shape in w/h and
     * must NOT carry `ar_`, which would be a second, conflicting answer.
     */
    expect(cropSegment(gravity())).toBe('ar_4:5,c_crop,g_auto')
    expect(cropSegment(box())).not.toContain('ar_')
  })

  it('sorts its parameters, so one crop is always one CDN cache entry', () => {
    const parts = cropSegment(box())?.split(',') ?? []
    expect([...parts].sort()).toEqual(parts)
  })

  it('returns null when the row describes nothing', () => {
    /*
     * NULL, NOT A CENTRE CROP. A caller that gets null delivers the master uncropped, which is the
     * honest answer: no editor chose anything for this ratio. A guessed default would put a
     * decision nobody made in front of a visitor and make the missing row invisible.
     */
    expect(cropSegment({ ...gravity(), gravity: null })).toBeNull()
    expect(cropSegment({ ...gravity(), gravity: '' })).toBeNull()
  })

  it('needs all four numbers before it treats a row as a box', () => {
    // A partial box would name pixels that mean nothing; the database refuses one and so does this.
    expect(cropSegment({ ...box(), x: null })).toBeNull()
  })
})

describe('boxFitsSource', () => {
  const source = { width: 1200, height: 1700 }

  it('accepts a box inside the source', () => {
    expect(boxFitsSource(box(), source)).toBe(true)
  })

  it('refuses a box that runs off the right or the bottom', () => {
    expect(boxFitsSource(box({ x: 400 }), source)).toBe(false)
    expect(boxFitsSource(box({ y: 400 }), source)).toBe(false)
  })

  it('refuses a negative origin and a zero-area box', () => {
    expect(boxFitsSource(box({ x: -1 }), source)).toBe(false)
    expect(boxFitsSource(box({ width: 0 }), source)).toBe(false)
  })

  it('accepts a box that exactly fills the source', () => {
    expect(boxFitsSource(box({ x: 0, y: 0, width: 1200, height: 1700 }), source)).toBe(true)
  })

  it('says yes for a gravity crop, which has no box to fall outside of', () => {
    // Cloudinary computes a gravity crop against the real source; there is nothing here to check.
    expect(boxFitsSource(gravity(), source)).toBe(true)
  })
})

describe('ratioDrift', () => {
  it('is zero for a box that matches its declared ratio', () => {
    expect(ratioDrift(box(), '9:16')).toBe(0)
  })

  it('is large for a box filed under the wrong ratio', () => {
    expect(ratioDrift(box(), '16:9')).toBeGreaterThan(0.5)
  })

  it('is null when there is no box to measure', () => {
    expect(ratioDrift(gravity(), '4:5')).toBeNull()
  })
})

describe('cropsByRatio and cropFor', () => {
  it('indexes by the ratio a renderer asks for', () => {
    const crops = cropsByRatio([box(), gravity()])
    expect(cropFor(crops, '9:16')).toMatchObject({ width: 900 })
    expect(cropFor(crops, '4:5')).toMatchObject({ gravity: 'auto' })
  })

  it('does NOT substitute a nearby ratio', () => {
    /*
     * A 4:5 crop is not a 9:16 crop with rounding — it is a different decision about what may be
     * cut. Quietly substituting one would deliver a subject the editor never approved for that
     * shape, while the Studio showed the ratio as uncovered.
     */
    const crops = cropsByRatio([gravity()])
    expect(cropFor(crops, '3:4')).toBeUndefined()
    expect(cropFor(crops, '9:16')).toBeUndefined()
  })
})
