import { completeness as completenessOf } from './completeness'
import type { ScoringContext, ScoringRow } from './context'
import { SIGNAL_KEYS, weightsOf, type ScoringModel, type SignalKey } from './model'
import { SIGNALS } from './signals'

/**
 * THE FORMULA — implemented once, here, and printed verbatim in docs/architecture/SCRAPER.md §23.
 *
 * included   = signals whose coverage requirement is met
 * raw        = Σ(weight_i × normalised_i) / Σ(weight_i)          for i in included
 * confidence = Σ(weight_i) / Σ(weight_all)
 * completeness = share of Phase 28 required fields present on the row
 * score      = round(raw × (0.6 + 0.4 × completeness))
 * state      = confidence < 0.5  →  INSUFFICIENT_DATA   (score is stored but never ranked)
 *
 * NO I/O. The context is gathered by the repository; this function is a fixture table.
 * THE UI NEVER RECOMPUTES: it renders the component rows this function produced, so what a person
 * sees is what the database stored, and `opportunity-score.test.ts` asserts the components sum to
 * the stored score.
 */

export interface ScoredComponent {
  readonly signalKey: SignalKey
  readonly rawInput: string | null
  readonly normalised: number | null
  readonly weight: number
  readonly contribution: number | null
  readonly included: boolean
  readonly exclusionReason: string | null
}

export type ScoreState = 'SCORED' | 'INSUFFICIENT_DATA'

export interface ScoreResult {
  readonly raw: number | null
  readonly confidence: number
  readonly completeness: number
  readonly score: number | null
  readonly state: ScoreState
  readonly components: readonly ScoredComponent[]
}

export function scoreRow(
  row: ScoringRow,
  context: ScoringContext,
  model: ScoringModel,
): ScoreResult {
  const weights = weightsOf(model)
  const totalWeight = SIGNAL_KEYS.reduce((sum, key) => sum + weights[key], 0)

  const components: ScoredComponent[] = SIGNAL_KEYS.map((key) => {
    const weight = weights[key]
    const outcome = SIGNALS[key].normalise(row, context)
    if (!outcome.included) {
      return {
        signalKey: key,
        rawInput: outcome.rawInput,
        normalised: null,
        weight,
        contribution: null,
        included: false,
        exclusionReason: outcome.reason,
      }
    }
    return {
      signalKey: key,
      rawInput: outcome.rawInput,
      normalised: outcome.normalised,
      weight,
      // contribution = weight × normalised / 100, three decimals: the "points" this signal adds
      // to a 0–100 total before the included-weight division and the completeness multiplier.
      contribution: Math.round(weight * outcome.normalised) / 100,
      included: true,
      exclusionReason: null,
    }
  })

  const included = components.filter((component) => component.included && component.weight > 0)
  const includedWeight = included.reduce((sum, component) => sum + component.weight, 0)
  const confidence =
    totalWeight === 0 ? 0 : Math.round((includedWeight / totalWeight) * 1000) / 1000
  const complete = completenessOf(row)

  if (includedWeight === 0) {
    return {
      raw: null,
      confidence,
      completeness: complete,
      score: null,
      state: 'INSUFFICIENT_DATA',
      components,
    }
  }

  const weighted = included.reduce(
    (sum, component) => sum + component.weight * (component.normalised ?? 0),
    0,
  )
  const raw = Math.round((weighted / includedWeight) * 100) / 100
  const score = Math.round(raw * (0.6 + 0.4 * complete))
  const state: ScoreState = confidence < model.minConfidence ? 'INSUFFICIENT_DATA' : 'SCORED'
  return { raw, confidence, completeness: complete, score, state, components }
}

/**
 * Reproduce a stored score from its stored components — what the drawer's footer and the
 * `--explain` CLI print, so a reader can check the arithmetic against the total.
 */
export function totalFromComponents(
  components: readonly Pick<ScoredComponent, 'weight' | 'normalised' | 'included'>[],
  completenessValue: number,
): number | null {
  const included = components.filter(
    (component) => component.included && component.normalised !== null,
  )
  const includedWeight = included.reduce((sum, component) => sum + component.weight, 0)
  if (includedWeight === 0) return null
  const weighted = included.reduce(
    (sum, component) => sum + component.weight * (component.normalised ?? 0),
    0,
  )
  const raw = Math.round((weighted / includedWeight) * 100) / 100
  return Math.round(raw * (0.6 + 0.4 * completenessValue))
}
