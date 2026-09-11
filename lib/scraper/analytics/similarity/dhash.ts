import { type Bits64, type GrayImage, resizeArea } from './gray'

/**
 * dHash — the difference hash. 64 bits, from a 9×8 reduction.
 *
 * Each row of nine pixels yields eight bits: is the pixel brighter than its right-hand
 * neighbour? Gradients survive resizing, re-encoding and mild brightness changes, so two copies of
 * one photograph agree on almost every bit; two different photographs agree on about half of
 * them, which is what a random 64-bit string does.
 *
 * Pure: takes the gray buffer, returns the bit string. No I/O anywhere in this directory.
 */
export const DHASH_WIDTH = 9
export const DHASH_HEIGHT = 8

export function dhash(image: GrayImage): Bits64 {
  const small = resizeArea(image, DHASH_WIDTH, DHASH_HEIGHT)
  let bits = ''
  for (let y = 0; y < DHASH_HEIGHT; y += 1) {
    const row = y * DHASH_WIDTH
    for (let x = 0; x < DHASH_WIDTH - 1; x += 1) {
      bits += (small.data[row + x] ?? 0) > (small.data[row + x + 1] ?? 0) ? '1' : '0'
    }
  }
  return bits
}
