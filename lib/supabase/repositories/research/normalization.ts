import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizedProductSchema, type NormalizedProduct } from '@/lib/scraper/normalization'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research normalization'

/**
 * The one place a normalised value reaches a column.
 *
 * ONE WRITER, FOR THE REASON `core/stage.ts` GIVES ABOUT STAGES. Twenty-three columns written from
 * four call sites is four places where a rule about which fields go together — a quote state with a
 * null amount, an AMBIGUOUS dimension with a null object — can be got right three times. Here it is
 * got right once, and `research_price_state_coherent` and `research_dimensions_sane` are the
 * backstop rather than the discovery mechanism.
 *
 * THE VALUE IS RE-PARSED AT THE BOUNDARY. It arrives from a pure module that already produced it
 * through the same schema, and parsing again is not paranoia about that module: it is the guard for
 * `scripts/research/renormalize.ts`, for a Server Action applying a person's override, and for
 * whatever Phase 29 writes here — none of which go through `normalizeDraft`. D1 puts Zod at the
 * boundary, and the boundary is the column.
 *
 * THE VERSION IS STAMPED IN THE SAME PASS. `research_product_versions.normalized` holds the
 * snapshot Phase 29 diffs against; writing the row without the snapshot would leave a product whose
 * current values have no recorded provenance in the version history, which is precisely the state
 * change detection cannot reason about.
 */

export interface NormalizedWrite {
  readonly productId: string
  /** The version this reading came from. Null only for a hand-edited row with no version at all. */
  readonly versionId: string | null
  readonly normalized: NormalizedProduct
  readonly matchedCategoryId: string | null
  readonly matchConfidence: number | null
  readonly matchMethod: 'MAP' | 'KEYWORD' | 'MANUAL' | null
}

export async function writeNormalizedProduct(admin: Client, input: NormalizedWrite): Promise<void> {
  const value = normalizedProductSchema.parse(input.normalized)

  const { error } = await admin
    .from('research_products')
    .update({
      title_normalized: value.titleNormalized,
      brand_text: value.brandText,
      currency: value.currency,
      price_state: value.priceState,
      price_min_minor: value.priceMinMinor,
      price_max_minor: value.priceMaxMinor,
      dimensions_mm: value.dimensionsMm as never,
      dimension_parse_state: value.dimensionParseState,
      material_tokens: [...value.materialTokens],
      availability: value.availability,
      lead_time_days_min: value.leadTimeDaysMin,
      lead_time_days_max: value.leadTimeDaysMax,
      variant_count: value.variantCount,
      image_urls: [...value.imageUrls],
      category_labels: [...value.categoryLabels],
      matched_category_id: input.matchedCategoryId,
      match_confidence: input.matchConfidence,
      match_method: input.matchMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.productId)
  if (error !== null) throw toRepositoryError(ENTITY, 'write', input.productId, error)

  if (input.versionId === null) return

  /*
   * THE ONE UPDATE THIS SUBSYSTEM MAKES TO AN APPEND-ONLY TABLE, AND IT IS NOT A CONTRADICTION.
   * `research_product_versions` is append-only about the EVIDENCE — `raw`, `content_hash`,
   * `storage_key`, all of which say what a page served and none of which may ever change. The two
   * columns written here are Rivya's READING of that evidence, declared in `0250` for this moment
   * and stamped with the rules' own version so a reading made by different rules is legible as
   * one. Phase 29 asks "did the page change, or did we start reading it differently", and it can
   * only answer that because the reading is stored beside the evidence rather than replacing it.
   */
  const { error: versionError } = await admin
    .from('research_product_versions')
    .update({ normalized: value as never, normalizer_version: value.normalizerVersion })
    .eq('id', input.versionId)
  if (versionError !== null) throw toRepositoryError(ENTITY, 'stamp', input.versionId, versionError)
}

/**
 * A person's correction, and the audit columns that make it one.
 *
 * SEPARATE FROM THE PIPELINE WRITE BECAUSE THE PERMISSION IS DIFFERENT AND SO IS THE MEANING.
 * `writeNormalizedProduct` is the rules speaking and runs as the service role; this is a named
 * person overruling them, requires `research.write`, and freezes the keys it touched against every
 * future re-normalisation. Merging the two would make "who decided this value" unanswerable, which
 * is the question the explorer exists to answer.
 */
export async function writeNormalizedOverride(
  /**
   * AN ADMIN CLIENT, AND THAT IS NOT A CONVENIENCE. `research_products_update_staff` requires
   * `research.confirm` because the table also carries `disposition` and `duplicate_of_id`; the
   * phase document gives a normalised-VALUE correction to `research.write`. RLS gates a table, not
   * a column, so the split is drawn by the Server Action's own check plus the strict column
   * allowlist in `overrideSchema`, and the write goes round a policy that cannot express it.
   * Passing a session client here silently matched zero rows while the action reported success.
   */
  client: Client,
  input: {
    readonly productId: string
    readonly overrides: Record<string, unknown>
    readonly normalized: NormalizedProduct
    readonly userId: string
  },
): Promise<void> {
  const value = normalizedProductSchema.parse(input.normalized)
  const now = new Date().toISOString()

  const { error } = await client
    .from('research_products')
    .update({
      title_normalized: value.titleNormalized,
      brand_text: value.brandText,
      currency: value.currency,
      price_state: value.priceState,
      price_min_minor: value.priceMinMinor,
      price_max_minor: value.priceMaxMinor,
      dimensions_mm: value.dimensionsMm as never,
      dimension_parse_state: value.dimensionParseState,
      material_tokens: [...value.materialTokens],
      availability: value.availability,
      lead_time_days_min: value.leadTimeDaysMin,
      lead_time_days_max: value.leadTimeDaysMax,
      variant_count: value.variantCount,
      normalized_overrides: input.overrides as never,
      override_by: input.userId,
      override_at: now,
      updated_at: now,
      updated_by: input.userId,
    })
    .eq('id', input.productId)
  if (error !== null) throw toRepositoryError(ENTITY, 'override', input.productId, error)
}

/** The frozen keys, for `renormalize.ts` to skip and for the explorer to badge. */
export function frozenKeys(overrides: unknown): readonly string[] {
  if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) return []
  return Object.keys(overrides as Record<string, unknown>)
}
