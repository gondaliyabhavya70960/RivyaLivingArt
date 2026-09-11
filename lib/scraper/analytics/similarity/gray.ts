/**
 * The pixel buffer every hasher takes.
 *
 * ONE GRAY CHANNEL, ROW-MAJOR, 0–255. The decode that produces it lives in `lib/media/hashes.ts`
 * (the only module that imports an image decoder); nothing under `lib/scraper/analytics/similarity/`
 * performs I/O, so a hash is a pure function of a buffer and the tests can hand-build one.
 */
export interface GrayImage {
  readonly width: number
  readonly height: number
  /** `width * height` bytes, row-major. */
  readonly data: Uint8Array
}

export function assertGrayImage(image: GrayImage): void {
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height)) {
    throw new TypeError('GrayImage dimensions must be integers')
  }
  if (image.width < 1 || image.height < 1) {
    throw new RangeError('GrayImage must be at least 1×1')
  }
  if (image.data.length !== image.width * image.height) {
    throw new RangeError(
      `GrayImage holds ${String(image.data.length)} bytes for ${String(image.width)}×${String(image.height)}`,
    )
  }
}

/**
 * Area-averaging resize (a box filter). Every source pixel contributes to exactly the target
 * cells it overlaps, weighted by the overlap — so a 4800-pixel-wide photograph and its
 * 800-pixel-wide re-encode reduce to nearly the same 32×32 grid, which is the whole reason a
 * perceptual hash survives a resize. Nearest-neighbour would not: it samples one pixel per cell
 * and a one-pixel shift changes a third of the bits.
 */
export function resizeArea(image: GrayImage, width: number, height: number): GrayImage {
  assertGrayImage(image)
  if (width < 1 || height < 1) throw new RangeError('target must be at least 1×1')
  const out = new Uint8Array(width * height)
  const sx = image.width / width
  const sy = image.height / height
  for (let ty = 0; ty < height; ty += 1) {
    const y0 = ty * sy
    const y1 = y0 + sy
    for (let tx = 0; tx < width; tx += 1) {
      const x0 = tx * sx
      const x1 = x0 + sx
      let sum = 0
      let weight = 0
      const yStart = Math.floor(y0)
      const yEnd = Math.min(image.height - 1, Math.ceil(y1) - 1)
      const xStart = Math.floor(x0)
      const xEnd = Math.min(image.width - 1, Math.ceil(x1) - 1)
      for (let y = yStart; y <= yEnd; y += 1) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0)
        if (wy <= 0) continue
        const row = y * image.width
        for (let x = xStart; x <= xEnd; x += 1) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0)
          if (wx <= 0) continue
          const w = wx * wy
          sum += (image.data[row + x] ?? 0) * w
          weight += w
        }
      }
      out[ty * width + tx] = weight === 0 ? 0 : Math.round(sum / weight)
    }
  }
  return { width, height, data: out }
}

/** A 64-character string of `0` and `1`, the literal form of a PostgreSQL `bit(64)`. */
export type Bits64 = string

export function assertBits64(value: string, name = 'hash'): void {
  if (value.length !== 64 || !/^[01]{64}$/u.test(value)) {
    throw new TypeError(`${name} must be 64 characters of 0 and 1`)
  }
}
