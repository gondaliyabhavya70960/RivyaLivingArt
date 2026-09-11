import type { ScoringContext, ScoringRow } from '../context'
import type { SignalKey } from '../model'

/**
 * One signal: a question, an input, a normalisation to 0–100, and a coverage requirement.
 *
 * `normalise` RETURNS EITHER A VALUE OR A NAMED EXCLUSION, never a default. Excluded is not zero:
 * a signal whose coverage is unmet contributes nothing and lowers confidence, and the reason is
 * stored on the component row so the drawer can say why.
 */
export type SignalOutcome =
  | { readonly included: true; readonly rawInput: string; readonly normalised: number }
  | { readonly included: false; readonly rawInput: string | null; readonly reason: string }

export interface Signal {
  readonly key: SignalKey
  /** The question, in one sentence, for the drawer. */
  describe(): string
  /** Which inputs it reads, for the docs. */
  inputs(): readonly string[]
  normalise(row: ScoringRow, context: ScoringContext): SignalOutcome
}

/** Clamp and round to two decimals, so a stored normalised value is always 0–100. */
export const clamp = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(value * 100) / 100))
