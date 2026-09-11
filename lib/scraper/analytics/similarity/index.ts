/**
 * Perceptual similarity — Phase 33, the first-party half.
 *
 * WHAT IS HERE: pure hashers over a gray buffer, the Hamming distance, the band table with its
 * "does not mean" column, and the blocking rule with its measured recall. None of it performs I/O.
 *
 * WHAT IS NOT HERE, BY THE OWNER'S DECISION (amendment A33): a fetcher for competitor images.
 * `research_products.image_urls` stays a list of URLs that are referenced and never downloaded;
 * `research_image_hashes` exists as a table and holds no rows; `research_image_hashing` and
 * `advanced_similarity` ship `false` with descriptions that say so. The machinery is turned inward
 * instead: `lib/media/hashes.ts` hashes Rivya's own library, and `lib/media/duplicate-guard.ts`
 * refuses an upload that is already a Rivya asset.
 */
export {
  BAND_DEFINITIONS,
  FORM_SIMILAR_COSINE_MIN,
  MEASURED_PRECISION,
  NEAR_DUPLICATE_MAX,
  PRECISION_NOT_YET_MEASURED,
  PROBABLE_VARIANT_MAX,
  SIMILARITY_BANDS,
  WEAK_CEILING,
  bandForDistance,
  precisionFor,
} from './bands'
export type { BandDefinition, MeasuredPrecision, SimilarityBand, SimilarityMethod } from './bands'
export {
  SEGMENTS,
  blockPairs,
  bruteForcePairs,
  candidatePairs,
  guaranteesNearDuplicateRecall,
} from './blocking'
export type { BlockedComparison, CandidatePair, HashEntry } from './blocking'
export { dhash } from './dhash'
export { assertBits64, assertGrayImage, resizeArea } from './gray'
export type { Bits64, GrayImage } from './gray'
export { bitsToHex, hamming } from './hamming'
export { lowFrequencies, phash } from './phash'
