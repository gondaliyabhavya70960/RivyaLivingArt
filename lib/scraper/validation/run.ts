import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { rawProductDraftSchema, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import { priceExtractionSchema, type PriceExtraction } from '@/lib/scraper/core/source-schema'
import {
  applyOverrides,
  normalizeDraft,
  type Lexicon,
  type NormalizationOutcome,
  type NormalizedProduct,
} from '@/lib/scraper/normalization'
import { readLexicon } from '@/lib/supabase/repositories/research/lexicon'
import { replaceIssues } from '@/lib/supabase/repositories/research/validation-issues'
import type { Database } from '@/lib/supabase/database.types'

import { blockingRules, blocksPromotion, evaluateRules, type ResearchIssue } from './rules'

type Client = SupabaseClient<Database>

/**
 * The half of validation that touches the world: read the evidence, run the pure rules over it,
 * store what they found.
 *
 * SPLIT FROM `rules.ts` SO THE RULES STAY TESTABLE AGAINST A TABLE. Every judgement about a
 * competitor's page is going to be argued with eventually, and an argument is only settleable if
 * the rule can be put beside its input in a unit test with no database at all. This file is the
 * plumbing that makes that possible; it contains no judgement of its own.
 *
 * A BLOCKED ROW IS WRITTEN, NOT REFUSED. `blocks` means the row does not move PAST `VALIDATED`; it
 * still reaches it, still carries its issues, still appears in the explorer's Issues view and still
 * counts on the dashboard. The alternative — refusing the write — produces a gap nobody can see,
 * which is the failure mode this whole phase is arranged against.
 */

/** A source's parsing configuration, read once per pass rather than per row. */
export interface SourceNormalizationConfig {
  readonly sourceId: string
  readonly declaredCurrency: string | null
  readonly priceExtraction: PriceExtraction
}

/**
 * The price configuration, parsed at the boundary.
 *
 * A DEFAULT IS SUPPLIED RATHER THAN THROWN ON, and the choice matters at three in the morning. A
 * source whose `price_extraction` jsonb is malformed — hand-edited, or written by a phase that
 * predates the schema — would otherwise stop the whole promotion pass for every row in that source.
 * What it does instead is read prices with the dot/comma convention most of the web uses, and the
 * rows carry whatever the rules make of that. A configuration nobody can parse is a source
 * misconfiguration, visible on the source screen, not a pipeline outage.
 */
const FALLBACK_PRICE_EXTRACTION: PriceExtraction = priceExtractionSchema.parse({
  strategy: 'NONE',
  decimalSeparator: '.',
  thousandsSeparator: ',',
})

export function readPriceExtraction(value: unknown): PriceExtraction {
  const parsed = priceExtractionSchema.safeParse(value)
  return parsed.success ? parsed.data : FALLBACK_PRICE_EXTRACTION
}

export interface NormalizationPass {
  readonly outcome: NormalizationOutcome
  /** The rules' answer with a person's corrections put back over it — what gets written. */
  readonly product: NormalizedProduct
  readonly frozen: readonly string[]
}

/**
 * Normalise one stored version.
 *
 * IT READS NOTHING FROM THE NETWORK, WHICH IS WHAT MAKES `renormalize.ts` POSSIBLE. Everything this
 * needs — the draft, the source's separators, the lexicon — is already held, so a lexicon fix or a
 * parser fix is rolled out over months of stored evidence with zero traffic to anybody's site.
 */
export function normalizeStoredVersion(input: {
  readonly raw: unknown
  readonly config: SourceNormalizationConfig
  readonly lexicon: Lexicon
  readonly overrides: Record<string, unknown>
}): NormalizationPass {
  // The stored draft goes through the same schema an adapter's output does. It was parsed on the
  // way in; a column is a boundary on the way out too, and this one is also the path a hand-edited
  // row takes.
  const draft: RawProductDraft = rawProductDraftSchema.parse(input.raw)

  const outcome = normalizeDraft(draft, {
    declaredCurrency: input.config.declaredCurrency,
    priceExtraction: input.config.priceExtraction,
    lexicon: input.lexicon,
  })

  const { product, frozen } = applyOverrides(outcome.product, input.overrides)
  return { outcome, product, frozen }
}

export interface ValidationOutcome {
  readonly issues: readonly ResearchIssue[]
  readonly blocked: boolean
  readonly blocking: readonly string[]
}

/**
 * Judge one row and record the findings.
 *
 * THE ISSUES ARE WRITTEN BEFORE THE STAGE MOVES, and the ordering is `core/stage.ts`'s own reasoning
 * inverted for the same purpose. A row that reached `VALIDATED` with its ERROR not yet stored would
 * look, for as long as the gap lasted, like a row that passed — and a promotion pass reading it in
 * that window would move it on to `MATCHED`. Findings first means the worst case is an issue
 * recorded against a row that has not moved yet, which is visible and self-correcting.
 */
export async function validateAndRecord(
  admin: Client,
  input: {
    readonly productId: string
    readonly versionId: string | null
    readonly draft: RawProductDraft
    readonly pass: NormalizationPass
    readonly sourceUrl: string
    readonly duplicateOfEarlierId: string | null
    readonly categoryMapped: boolean
  },
): Promise<ValidationOutcome> {
  const issues = evaluateRules({
    draft: input.draft,
    normalized: input.pass.product,
    signals: input.pass.outcome.signals,
    sourceUrl: input.sourceUrl,
    duplicateOfEarlierId: input.duplicateOfEarlierId,
    categoryMapped: input.categoryMapped,
  })

  await replaceIssues(admin, {
    productId: input.productId,
    versionId: input.versionId,
    issues,
  })

  return { issues, blocked: blocksPromotion(issues), blocking: blockingRules(issues) }
}

/** The lexicon, read once for a whole pass. Hundreds of rows would otherwise read it hundreds of times. */
export async function loadLexicon(client: Client): Promise<Lexicon> {
  return readLexicon(client)
}
