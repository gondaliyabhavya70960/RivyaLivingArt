import { describe, expect, it } from 'vitest'

import {
  checkMediaAgainstResearch,
  decideDuplicate,
  type KnownHash,
} from '@/lib/media/duplicate-guard'
import { hashVideoBytes, sha256Hex, sha256OfStream } from '@/lib/media/hashes'

import { flipBits, randomBits } from './similarity-fixture'

/**
 * The guard's decision, with rows handed to it: exact matches outrank near ones, Rivya's own
 * library outranks the research corpus, a video is caught by checksum only, and the verdict names
 * what it matched. The reads are injected, so nothing here touches a database and the module
 * under test imports no repository.
 */

const CHECKSUM_A = 'a'.repeat(64)
const CHECKSUM_B = 'b'.repeat(64)
const PHASH_A = randomBits(1)

const RIVYA: readonly KnownHash[] = [
  { id: 'asset-1', checksum: CHECKSUM_A, phash: PHASH_A, label: 'PROCESS-STUDIO-001' },
  { id: 'asset-2', checksum: 'c'.repeat(64), phash: null, label: 'LARGEFORMAT-DINING-004' },
]
const RESEARCH: readonly KnownHash[] = [
  { id: 'hash-9', checksum: CHECKSUM_B, phash: flipBits(PHASH_A, 20, 3), label: 'acme-decor' },
]

describe('decideDuplicate', () => {
  it('accepts an image unlike anything on either side', () => {
    const verdict = decideDuplicate(
      { checksum: 'd'.repeat(64), phash: randomBits(77) },
      RIVYA,
      RESEARCH,
    )
    expect(verdict).toEqual({ ok: true })
  })

  it('refuses a byte-identical Rivya asset and names it', () => {
    const verdict = decideDuplicate({ checksum: CHECKSUM_A, phash: randomBits(5) }, RIVYA, RESEARCH)
    expect(verdict).toMatchObject({
      ok: false,
      code: 'EXACT_RIVYA',
      matchId: 'asset-1',
      label: 'PROCESS-STUDIO-001',
      distance: 0,
    })
  })

  it('refuses a byte-identical research image and names the source', () => {
    const verdict = decideDuplicate({ checksum: CHECKSUM_B, phash: randomBits(5) }, RIVYA, RESEARCH)
    expect(verdict).toMatchObject({ ok: false, code: 'EXACT_RESEARCH', label: 'acme-decor' })
  })

  it('refuses a near duplicate (≤ 6 bits) of a Rivya asset, and accepts one 7 bits away', () => {
    const near = decideDuplicate(
      { checksum: 'e'.repeat(64), phash: flipBits(PHASH_A, 6, 9) },
      RIVYA,
      RESEARCH,
    )
    expect(near).toMatchObject({
      ok: false,
      code: 'NEAR_DUPLICATE_RIVYA',
      matchId: 'asset-1',
      distance: 6,
    })
    const far = decideDuplicate(
      { checksum: 'e'.repeat(64), phash: flipBits(PHASH_A, 7, 9) },
      RIVYA,
      RESEARCH,
    )
    expect(far).toEqual({ ok: true })
  })

  it('refuses a near duplicate of a research image', () => {
    const research = RESEARCH[0]
    if (research === undefined || research.phash === null) throw new Error('fixture')
    const verdict = decideDuplicate(
      { checksum: 'e'.repeat(64), phash: flipBits(research.phash, 3, 4) },
      RIVYA,
      RESEARCH,
    )
    expect(verdict).toMatchObject({
      ok: false,
      code: 'NEAR_DUPLICATE_RESEARCH',
      matchId: 'hash-9',
      distance: 3,
    })
  })

  it('an exact match anywhere outranks a near match on the Rivya side', () => {
    const verdict = decideDuplicate(
      { checksum: CHECKSUM_B, phash: flipBits(PHASH_A, 1, 2) },
      RIVYA,
      RESEARCH,
    )
    expect(verdict).toMatchObject({ ok: false, code: 'EXACT_RESEARCH' })
  })

  it('a video (no pHash) is caught only by exact checksum', () => {
    expect(
      decideDuplicate({ checksum: 'c'.repeat(64), phash: null }, RIVYA, RESEARCH),
    ).toMatchObject({ ok: false, code: 'EXACT_RIVYA', matchId: 'asset-2' })
    expect(decideDuplicate({ checksum: 'f'.repeat(64), phash: null }, RIVYA, RESEARCH)).toEqual({
      ok: true,
    })
  })
})

describe('checkMediaAgainstResearch', () => {
  it('performs the two reads and nothing else', async () => {
    const calls: string[] = []
    const verdict = await checkMediaAgainstResearch(
      { checksum: CHECKSUM_A, phash: null },
      {
        rivya: async () => {
          calls.push('rivya')
          return RIVYA
        },
        research: async () => {
          calls.push('research')
          return RESEARCH
        },
      },
    )
    expect(calls.sort()).toEqual(['research', 'rivya'])
    expect(verdict).toMatchObject({ ok: false, code: 'EXACT_RIVYA' })
  })
})

describe('the first-party hasher, without a decoder', () => {
  it('a video carries a checksum and null hashes', () => {
    const bytes = new TextEncoder().encode('not really an mp4')
    expect(hashVideoBytes(bytes)).toEqual({
      kind: 'VIDEO',
      checksum: sha256Hex(bytes),
      phash: null,
      dhash: null,
    })
  })

  it('the streaming checksum equals the buffered one', async () => {
    const bytes = new TextEncoder().encode('a'.repeat(100_000))
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += 4096) {
          controller.enqueue(bytes.slice(offset, offset + 4096))
        }
        controller.close()
      },
    })
    expect(await sha256OfStream(stream)).toBe(sha256Hex(bytes))
  })
})
