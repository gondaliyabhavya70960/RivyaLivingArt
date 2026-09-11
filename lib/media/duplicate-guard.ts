import { NEAR_DUPLICATE_MAX } from '@/lib/scraper/analytics/similarity/bands'
import { hamming } from '@/lib/scraper/analytics/similarity/hamming'

/**
 * The upload duplicate guard — Phase 33's one automatic consequence, and it only ever PREVENTS.
 *
 * `checkMediaAgainstResearch()` takes the hashes of an incoming upload and two READS: Rivya's own
 * hash table and the research hash table. It compares in TypeScript and returns a verdict. It
 * inserts nothing, joins nothing, and holds no import from either repository — the Studio action
 * injects the reads, so this module stays free of the research boundary (I1, I3) and a unit test
 * can hand it rows.
 *
 * ORDER OF CHECKS. An exact checksum match on either side first (a byte-identical file, image or
 * video); then, for an image, a pHash within the NEAR_DUPLICATE ceiling. A verdict names what it
 * matched — the existing Rivya asset id, or the research source — so the refusal on screen is a
 * fact and not a shrug.
 *
 * WHAT A REFUSAL MEANS, AND DOES NOT. A NEAR_DUPLICATE says "this picture is already here", not
 * "this object is". The guard refuses because re-registering a manifest asset as new photography
 * would give one image two identities, and because a competitor's photograph must never become
 * Rivya media (BR-F1, BR-F4). It says nothing about who made anything.
 */

export interface KnownHash {
  readonly id: string
  readonly checksum: string
  readonly phash: string | null
  /** What a refusal names: a Rivya asset id, or a research source slug. */
  readonly label: string
}

export interface UploadHashes {
  readonly checksum: string
  readonly phash: string | null
}

export type GuardCode =
  'EXACT_RIVYA' | 'NEAR_DUPLICATE_RIVYA' | 'EXACT_RESEARCH' | 'NEAR_DUPLICATE_RESEARCH'

export type GuardVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly code: GuardCode
      readonly matchId: string
      readonly label: string
      readonly distance: number
    }

interface Nearest {
  readonly exact: KnownHash | null
  readonly near: { readonly row: KnownHash; readonly distance: number } | null
}

function nearest(candidate: UploadHashes, rows: readonly KnownHash[]): Nearest {
  let exact: KnownHash | null = null
  let near: { row: KnownHash; distance: number } | null = null
  for (const row of rows) {
    if (row.checksum === candidate.checksum) {
      exact ??= row
      continue
    }
    if (candidate.phash === null || row.phash === null) continue
    const distance = hamming(candidate.phash, row.phash)
    if (distance <= NEAR_DUPLICATE_MAX && (near === null || distance < near.distance)) {
      near = { row, distance }
    }
  }
  return { exact, near }
}

function refuse(code: GuardCode, row: KnownHash, distance: number): GuardVerdict {
  return { ok: false, code, matchId: row.id, label: row.label, distance }
}

/** Pure. Exact matches on either side outrank near ones; Rivya's own library is checked first. */
export function decideDuplicate(
  candidate: UploadHashes,
  rivya: readonly KnownHash[],
  research: readonly KnownHash[],
): GuardVerdict {
  const own = nearest(candidate, rivya)
  if (own.exact !== null) return refuse('EXACT_RIVYA', own.exact, 0)
  const theirs = nearest(candidate, research)
  if (theirs.exact !== null) return refuse('EXACT_RESEARCH', theirs.exact, 0)
  if (own.near !== null) return refuse('NEAR_DUPLICATE_RIVYA', own.near.row, own.near.distance)
  if (theirs.near !== null) {
    return refuse('NEAR_DUPLICATE_RESEARCH', theirs.near.row, theirs.near.distance)
  }
  return { ok: true }
}

export interface GuardReads {
  readonly rivya: () => Promise<readonly KnownHash[]>
  readonly research: () => Promise<readonly KnownHash[]>
}

/** Two reads, one comparison, no write. */
export async function checkMediaAgainstResearch(
  candidate: UploadHashes,
  reads: GuardReads,
): Promise<GuardVerdict> {
  const [rivya, research] = await Promise.all([reads.rivya(), reads.research()])
  return decideDuplicate(candidate, rivya, research)
}
