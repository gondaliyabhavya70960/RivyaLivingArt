/**
 * The bands, the thresholds and — the column that matters — what each band does NOT mean.
 *
 * THIS IS THE SINGLE SOURCE. `SimilarityLegend` renders this table verbatim above the first
 * result, the run compares against these thresholds, the docs quote them, and a unit test asserts
 * every "does not mean" sentence reaches the screen. The band name never contains the word
 * "same": two identical photographs prove a shared image, not a shared object.
 *
 * THRESHOLDS ARE NOT PRECISION CLAIMS. `MEASURED_PRECISION` is empty until a person has labelled
 * the stratified sample `scripts/research/similarity-sample.ts` draws from THIS corpus; until
 * then the Studio renders `PRECISION_NOT_YET_MEASURED` beside the legend, and a test refuses an
 * entry that carries a figure without its sample size and date.
 */

export const SIMILARITY_BANDS = [
  'NEAR_DUPLICATE',
  'PROBABLE_VARIANT',
  'WEAK',
  'FORM_SIMILAR',
] as const
export type SimilarityBand = (typeof SIMILARITY_BANDS)[number]

export type SimilarityMethod = 'PHASH' | 'EMBEDDING'

export interface BandDefinition {
  readonly band: SimilarityBand
  readonly method: SimilarityMethod
  /** Inclusive Hamming range for PHASH bands; cosine floor for the embedding band. */
  readonly threshold: string
  readonly means: string
  readonly doesNotMean: string
}

export const BAND_DEFINITIONS: readonly BandDefinition[] = [
  {
    band: 'NEAR_DUPLICATE',
    method: 'PHASH',
    threshold: 'Hamming ≤ 6, including distance 0',
    means: 'the same image file, or a re-encode, resize or mild crop of it',
    doesNotMean:
      'that the two listings are the same physical object, or that either seller made it',
  },
  {
    band: 'PROBABLE_VARIANT',
    method: 'PHASH',
    threshold: 'Hamming 7–12',
    means: 'very likely the same photo shoot, set or listing family',
    doesNotMean: 'that the products are the same, or comparable in size or price',
  },
  {
    band: 'WEAK',
    method: 'PHASH',
    threshold: 'Hamming 13–18',
    means: 'similar composition, crop or palette',
    doesNotMean: 'anything at all about the object, its material or its maker',
  },
  {
    band: 'FORM_SIMILAR',
    method: 'EMBEDDING',
    threshold: 'cosine ≥ 0.86 (only with the advanced_similarity flag on)',
    means: 'similar visual form and material impression, at low precision',
    doesNotMean: 'similarity of design, dimensions, construction, or that one copies the other',
  },
]

/** pHash distances, inclusive. Beyond `WEAK_CEILING` a pair is discarded, not stored. */
export const NEAR_DUPLICATE_MAX = 6
export const PROBABLE_VARIANT_MAX = 12
export const WEAK_CEILING = 18
export const FORM_SIMILAR_COSINE_MIN = 0.86

export function bandForDistance(distance: number): SimilarityBand | null {
  if (!Number.isInteger(distance) || distance < 0) throw new RangeError('distance must be ≥ 0')
  if (distance <= NEAR_DUPLICATE_MAX) return 'NEAR_DUPLICATE'
  if (distance <= PROBABLE_VARIANT_MAX) return 'PROBABLE_VARIANT'
  if (distance <= WEAK_CEILING) return 'WEAK'
  return null
}

export const PRECISION_NOT_YET_MEASURED = 'PRECISION NOT YET MEASURED'

export interface MeasuredPrecision {
  readonly band: SimilarityBand
  /** 0–1, over the labelled sample. */
  readonly precision: number
  readonly sampleSize: number
  /** ISO date of the labelling. */
  readonly sampledOn: string
  readonly labelledBy: string
}

/**
 * EMPTY UNTIL MEASURED. A row here is a claim about this corpus, and the only honest way to add
 * one is to run `npm run research:similarity-sample`, label the CSV it writes, and transcribe the
 * count — with the size and the date, which the test below requires.
 */
export const MEASURED_PRECISION: readonly MeasuredPrecision[] = []

export function precisionFor(band: SimilarityBand): MeasuredPrecision | null {
  return MEASURED_PRECISION.find((entry) => entry.band === band) ?? null
}
