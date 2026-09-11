import { type Bits64, type GrayImage, resizeArea } from './gray'

/**
 * pHash — the DCT perceptual hash. 64 bits, from a 32×32 reduction.
 *
 * The image is reduced to 32×32, transformed with a two-dimensional DCT-II, and the top-left 8×8
 * block of coefficients — the lowest spatial frequencies, the broad shapes of light and dark —
 * is kept. Each of those 64 coefficients becomes one bit: above the block's median or not. Fine
 * detail, noise, JPEG artefacts and mild crops live in the higher frequencies the block discards,
 * which is why a re-encode is a handful of bits away and a different photograph is about 32.
 *
 * THE DC TERM IS INCLUDED, as the reference implementations include it: it is always above the
 * median and contributes a constant `1`, so the effective hash is 63 bits. Excluding it would
 * change every stored hash for no gain in discrimination; keeping the convention keeps the
 * thresholds in `bands.ts` comparable to the literature they came from.
 *
 * Pure. The DCT is the naive O(n²) per dimension form on a 32-point signal — 32 × 32 × 32 × 2
 * multiplications, which is nothing, and legible.
 */
export const PHASH_SIZE = 32
export const PHASH_BLOCK = 8

const COS = buildCosTable(PHASH_SIZE)

function buildCosTable(n: number): Float64Array {
  const table = new Float64Array(n * n)
  for (let k = 0; k < n; k += 1) {
    for (let i = 0; i < n; i += 1) {
      table[k * n + i] = Math.cos(((2 * i + 1) * k * Math.PI) / (2 * n))
    }
  }
  return table
}

/** DCT-II of one 32-point signal, first `keep` coefficients. */
function dct1d(input: Float64Array, offset: number, stride: number, keep: number): Float64Array {
  const n = PHASH_SIZE
  const out = new Float64Array(keep)
  for (let k = 0; k < keep; k += 1) {
    let sum = 0
    for (let i = 0; i < n; i += 1) {
      sum += (input[offset + i * stride] ?? 0) * (COS[k * n + i] ?? 0)
    }
    out[k] = sum
  }
  return out
}

/** The top-left `PHASH_BLOCK × PHASH_BLOCK` DCT coefficients of the reduced image, row-major. */
export function lowFrequencies(image: GrayImage): Float64Array {
  const small = resizeArea(image, PHASH_SIZE, PHASH_SIZE)
  const pixels = new Float64Array(PHASH_SIZE * PHASH_SIZE)
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = small.data[i] ?? 0

  // Rows first: each of the 32 rows keeps its first 8 horizontal frequencies.
  const rows = new Float64Array(PHASH_SIZE * PHASH_BLOCK)
  for (let y = 0; y < PHASH_SIZE; y += 1) {
    const coefficients = dct1d(pixels, y * PHASH_SIZE, 1, PHASH_BLOCK)
    for (let k = 0; k < PHASH_BLOCK; k += 1) rows[y * PHASH_BLOCK + k] = coefficients[k] ?? 0
  }
  // Then columns: each of the 8 kept columns keeps its first 8 vertical frequencies.
  const block = new Float64Array(PHASH_BLOCK * PHASH_BLOCK)
  for (let x = 0; x < PHASH_BLOCK; x += 1) {
    const coefficients = dct1d(rows, x, PHASH_BLOCK, PHASH_BLOCK)
    for (let k = 0; k < PHASH_BLOCK; k += 1) block[k * PHASH_BLOCK + x] = coefficients[k] ?? 0
  }
  return block
}

export function phash(image: GrayImage): Bits64 {
  const block = lowFrequencies(image)
  const sorted = Array.from(block).sort((a, b) => a - b)
  const median = ((sorted[31] ?? 0) + (sorted[32] ?? 0)) / 2
  let bits = ''
  for (let i = 0; i < block.length; i += 1) bits += (block[i] ?? 0) > median ? '1' : '0'
  return bits
}
