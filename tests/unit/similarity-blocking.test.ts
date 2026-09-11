import { describe, expect, it } from 'vitest'

import { NEAR_DUPLICATE_MAX, bandForDistance } from '@/lib/scraper/analytics/similarity/bands'
import {
  SEGMENTS,
  bruteForcePairs,
  candidatePairs,
  guaranteesNearDuplicateRecall,
  type HashEntry,
} from '@/lib/scraper/analytics/similarity/blocking'

import { flipBits, randomBits } from './similarity-fixture'

/**
 * Blocking recall, MEASURED against brute force over a 2,000-hash fixture (phase document, risk
 * table): 1,000 unrelated hashes plus 1,000 perturbations at every distance from 1 to 24, so every
 * band is populated and pairs beyond the ceiling exist to be discarded.
 *
 * The NEAR_DUPLICATE recall must be exactly 1 — the segment rule guarantees it by the pigeonhole
 * principle — and the figures for the other two bands are printed so the documented trade-off is
 * a number this run produced, not a hope.
 */

function fixture(): HashEntry[] {
  const entries: HashEntry[] = []
  for (let i = 0; i < 1000; i += 1) {
    const base = randomBits(1000 + i)
    entries.push({ id: `base-${String(i).padStart(4, '0')}`, phash: base })
    const distance = (i % 24) + 1
    entries.push({
      id: `pert-${String(i).padStart(4, '0')}`,
      phash: flipBits(base, distance, 5000 + i),
    })
  }
  return entries
}

describe('segment blocking', () => {
  it('cuts the 64 bits into seven contiguous segments covering every bit once', () => {
    expect(SEGMENTS).toHaveLength(7)
    let cursor = 0
    for (const [start, end] of SEGMENTS) {
      expect(start).toBe(cursor)
      expect(end).toBeGreaterThan(start)
      cursor = end
    }
    expect(cursor).toBe(64)
    expect(guaranteesNearDuplicateRecall()).toBe(true)
  })

  it('never emits a mirrored or self pair, and orders left < right', () => {
    const pairs = candidatePairs(fixture())
    const seen = new Set<string>()
    for (const pair of pairs) {
      expect(pair.leftId < pair.rightId).toBe(true)
      const key = `${pair.leftId} ${pair.rightId}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('recall against brute force: 1.0 for NEAR_DUPLICATE, measured for the rest', () => {
    const entries = fixture()
    const truth = bruteForcePairs(entries)
    const found = candidatePairs(entries)
    const foundKeys = new Set(found.map((pair) => `${pair.leftId} ${pair.rightId}`))

    const perBand = new Map<string, { truth: number; found: number }>()
    for (const pair of truth) {
      const band = bandForDistance(pair.distance) ?? 'DISCARDED'
      const tally = perBand.get(band) ?? { truth: 0, found: 0 }
      tally.truth += 1
      if (foundKeys.has(`${pair.leftId} ${pair.rightId}`)) tally.found += 1
      perBand.set(band, tally)
    }

    const near = perBand.get('NEAR_DUPLICATE')
    expect(near).toBeDefined()
    expect(near?.truth ?? 0).toBeGreaterThanOrEqual(200)
    expect((near?.found ?? 0) / (near?.truth ?? 1)).toBe(1)

    // Nothing beyond the ceiling is ever returned by either sweep.
    expect(truth.every((pair) => pair.distance <= 18)).toBe(true)
    expect(found.every((pair) => pair.distance <= 18)).toBe(true)
    expect(perBand.has('DISCARDED')).toBe(false)

    // Every blocked pair is a true pair (precision of the candidate set is 1 by construction —
    // the distance is computed, not guessed).
    const truthKeys = new Set(truth.map((pair) => `${pair.leftId} ${pair.rightId}`))
    for (const pair of found) expect(truthKeys.has(`${pair.leftId} ${pair.rightId}`)).toBe(true)

    const report = [...perBand.entries()]
      .map(
        ([band, tally]) =>
          `${band}: ${String(tally.found)}/${String(tally.truth)} = ${(tally.found / tally.truth).toFixed(3)}`,
      )
      .join('; ')
    console.log(`blocking recall over ${String(entries.length)} hashes — ${report}`)

    // The documented trade-off: PROBABLE_VARIANT recall is high but not guaranteed; WEAK lower.
    const variant = perBand.get('PROBABLE_VARIANT')
    expect((variant?.found ?? 0) / (variant?.truth ?? 1)).toBeGreaterThanOrEqual(0.9)
  })

  it('a pair at exactly the near-duplicate ceiling is always a candidate', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const base = randomBits(seed)
      const pair: HashEntry[] = [
        { id: 'a', phash: base },
        { id: 'b', phash: flipBits(base, NEAR_DUPLICATE_MAX, 900 + seed) },
      ]
      expect(candidatePairs(pair)).toHaveLength(1)
    }
  })

  it('refuses a malformed hash by name', () => {
    expect(() => candidatePairs([{ id: 'x', phash: '01' }])).toThrow(/phash of x/u)
  })
})
