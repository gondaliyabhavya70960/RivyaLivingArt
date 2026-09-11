import { z } from 'zod'

import { SIMILARITY_BANDS } from '@/lib/scraper/analytics/similarity/bands'

/**
 * Zod for every Phase 33 table, at the repository boundary. Rows are validated on the way out as
 * well as on the way in: a hash that is not 64 bits of 0 and 1 is not a hash, whatever the column
 * type says, and a run whose counts went negative is a bug the page should refuse to render.
 *
 * `bit(64)` comes back from PostgREST as a 64-character string of 0 and 1 — the same literal form
 * `lib/scraper/analytics/similarity` produces — so no conversion sits between the hasher and the
 * row.
 */

export const bits64Schema = z.string().regex(/^[01]{64}$/u, 'a 64-bit hash')
export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u, 'a SHA-256 hex digest')

export const SIMILARITY_SCOPES = ['CORPUS', 'SOURCE', 'SET', 'PRODUCT', 'MEDIA_ASSET'] as const
export type SimilarityScope = (typeof SIMILARITY_SCOPES)[number]

export const SIMILARITY_METHODS = ['PHASH', 'EMBEDDING'] as const
export const RUN_STATUSES = ['RUNNING', 'SUCCEEDED', 'FAILED'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const mediaAssetHashRowSchema = z.object({
  id: z.string().uuid(),
  media_asset_id: z.string().uuid(),
  kind: z.enum(['IMAGE', 'VIDEO']),
  checksum: sha256Schema,
  phash: bits64Schema.nullable(),
  dhash: bits64Schema.nullable(),
  computed_at: z.string(),
})
export type MediaAssetHashRow = z.infer<typeof mediaAssetHashRowSchema>

/** The hash row joined to the asset's identity, for a refusal or a cluster to name it. */
export const mediaAssetHashWithAssetSchema = mediaAssetHashRowSchema.extend({
  media_assets: z
    .object({
      rivya_asset_id: z.string().nullable(),
      public_id: z.string(),
      filename: z.string().nullable(),
    })
    .nullable(),
})
export type MediaAssetHashWithAsset = z.infer<typeof mediaAssetHashWithAssetSchema>

export const researchImageHashRowSchema = z.object({
  id: z.string().uuid(),
  research_product_id: z.string().uuid(),
  source_id: z.string().uuid(),
  source_image_url: z.string(),
  source_image_key: sha256Schema,
  position: z.number().int().nonnegative(),
  checksum: sha256Schema,
  phash: bits64Schema,
  dhash: bits64Schema,
  fetch_id: z.string().uuid().nullable(),
  computed_at: z.string(),
})
export type ResearchImageHashRow = z.infer<typeof researchImageHashRowSchema>

export const similarityRunRowSchema = z.object({
  id: z.string().uuid(),
  scope_type: z.enum(SIMILARITY_SCOPES),
  scope_id: z.string().uuid().nullable(),
  method: z.enum(SIMILARITY_METHODS),
  model_name: z.string().nullable(),
  status: z.enum(RUN_STATUSES),
  images_fetched: z.number().int().nonnegative(),
  images_hashed: z.number().int().nonnegative(),
  sources_skipped: z.record(z.string(), z.string()),
  pairs_considered: z.number().int().nonnegative(),
  pairs_stored: z.number().int().nonnegative(),
  pairs_exact: z.number().int().nonnegative(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  error_code: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
})
export type SimilarityRunRow = z.infer<typeof similarityRunRowSchema>

export const similarityPairRowSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  left_hash_id: z.string().uuid(),
  right_hash_id: z.string().uuid(),
  method: z.enum(SIMILARITY_METHODS),
  distance: z.number().int().nonnegative().nullable(),
  cosine: z.number().nullable(),
  band: z.enum(SIMILARITY_BANDS),
  created_at: z.string(),
})
export type SimilarityPairRow = z.infer<typeof similarityPairRowSchema>

export const similaritySuppressionRowSchema = z.object({
  id: z.string().uuid(),
  left_hash_id: z.string().uuid(),
  right_hash_id: z.string().uuid(),
  reason: z.string().min(1),
  created_at: z.string(),
  created_by: z.string().uuid(),
})
export type SimilaritySuppressionRow = z.infer<typeof similaritySuppressionRowSchema>

/** What the CLI and the action accept when they open a run. */
export const newSimilarityRunSchema = z.object({
  scope_type: z.enum(SIMILARITY_SCOPES),
  scope_id: z.string().uuid().nullable(),
  method: z.enum(SIMILARITY_METHODS),
  model_name: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
})
export type NewSimilarityRun = z.infer<typeof newSimilarityRunSchema>

export const runCountsSchema = z.object({
  images_fetched: z.number().int().nonnegative(),
  images_hashed: z.number().int().nonnegative(),
  sources_skipped: z.record(z.string(), z.string()),
  pairs_considered: z.number().int().nonnegative(),
  pairs_stored: z.number().int().nonnegative(),
  pairs_exact: z.number().int().nonnegative(),
})
export type RunCounts = z.infer<typeof runCountsSchema>
