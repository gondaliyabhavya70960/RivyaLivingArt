import type { Signal } from './types'
import { clamp } from './types'

/**
 * Is this part of the market moving?
 * MATERIAL changes for the category in the last 90 days: 0 → 0; ≥ 10 → 100; linear between.
 * Coverage: ≥ 30 days of run history for the source — a source read for a week cannot have
 * observed a change, and zero would read as stillness rather than as absence.
 */
export const CHANGE_VELOCITY_SATURATION = 10
export const CHANGE_VELOCITY_MIN_HISTORY_DAYS = 30

export const changeVelocity: Signal = {
  key: 'change_velocity',
  describe: () => 'Is this part of the market moving?',
  inputs: () => ['research_changes (MATERIAL, 90 days) per category', 'research_runs per source'],
  normalise(row, context) {
    const history = context.runHistoryDaysBySource.get(row.sourceId) ?? null
    if (history === null || history < CHANGE_VELOCITY_MIN_HISTORY_DAYS) {
      return {
        included: false,
        rawInput: history === null ? 'no runs' : `${String(history)} days of history`,
        reason: 'insufficient_run_history',
      }
    }
    const count = context.materialChanges90dByCategory.get(row.matchedCategoryId ?? 'unmapped') ?? 0
    const value =
      count >= CHANGE_VELOCITY_SATURATION ? 100 : (100 * count) / CHANGE_VELOCITY_SATURATION
    return {
      included: true,
      rawInput: `${String(count)} material changes / 90 d`,
      normalised: clamp(value),
    }
  },
}
