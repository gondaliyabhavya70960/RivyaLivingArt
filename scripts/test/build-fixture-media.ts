#!/usr/bin/env tsx
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'

import { FIXTURE_MEDIA } from '../../tests/fixtures/ids'

/**
 * `npm run test:build-fixture-media [-- --check]` — Phase 42.
 *
 * Twelve small images, committed, that stand in for the twelve manifest assets the fixture binds.
 * `tests/support/media-route.ts` serves them for every `res.cloudinary.com` request a browser test
 * makes, so no test run touches the network and no test run depends on what is currently uploaded.
 *
 * THEY ARE NOT THE PHOTOGRAPHS, and calling them stand-ins is not modesty — it is the design.
 *
 *   A visual snapshot is a promise that the page has not changed. If the bytes it compares came
 *   from Cloudinary, then re-encoding an asset, changing a delivery default or adding a crop would
 *   fail every snapshot in the suite with a diff nobody can read, about a change that is not in the
 *   diff under review. What these snapshots are FOR is layout: does the hero still fill the
 *   viewport, does the card grid still reflow at 390px, did a padding change move six things.
 *   A flat rectangle at the correct aspect ratio answers all of that, and a photograph answers it
 *   no better while breaking for reasons unrelated to the code.
 *
 * WHAT IS REAL ABOUT THEM: the aspect ratio, taken from the manifest, and the public id they answer
 * to. A fixture page requests exactly the URL the live page would, and gets back something exactly
 * the shape the live asset is — so a layout that only works because an image happened to be square
 * still fails here.
 *
 * WHY THE PNG IS HAND-WRITTEN RATHER THAN MADE WITH `sharp`. These files are COMMITTED, and the
 * point of committing them is that they never change unless somebody means it. `sharp` encodes
 * through libvips, whose output moves between versions — so a developer on a different machine
 * regenerating them would produce a diff of twelve binary files and no way to tell whether anything
 * meaningful changed. Written here as indexed-colour PNGs with STORED (uncompressed) deflate
 * blocks, the bytes are a pure function of the pixels: no compression heuristics, no version
 * sensitivity, the same output on every machine that will ever run this. That is worth the forty
 * lines below, and `--check` is what proves it stayed true.
 */

const OUT_DIR = join(process.cwd(), 'tests/fixtures/media')

/** The house palette, plus a near-white so an edge is visible against a pale page. */
const PALETTE: readonly [number, number, number][] = [
  [0x08, 0x28, 0x3a],
  [0x08, 0x0a, 0x0e],
  [0x16, 0x4e, 0x6b],
  [0xb8, 0x9b, 0x63],
  [0xf4, 0xf2, 0xed],
]

/** Widest edge of a generated file. Small enough to commit, large enough to scale cleanly. */
const MAX_WIDTH = 160

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let c = 0xffffffff
  for (const byte of buffer) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * An 8-bit indexed PNG.
 *
 * `level: 0` is the whole point: stored deflate blocks have no algorithmic choices to make, so the
 * output is identical on every zlib version anybody will run this on.
 */
function indexedPng(width: number, height: number, pixels: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8) // bit depth
  ihdr.writeUInt8(3, 9) // colour type: indexed
  ihdr.writeUInt8(0, 10) // compression
  ihdr.writeUInt8(0, 11) // filter
  ihdr.writeUInt8(0, 12) // interlace

  const plte = Buffer.from(PALETTE.flatMap(([r, g, b]) => [r, g, b]))

  // Each scanline is prefixed with filter type 0 (none) — nothing to reverse, nothing to differ.
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0
    for (let x = 0; x < width; x += 1) {
      raw[y * (width + 1) + 1 + x] = pixels[y * width + x] as number
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('IDAT', deflateSync(raw, { level: 0 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * The pattern for one asset: a ground, a horizontal band and a vertical stripe, all positioned from
 * a hash of the asset id.
 *
 * DISTINCT PER ASSET ON PURPOSE. A suite where every stand-in is the same grey rectangle cannot
 * catch the bug where a page renders the right number of images and the wrong ones.
 */
function pattern(assetId: string, width: number, height: number): Uint8Array {
  const digest = createHash('sha256').update(assetId).digest()
  const ground = (digest[0] as number) % PALETTE.length
  const band = (ground + 1 + ((digest[1] as number) % 3)) % PALETTE.length
  const stripe = (ground + 2 + ((digest[2] as number) % 2)) % PALETTE.length
  const stripeStart = Math.floor((((digest[3] as number) % 5) * width) / 8)
  const stripeWidth = Math.max(2, Math.floor(width / 6))

  const pixels = new Uint8Array(width * height).fill(ground)
  const bandTop = Math.floor(height / 3)
  const bandBottom = Math.floor((height * 2) / 3)
  for (let y = bandTop; y < bandBottom; y += 1) {
    for (let x = 0; x < width; x += 1) pixels[y * width + x] = band
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = stripeStart; x < Math.min(width, stripeStart + stripeWidth); x += 1) {
      pixels[y * width + x] = stripe
    }
  }
  return pixels
}

export interface Derivative {
  readonly file: string
  readonly width: number
  readonly height: number
  readonly bytes: Buffer
}

/** Every derivative, as bytes. Pure: the same input always produces the same output. */
export function buildDerivatives(): Derivative[] {
  return FIXTURE_MEDIA.map((asset) => {
    /*
     * SCALED FROM THE MANIFEST'S OWN DIMENSIONS rather than from a ratio string, so a 5504×3072
     * asset and a 2048×1152 one both land on the same 16:9 shape the page expects — and an asset
     * whose real dimensions are not quite its declared ratio produces a stand-in that is not quite
     * either, which is the honest thing for a layout test to see.
     */
    const scale = MAX_WIDTH / asset.width
    const width = MAX_WIDTH
    const height = Math.max(1, Math.round(asset.height * scale))
    return {
      file: asset.file,
      width,
      height,
      bytes: indexedPng(width, height, pattern(asset.assetId, width, height)),
    }
  })
}

function main(): void {
  const check = process.argv.slice(2).includes('--check')
  mkdirSync(OUT_DIR, { recursive: true })

  const drift: string[] = []
  for (const derivative of buildDerivatives()) {
    const path = join(OUT_DIR, derivative.file)
    if (check) {
      let current: Buffer
      try {
        current = readFileSync(path)
      } catch {
        drift.push(`${derivative.file} is missing`)
        continue
      }
      if (!current.equals(derivative.bytes)) drift.push(`${derivative.file} differs`)
      continue
    }
    writeFileSync(path, derivative.bytes)
  }

  if (check) {
    if (drift.length > 0) {
      console.error(`✗ fixture media: ${String(drift.length)} file(s) not as generated:\n`)
      for (const line of drift) console.error(`    ${line}`)
      console.error(
        '\n  These are committed so a visual snapshot never moves for a reason outside the diff.\n' +
          '  Run `npm run test:build-fixture-media` and commit the result, or restore the files.',
      )
      process.exit(1)
    }
    console.log(`✓ fixture media: ${String(FIXTURE_MEDIA.length)} derivative(s) byte-identical`)
    return
  }

  console.log(
    `✓ fixture media: wrote ${String(FIXTURE_MEDIA.length)} derivative(s) to tests/fixtures/media/`,
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
