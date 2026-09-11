import { z } from 'zod'

/**
 * The scoring model document — what `research_scoring_models.signals` holds, validated on read.
 *
 * WEIGHTS SUM TO 100, HERE AND IN THE DATABASE. The CHECK on `weights_total` refuses a row whose
 * declared total is not 100; this schema refuses a document whose weights do not add to the
 * declared total. Two checks because they catch different lies: a column somebody typed and a
 * document somebody edited.
 *
 * EVERY KEY NAMES A SIGNAL MODULE. `SIGNAL_KEYS` is the closed list, and a document naming an
 * eighth key is refused rather than scored as zero — an unknown signal contributing nothing would
 * silently lower every confidence in the corpus.
 */

export const SIGNAL_KEYS = [
  'category_gap',
  'large_format_fit',
  'price_band_gap',
  'assortment_density',
  'change_velocity',
  'customisation_signal',
  'material_adjacency',
] as const
export type SignalKey = (typeof SIGNAL_KEYS)[number]

export const signalDefinitionSchema = z
  .object({
    key: z.enum(SIGNAL_KEYS),
    weight: z.number().int().min(0).max(100),
    direction: z.literal('HIGHER_IS_BETTER'),
    normalisation: z.string().min(1),
    minimumCoverage: z.string().min(1),
  })
  .strict()
export type SignalDefinition = z.infer<typeof signalDefinitionSchema>

export const scoringModelDocumentSchema = z
  .array(signalDefinitionSchema)
  .min(1)
  .superRefine((signals, ctx) => {
    const keys = new Set(signals.map((signal) => signal.key))
    if (keys.size !== signals.length) {
      ctx.addIssue({ code: 'custom', message: 'a signal key appears twice' })
    }
    const total = signals.reduce((sum, signal) => sum + signal.weight, 0)
    if (total !== 100) {
      ctx.addIssue({ code: 'custom', message: `weights sum to ${String(total)}, not 100` })
    }
  })
export type ScoringModelDocument = z.infer<typeof scoringModelDocumentSchema>

export interface ScoringModel {
  readonly id: string
  readonly version: string
  readonly name: string
  readonly lifecycle: 'DRAFT' | 'ACTIVE' | 'RETIRED'
  readonly minConfidence: number
  readonly signals: ScoringModelDocument
}

/** The weight per key, for a model. Missing keys weigh 0 — a v2 may drop a signal. */
export function weightsOf(
  model: Pick<ScoringModel, 'signals'>,
): Readonly<Record<SignalKey, number>> {
  const out = Object.fromEntries(SIGNAL_KEYS.map((key) => [key, 0])) as Record<SignalKey, number>
  for (const signal of model.signals) out[signal.key] = signal.weight
  return out
}

/**
 * v1, as the TypeScript twin of `0302_phase32_model_v1.sql`. `tests/unit/opportunity-model.test.ts`
 * reads the migration and asserts the two agree key for key and weight for weight, so the seed
 * and the code cannot drift.
 */
export const MODEL_V1: ScoringModelDocument = [
  {
    key: 'category_gap',
    weight: 20,
    direction: 'HIGHER_IS_BETTER',
    normalisation:
      'published Rivya products in the mapped category: 0 → 100, ≥ 12 → 0, linear between',
    minimumCoverage: 'none — a first-party count is always knowable',
  },
  {
    key: 'large_format_fit',
    weight: 20,
    direction: 'HIGHER_IS_BETTER',
    normalisation:
      'SEED §56 ladder over (category, is_large_format); large → 100; the false column per category; unknown → excluded',
    minimumCoverage: 'is_large_format is not null and matched_category_id is not null',
  },
  {
    key: 'price_band_gap',
    weight: 15,
    direction: 'HIGHER_IS_BETTER',
    normalisation:
      "the row's Phase 31 band vs bands occupied by published Rivya products in the same currency: unoccupied → 100, adjacent → 50, occupied → 0",
    minimumCoverage:
      'price_state in (FIXED, STARTING_FROM) and ≥ 5 published Rivya products priced in that currency',
  },
  {
    key: 'assortment_density',
    weight: 15,
    direction: 'HIGHER_IS_BETTER',
    normalisation:
      'distinct sources listing something in the same category and band: 1 → 30, 2 → 60, ≥ 3 → 100',
    minimumCoverage: '≥ 3 enabled sources',
  },
  {
    key: 'change_velocity',
    weight: 10,
    direction: 'HIGHER_IS_BETTER',
    normalisation:
      'MATERIAL changes in the category in the last 90 days: 0 → 0, ≥ 10 → 100, linear between',
    minimumCoverage: '≥ 30 days of run history for the source',
  },
  {
    key: 'customisation_signal',
    weight: 10,
    direction: 'HIGHER_IS_BETTER',
    normalisation:
      "the customization key in the current version's normalised payload: true → 100, false → 0",
    minimumCoverage:
      "the source's attribute_extraction declares a customization key and the version carries it",
  },
  {
    key: 'material_adjacency',
    weight: 10,
    direction: 'HIGHER_IS_BETTER',
    normalisation:
      "share of the row's material tokens found in the materials vocabulary × 100, compared in application code",
    minimumCoverage: 'material_tokens is non-empty',
  },
]
