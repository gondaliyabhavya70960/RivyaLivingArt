import { NEAR_DUPLICATE_MAX, WEAK_CEILING } from './bands'
import { assertBits64, type Bits64 } from './gray'
import { hamming } from './hamming'

/**
 * Blocking — how a run avoids comparing every hash with every other hash.
 *
 * THE RULE: the 64 bits are cut into seven segments (six of nine bits, one of ten). Two hashes are
 * candidates if they are IDENTICAL in at least one segment. By the pigeonhole principle a pair at
 * Hamming distance d <= 6 differs in at most six segments, so at least one of the seven is shared,
 * and EVERY NEAR_DUPLICATE PAIR IS A CANDIDATE — recall 1.0 for that band, by construction rather
 * than by luck. The test in `tests/unit/similarity-blocking.test.ts` measures it against a brute
 * force sweep over 2,000 hashes and prints the figure for every band.
 *
 * THE TRADE-OFF, WRITTEN DOWN: for 7 <= d <= 12 (PROBABLE_VARIANT) and 13 <= d <= 18 (WEAK) a
 * pair is a candidate only if its differing bits happen to leave one segment untouched. Seven
 * segments make that likely but not certain, and the measured recall for those bands is reported
 * by the same test — a scheme that silently loses pairs is worse than a slow one, so the loss is
 * a number, not a hope.
 *
 * WHY NOT THE PHASE DOCUMENT'S 16-BIT PREFIX. A single prefix bucket misses any pair whose six
 * differing bits include one of the first sixteen: for uniformly placed flips that is most of
 * them (about 83 percent at d = 6), which cannot meet the >= 0.98 recall the same document
 * requires. The segment scheme is the standard multi-index answer to exactly that problem. The
 * DDL keeps the `substring(phash from 1 for 16)` index the document names, harmlessly; the
 * comparison happens here, in memory, over a corpus of 64-bit strings.
 */
export const SEGMENTS: readonly (readonly [start: number, end: number])[] = [
  [0, 9],
  [9, 18],
  [18, 27],
  [27, 36],
  [36, 45],
  [45, 54],
  [54, 64],
]

export interface HashEntry {
  readonly id: string
  readonly phash: Bits64
}

export interface CandidatePair {
  readonly leftId: string
  readonly rightId: string
  readonly distance: number
}

function orderPair(a: HashEntry, b: HashEntry): readonly [HashEntry, HashEntry] {
  return a.id < b.id ? [a, b] : [b, a]
}

/**
 * Every pair of entries sharing at least one segment, with its Hamming distance, filtered to the
 * inclusive ceiling. `leftId < rightId` always, so a mirrored pair cannot be produced — the same
 * rule `research_similarity_pairs_ordered` enforces at the table.
 */
export function candidatePairs(
  entries: readonly HashEntry[],
  ceiling: number = WEAK_CEILING,
): CandidatePair[] {
  return blockPairs(entries, ceiling).pairs
}

export interface BlockedComparison {
  readonly pairs: CandidatePair[]
  /** Distinct pairs whose distance was computed — the run's `pairs_considered`. */
  readonly considered: number
}

/** `candidatePairs` with the count of comparisons the blocking rule actually made. */
export function blockPairs(
  entries: readonly HashEntry[],
  ceiling: number = WEAK_CEILING,
): BlockedComparison {
  for (const entry of entries) assertBits64(entry.phash, `phash of ${entry.id}`)
  const seen = new Set<string>()
  const pairs: CandidatePair[] = []
  for (const [start, end] of SEGMENTS) {
    const buckets = new Map<string, HashEntry[]>()
    for (const entry of entries) {
      const key = entry.phash.slice(start, end)
      const bucket = buckets.get(key)
      if (bucket === undefined) buckets.set(key, [entry])
      else bucket.push(entry)
    }
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) {
          const a = bucket[i]
          const b = bucket[j]
          if (a === undefined || b === undefined || a.id === b.id) continue
          const [left, right] = orderPair(a, b)
          const key = `${left.id} ${right.id}`
          if (seen.has(key)) continue
          seen.add(key)
          const distance = hamming(left.phash, right.phash)
          if (distance <= ceiling) pairs.push({ leftId: left.id, rightId: right.id, distance })
        }
      }
    }
  }
  pairs.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.leftId.localeCompare(b.leftId) ||
      a.rightId.localeCompare(b.rightId),
  )
  return { pairs, considered: seen.size }
}

/** The unblocked sweep, for measuring recall. O(n²); never used by a run. */
export function bruteForcePairs(
  entries: readonly HashEntry[],
  ceiling: number = WEAK_CEILING,
): CandidatePair[] {
  const pairs: CandidatePair[] = []
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i]
      const b = entries[j]
      if (a === undefined || b === undefined) continue
      const [left, right] = orderPair(a, b)
      const distance = hamming(left.phash, right.phash)
      if (distance <= ceiling) pairs.push({ leftId: left.id, rightId: right.id, distance })
    }
  }
  return pairs
}

/** True when every pair at distance <= `NEAR_DUPLICATE_MAX` must share a segment. */
export function guaranteesNearDuplicateRecall(): boolean {
  return SEGMENTS.length > NEAR_DUPLICATE_MAX
}
