import type { ScoringModel, SignalKey } from './model'
import { weightsOf } from './model'

/**
 * The model diff: two versions side by side, weight by weight, and how many rows would move by
 * more than ten places if the draft replaced the active model.
 *
 * RE-WEIGHTED FROM STORED COMPONENTS, NOT RECOMPUTED FROM THE CORPUS. The normalisation rules live
 * in code and are the same for every version; a version differs from another only in its weights
 * and its confidence floor. So the diff takes each product's latest component rows — the
 * normalised values the active model produced — and re-weights them under both documents. That is
 * exactly what activating the draft would do to the ranking, and it costs no scan.
 */

export interface StoredComponents {
  readonly productId: string
  readonly completeness: number
  readonly components: readonly {
    readonly signalKey: SignalKey
    readonly normalised: number | null
  }[]
}

export interface WeightDiffRow {
  readonly key: SignalKey
  readonly from: number
  readonly to: number
}

export interface RankMovement {
  readonly weights: readonly WeightDiffRow[]
  readonly ranked: number
  readonly movedMoreThan: number
  readonly threshold: number
}

export const RANK_MOVEMENT_THRESHOLD = 10

function rankUnder(
  rows: readonly StoredComponents[],
  model: Pick<ScoringModel, 'signals' | 'minConfidence'>,
): ReadonlyMap<string, number> {
  const weights = weightsOf(model)
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  const scored = rows.flatMap((row) => {
    const included = row.components.filter(
      (component) => component.normalised !== null && weights[component.signalKey] > 0,
    )
    const includedWeight = included.reduce(
      (sum, component) => sum + weights[component.signalKey],
      0,
    )
    if (includedWeight === 0) return []
    const confidence = totalWeight === 0 ? 0 : includedWeight / totalWeight
    if (confidence < model.minConfidence) return []
    const weighted = included.reduce(
      (sum, component) => sum + weights[component.signalKey] * (component.normalised ?? 0),
      0,
    )
    const raw = weighted / includedWeight
    const score = Math.round(raw * (0.6 + 0.4 * row.completeness))
    return [{ productId: row.productId, score }]
  })
  scored.sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId))
  return new Map(scored.map((entry, index) => [entry.productId, index + 1]))
}

export function rankMovement(
  rows: readonly StoredComponents[],
  from: Pick<ScoringModel, 'signals' | 'minConfidence'>,
  to: Pick<ScoringModel, 'signals' | 'minConfidence'>,
  threshold = RANK_MOVEMENT_THRESHOLD,
): RankMovement {
  const before = rankUnder(rows, from)
  const after = rankUnder(rows, to)
  let moved = 0
  for (const [productId, rank] of before) {
    const next = after.get(productId)
    // A row that leaves the ranking (or joins it) has moved by more than any threshold.
    if (next === undefined || Math.abs(next - rank) > threshold) moved += 1
  }
  for (const productId of after.keys()) if (!before.has(productId)) moved += 1
  const wFrom = weightsOf(from)
  const wTo = weightsOf(to)
  return {
    weights: (Object.keys(wFrom) as SignalKey[]).map((key) => ({
      key,
      from: wFrom[key],
      to: wTo[key],
    })),
    ranked: before.size,
    movedMoreThan: moved,
    threshold,
  }
}
