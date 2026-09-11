import { createHash } from 'node:crypto'

import { dhash } from '@/lib/scraper/analytics/similarity/dhash'
import type { GrayImage } from '@/lib/scraper/analytics/similarity/gray'
import { phash } from '@/lib/scraper/analytics/similarity/phash'

/**
 * Hashing Rivya's OWN media — Phase 33's first-party half.
 *
 * THE ONLY MODULE THAT IMPORTS AN IMAGE DECODER. `scripts/media/check-decoder-scope.mjs` fails the
 * build if `sharp` is imported anywhere else, so the place bytes are decoded is one place, and it
 * is this one: it never fetches, never writes a file, and returns nothing derived from the pixels
 * except the two 64-bit hashes. The decoded buffer exists inside one call and is released.
 *
 * VIDEO IS CHECKSUM ONLY. A perceptual hash over an 8×8 / 32×32 gray reduction is defined for a
 * still image; one frame of a video called "the video's hash" would be a fabricated measurement.
 * A video row carries its SHA-256 and null hashes, and the duplicate guard catches a re-uploaded
 * video only by exact bytes — which it says, rather than implying a coverage it does not have.
 *
 * `sharp` is loaded lazily: it ships with Next as a native module, and a unit test that only needs
 * `sha256Hex` should not pay for it.
 */

export type HashKind = 'IMAGE' | 'VIDEO'

export interface ImageHashes {
  readonly kind: 'IMAGE'
  readonly checksum: string
  readonly phash: string
  readonly dhash: string
}

export interface VideoHashes {
  readonly kind: 'VIDEO'
  readonly checksum: string
  readonly phash: null
  readonly dhash: null
}

export type MediaHashes = ImageHashes | VideoHashes

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** SHA-256 of a stream, without holding the body: a 200 MB video is hashed at a constant cost. */
export async function sha256OfStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const hash = createHash('sha256')
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    hash.update(value)
  }
  return hash.digest('hex')
}

/** Decode any raster the library accepts into one gray channel. The one place `sharp` is used. */
export async function decodeGray(bytes: Uint8Array): Promise<GrayImage> {
  const { default: sharp } = await import('sharp')
  const { data, info } = await sharp(bytes)
    // Honour EXIF orientation, so a rotated re-upload hashes like the original it came from.
    .rotate()
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels !== 1) {
    throw new Error(`expected one gray channel, decoded ${String(info.channels)}`)
  }
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}

export async function hashImageBytes(bytes: Uint8Array): Promise<ImageHashes> {
  const gray = await decodeGray(bytes)
  return { kind: 'IMAGE', checksum: sha256Hex(bytes), phash: phash(gray), dhash: dhash(gray) }
}

export function hashVideoBytes(bytes: Uint8Array): VideoHashes {
  return { kind: 'VIDEO', checksum: sha256Hex(bytes), phash: null, dhash: null }
}

export async function hashMediaBytes(kind: HashKind, bytes: Uint8Array): Promise<MediaHashes> {
  return kind === 'IMAGE' ? hashImageBytes(bytes) : hashVideoBytes(bytes)
}
