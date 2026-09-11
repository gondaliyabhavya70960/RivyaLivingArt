import { bandForDistance, type SimilarityBand } from '@/lib/scraper/analytics/similarity/bands'
import { blockPairs } from '@/lib/scraper/analytics/similarity/blocking'

/**
 * The library library check — Rivya's hashed assets compared with each other. Pure: it takes the
 * rows and returns the pairs; the Studio action and `npm run research:similarity -- --scope=media`
 * both call it, and a run row records its counts. Nothing here stores a pair: the pairs table
 * holds research hashes on both sides, and a Rivya-versus-Rivya pair has nowhere to live.
 *
 * WHAT A PAIR HERE MEANS: two assets that are the same picture, a re-crop of one shoot, or a
 * render registered twice — a housekeeping fact about the library. It is not, and the screen
 * does not say, anything about what the pictures depict.
 */

export interface LibraryHashRow {
  readonly id: string
  readonly label: string
  readonly kind: 'IMAGE' | 'VIDEO'
  readonly checksum: string
  readonly phash: string | null
}

export interface LibraryPair {
  readonly leftId: string
  readonly rightId: string
  readonly leftLabel: string
  readonly rightLabel: string
  /** null for a byte-identical video pair, which has no perceptual distance. */
  readonly distance: number | null
  readonly band: SimilarityBand
  readonly exact: boolean
}

export interface LibraryCheck {
  readonly hashed: number
  readonly compared: number
  readonly exact: number
  readonly pairs: readonly LibraryPair[]
}

export function libraryCheck(rows: readonly LibraryHashRow[]): LibraryCheck {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const images = rows.filter((row): row is LibraryHashRow & { phash: string } => row.phash !== null)
  const blocked = blockPairs(images.map((row) => ({ id: row.id, phash: row.phash })))

  const pairs: LibraryPair[] = []
  const seen = new Set<string>()
  const checksumOf = (id: string): string => byId.get(id)?.checksum ?? ''
  const labelOf = (id: string): string => byId.get(id)?.label ?? id

  for (const pair of blocked.pairs) {
    const band = bandForDistance(pair.distance)
    if (band === null) continue
    seen.add(`${pair.leftId} ${pair.rightId}`)
    pairs.push({
      leftId: pair.leftId,
      rightId: pair.rightId,
      leftLabel: labelOf(pair.leftId),
      rightLabel: labelOf(pair.rightId),
      distance: pair.distance,
      band,
      exact: checksumOf(pair.leftId) === checksumOf(pair.rightId),
    })
  }

  // Byte-identical pairs the perceptual sweep could not see: videos, which carry no pHash.
  const byChecksum = new Map<string, LibraryHashRow[]>()
  for (const row of rows) {
    const group = byChecksum.get(row.checksum)
    if (group === undefined) byChecksum.set(row.checksum, [row])
    else group.push(row)
  }
  for (const group of byChecksum.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id))
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const left = sorted[i]
        const right = sorted[j]
        if (left === undefined || right === undefined) continue
        const key = `${left.id} ${right.id}`
        if (seen.has(key)) continue
        seen.add(key)
        pairs.push({
          leftId: left.id,
          rightId: right.id,
          leftLabel: left.label,
          rightLabel: right.label,
          distance: left.phash !== null && right.phash !== null ? 0 : null,
          band: 'NEAR_DUPLICATE',
          exact: true,
        })
      }
    }
  }

  pairs.sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      (a.distance ?? -1) - (b.distance ?? -1) ||
      a.leftLabel.localeCompare(b.leftLabel),
  )
  return {
    hashed: images.length,
    compared: blocked.considered,
    exact: pairs.filter((pair) => pair.exact).length,
    pairs,
  }
}
