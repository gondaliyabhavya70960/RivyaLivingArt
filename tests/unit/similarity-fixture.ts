import type { GrayImage } from '@/lib/scraper/analytics/similarity/gray'

/**
 * Synthetic photographs for the hasher tests — built in code so the fixture is the test's own
 * hand-written literal rather than a binary nobody can read.
 *
 * `scene()` draws a smooth gradient with a few soft blobs at fixed positions: broad structure at
 * low spatial frequency, which is what a perceptual hash keys on. `noise()` is the opposite: no
 * structure at all, so it should land about 32 bits from anything.
 */

export function scene(width: number, height: number, variant = 0): GrayImage {
  const data = new Uint8Array(width * height)
  const blobs = [
    { x: 0.3, y: 0.4, r: 0.18, v: 120 },
    { x: 0.7, y: 0.35, r: 0.12, v: -90 },
    { x: 0.55, y: 0.75, r: 0.2, v: 80 },
    { x: 0.15 + variant * 0.05, y: 0.8, r: 0.1, v: -60 },
  ]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width
      const v = y / height
      let value = 60 + 120 * u + 40 * v
      for (const blob of blobs) {
        const dx = (u - blob.x) / blob.r
        const dy = (v - blob.y) / blob.r
        value += blob.v * Math.exp(-(dx * dx + dy * dy))
      }
      data[y * width + x] = Math.max(0, Math.min(255, Math.round(value)))
    }
  }
  return { width, height, data }
}

/** Deterministic pseudo-random noise (a linear congruential generator, seeded). */
export function noise(width: number, height: number, seed = 7): GrayImage {
  const data = new Uint8Array(width * height)
  let state = seed >>> 0
  for (let i = 0; i < data.length; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    data[i] = state >>> 24
  }
  return { width, height, data }
}

/** Keep the central `fraction` of the image on each axis (0.9 = a 10 % crop). */
export function centreCrop(image: GrayImage, fraction: number): GrayImage {
  const width = Math.round(image.width * fraction)
  const height = Math.round(image.height * fraction)
  const x0 = Math.floor((image.width - width) / 2)
  const y0 = Math.floor((image.height - height) / 2)
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data[y * width + x] = image.data[(y0 + y) * image.width + (x0 + x)] ?? 0
    }
  }
  return { width, height, data }
}

/** Add ±`amplitude` deterministic noise, standing in for re-encoding artefacts. */
export function perturb(image: GrayImage, amplitude: number, seed = 11): GrayImage {
  const data = new Uint8Array(image.data.length)
  let state = seed >>> 0
  for (let i = 0; i < data.length; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const delta = ((state >>> 24) / 255) * 2 * amplitude - amplitude
    data[i] = Math.max(0, Math.min(255, Math.round((image.data[i] ?? 0) + delta)))
  }
  return { width: image.width, height: image.height, data }
}

/** Flip `count` distinct bits of a 64-bit string at seeded positions. */
export function flipBits(bits: string, count: number, seed: number): string {
  const chars = bits.split('')
  const positions = new Set<number>()
  let state = seed >>> 0
  while (positions.size < count) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    positions.add(state % 64)
  }
  for (const position of positions) chars[position] = chars[position] === '1' ? '0' : '1'
  return chars.join('')
}

export function randomBits(seed: number): string {
  let state = seed >>> 0
  let bits = ''
  for (let i = 0; i < 64; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    bits += state >>> 31 ? '1' : '0'
  }
  return bits
}
