import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  resolveCategory,
  normaliseLabel,
  type CategoryMapping,
} from '@/lib/scraper/core/category-map'
import { recordEventAtCurrentStage } from '@/lib/scraper/core/stage'
import type { DimensionsMm } from '@/lib/scraper/normalization'
import {
  decideCandidate,
  proposeCandidates,
  type MatchMethod,
} from '@/lib/supabase/repositories/research/match-candidates'
import {
  setDuplicateOf,
  writeProductDisposition,
} from '@/lib/supabase/repositories/research/products'
import type { Database } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

/**
 * Two questions that both produce CANDIDATES rather than verdicts: is this row a duplicate of
 * another row in the same source, and which Rivya category does it belong to?
 *
 * NEITHER QUESTION IS ALLOWED TO GUESS, AND THEY FAIL IN OPPOSITE DIRECTIONS BY DESIGN. An
 * unmatched category leaves the row at `VALIDATED` — visible, counted, and one mapping away from
 * moving — because a row given a category nobody chose would be compared against Rivya's own
 * products under a heading that is simply wrong. An uncertain duplicate becomes a row in
 * `research_match_candidates` for a merchandiser, because merging two genuinely different products
 * HIDES one of them from every later comparison, score and shortlist, and nothing on any screen
 * would say why.
 *
 * CROSS-SOURCE DUPLICATES ARE OUT OF SCOPE, DELIBERATELY. Two competitors listing similar objects is
 * the most interesting thing this system can observe; collapsing them into one row would destroy
 * exactly the signal Phase 31 is built to read. Deduplication is within a source and nowhere else.
 *
 * A DUPLICATE FLAG IS ALWAYS REVERSIBLE AND ITS REVERSAL IS AUDITED. `clearDuplicate` is as much a
 * part of this module as `acceptCandidate`, and both write a pipeline event, because a decision
 * that cannot be undone is one nobody makes confidently and a decision undone silently is one
 * nobody can review.
 */

/** Above this, the pipeline acts. Below it, a person does. */
export const AUTO_MERGE_CONFIDENCE = 0.95
/** pg_trgm's own scale. Below this the titles are not the same product by any reading. */
export const TRIGRAM_THRESHOLD = 0.85
/** Furniture is described to the centimetre; five per cent is a rounding difference, not a variant. */
export const DIMENSION_TOLERANCE = 0.05

/**
 * `pg_trgm.similarity`, in TypeScript, to its actual definition.
 *
 * WHY NOT ASK POSTGRESQL. The obvious implementation is `select similarity(a, b)`, and it would be
 * a network round trip per pair on an O(n²) comparison within a source — thousands of queries to
 * answer a question that is arithmetic on two strings. Worse, it would make the rule untestable
 * without a database, and this is the rule most likely to be argued about when it merges the wrong
 * two rows. The trigram index on `title_normalized` still exists and is what a Phase 31 query will
 * use; this is the in-process version for the matcher's own loop.
 *
 * THE PADDING IS pg_trgm's, NOT A SIMPLIFICATION. It splits on non-alphanumerics, prefixes each
 * word with two spaces and suffixes one, and takes every 3-gram of the result — so "oak" yields
 * `"  o"`, `" oa"`, `"oak"`, `"ak "`. Getting that wrong would produce numbers that look like
 * similarities and do not match what the database would say about the same pair, which is the worst
 * kind of wrong: plausible and inconsistent.
 */
export function trigramSet(value: string): ReadonlySet<string> {
  const words = value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((word) => word !== '')

  const grams = new Set<string>()
  for (const word of words) {
    const padded = `  ${word} `
    for (let index = 0; index + 3 <= padded.length; index += 1) {
      grams.add(padded.slice(index, index + 3))
    }
  }
  return grams
}

export function trigramSimilarity(a: string, b: string): number {
  const left = trigramSet(a)
  const right = trigramSet(b)
  if (left.size === 0 || right.size === 0) return 0

  let shared = 0
  for (const gram of left) if (right.has(gram)) shared += 1

  const union = left.size + right.size - shared
  return union === 0 ? 0 : shared / union
}

export type DimensionVerdict = 'AGREE' | 'CONTRADICT' | 'UNKNOWN'

/**
 * Do two rows' measurements say they are the same object?
 *
 * THREE ANSWERS, NOT TWO, AND THE THIRD IS THE USEFUL ONE. `UNKNOWN` — one row has no measurements,
 * or they share no axis — is not agreement and is not disagreement, and collapsing it into either
 * is how a matcher either merges two different tables or refuses to merge two identical ones. The
 * caller decides what UNKNOWN is worth per method, and the decisions differ: an exact identifier
 * from the source outweighs missing measurements, and a fuzzy title match does not.
 */
export function compareDimensions(
  a: DimensionsMm | null,
  b: DimensionsMm | null,
): DimensionVerdict {
  if (a === null || b === null) return 'UNKNOWN'

  const shared = Object.keys(a).filter((key) => typeof b[key as keyof DimensionsMm] === 'number')
  if (shared.length === 0) return 'UNKNOWN'

  for (const key of shared) {
    const left = a[key as keyof DimensionsMm]
    const right = b[key as keyof DimensionsMm]
    if (typeof left !== 'number' || typeof right !== 'number') continue
    const larger = Math.max(left, right)
    if (larger === 0) continue
    if (Math.abs(left - right) / larger > DIMENSION_TOLERANCE) return 'CONTRADICT'
  }
  return 'AGREE'
}

/** The fields the duplicate rules read. A plain value, so the whole comparison is unit-testable. */
export interface DuplicateSubject {
  readonly id: string
  readonly externalId: string | null
  readonly titleNormalized: string | null
  readonly currency: string | null
  readonly priceMinMinor: number | null
  readonly dimensionsMm: DimensionsMm | null
  /** Which row is older. `duplicate_source_url_within_source` says the older row wins. */
  readonly firstSeenAt: string
}

export interface DuplicateProposal {
  readonly method: MatchMethod
  readonly score: number
  readonly dimensions: DimensionVerdict
  readonly evidence: Record<string, unknown>
  /** True when the pipeline may act on it. False means a merchandiser decides. */
  readonly autoMerge: boolean
}

/**
 * Compare one row against one sibling, most deterministic evidence first.
 *
 * THE ORDER IS THE STRENGTH OF THE EVIDENCE, AND ONLY THE FIRST HIT IS RETURNED. A pair matching on
 * external id also matches on title; recording both would put two candidate rows in a merchandiser's
 * queue for one decision, and the weaker of them would be the one they read.
 *
 * WHAT "AUTO-MERGE" REQUIRES, PER METHOD, AND WHY IT IS NOT ONE RULE:
 *   • `EXTERNAL_ID` — the SOURCE's own statement that these are one product. Nothing Rivya infers
 *     outranks it; a site that renamed a product still means the same SKU. Auto-merges unless the
 *     measurements actively contradict, which would mean the identifier is being reused.
 *   • `TITLE_PRICE` — identical normalised title AND identical price in the same currency. Two
 *     genuinely different pieces sharing both is a coincidence nobody has met. Auto-merges unless
 *     the measurements contradict.
 *   • `TRIGRAM_DIMENSION` — the only heuristic here, and the only one that demands POSITIVE
 *     agreement: a title above 0.95 AND measurements that agree within 5 %. `UNKNOWN` measurements
 *     are not enough, because a fuzzy title alone is how "Halden Dining Table 180" gets merged into
 *     "Halden Dining Table 200".
 */
export function proposeDuplicate(
  subject: DuplicateSubject,
  other: DuplicateSubject,
): DuplicateProposal | null {
  if (subject.id === other.id) return null

  const dimensions = compareDimensions(subject.dimensionsMm, other.dimensionsMm)
  const contradicts = dimensions === 'CONTRADICT'

  if (
    subject.externalId !== null &&
    other.externalId !== null &&
    subject.externalId.trim() !== '' &&
    subject.externalId.trim() === other.externalId.trim()
  ) {
    return {
      method: 'EXTERNAL_ID',
      score: 1,
      dimensions,
      evidence: { externalId: subject.externalId, dimensions },
      autoMerge: !contradicts,
    }
  }

  const title = subject.titleNormalized
  const otherTitle = other.titleNormalized
  if (title === null || otherTitle === null) return null

  const sameTitle = title.trim().toLowerCase() === otherTitle.trim().toLowerCase()
  const samePrice =
    subject.priceMinMinor !== null &&
    subject.priceMinMinor === other.priceMinMinor &&
    subject.currency !== null &&
    subject.currency === other.currency

  if (sameTitle && samePrice) {
    return {
      method: 'TITLE_PRICE',
      score: 0.97,
      dimensions,
      evidence: {
        title,
        priceMinMinor: subject.priceMinMinor,
        currency: subject.currency,
        dimensions,
      },
      autoMerge: !contradicts,
    }
  }

  const similarity = trigramSimilarity(title, otherTitle)
  if (similarity < TRIGRAM_THRESHOLD) return null

  return {
    method: 'TRIGRAM_DIMENSION',
    score: Math.round(similarity * 1000) / 1000,
    dimensions,
    evidence: { title, otherTitle, similarity: Math.round(similarity * 1000) / 1000, dimensions },
    autoMerge: similarity >= AUTO_MERGE_CONFIDENCE && dimensions === 'AGREE',
  }
}

export interface TaxonomyMatch {
  readonly categoryId: string | null
  readonly confidence: number | null
  readonly method: 'MAP' | 'KEYWORD' | null
  /** IGNORED means a person dismissed this label. The row is not unmapped; it is out of scope. */
  readonly ignored: boolean
}

/** What a keyword rule has to work with — Rivya's taxonomy, as names a label could be compared to. */
export interface CategoryTerm {
  readonly id: string
  readonly name: string
  readonly slug: string
}

/** A keyword rule is a WEAKER claim than a person's mapping, and its confidence says so. */
export const KEYWORD_CONFIDENCE = 0.6

/**
 * Which Rivya category, if any.
 *
 * THE HUMAN-AUTHORED MAP IS TRIED FIRST AND ITS ANSWER IS FINAL, including its refusals. Somebody
 * looked at "Outdoor / Parasols" and decided it maps to nothing Rivya makes; a keyword rule that
 * then matched "outdoor" against an *Outdoor* category would overrule a decision that was already
 * taken, and would do it invisibly.
 *
 * THE KEYWORD RULE IS EXACT ON THE NORMALISED LABEL, NOT FUZZY. "Dining Tables" matching a *Dining
 * Tables* category is a spelling difference; "Console Tables" matching *Tables* is a judgement about
 * taxonomy that belongs to a person. Confidence is recorded at 0.6 so the explorer can show it as
 * what it is — a suggestion the map has not yet been taught.
 *
 * NO MATCH IS NO MATCH. `missing_category_mapping` fires, the row stops at `VALIDATED`, and the
 * dashboard's unmapped count goes up. Nothing is ever defaulted to a first category.
 */
export function matchTaxonomy(
  labels: readonly string[],
  mappings: readonly CategoryMapping[],
  categories: readonly CategoryTerm[],
): TaxonomyMatch {
  const mapped = resolveCategory(labels, mappings)
  if (mapped.outcome === 'MAPPED' && mapped.categoryId !== null) {
    return { categoryId: mapped.categoryId, confidence: 1, method: 'MAP', ignored: false }
  }
  if (mapped.outcome === 'IGNORED') {
    return { categoryId: null, confidence: null, method: null, ignored: true }
  }

  const index = new Map<string, string>()
  for (const category of categories) {
    index.set(normaliseLabel(category.name), category.id)
    index.set(normaliseLabel(category.slug.replace(/-/gu, ' ')), category.id)
  }

  for (const label of labels) {
    const key = normaliseLabel(label)
    if (key === '') continue
    const id = index.get(key)
    if (id !== undefined) {
      return { categoryId: id, confidence: KEYWORD_CONFIDENCE, method: 'KEYWORD', ignored: false }
    }
  }

  return { categoryId: null, confidence: null, method: null, ignored: false }
}

/**
 * Record what the comparison found: act on the certain ones, queue the rest.
 *
 * THE OLDER ROW WINS AND THE FLAG GOES ON THE NEWER ONE. Which of two duplicates survives has to be
 * decided by something stable, or two runs disagree and the pair flips back and forth; `first_seen_at`
 * is the only ordering that does not depend on the order the rows were compared in.
 */
export async function applyDuplicateProposals(
  admin: Client,
  input: {
    readonly subject: DuplicateSubject
    readonly siblings: readonly DuplicateSubject[]
  },
): Promise<{ readonly merged: string | null; readonly queued: number }> {
  const proposals = input.siblings
    .map((other) => ({ other, proposal: proposeDuplicate(input.subject, other) }))
    .filter(
      (entry): entry is { other: DuplicateSubject; proposal: DuplicateProposal } =>
        entry.proposal !== null,
    )
    .sort((a, b) => b.proposal.score - a.proposal.score)

  const automatic = proposals.find(
    (entry) => entry.proposal.autoMerge && entry.other.firstSeenAt <= input.subject.firstSeenAt,
  )

  if (automatic !== undefined) {
    await writeProductDisposition(admin, {
      id: input.subject.id,
      disposition: 'DUPLICATE',
      actorId: null,
    })
    await setDuplicateOf(admin, {
      id: input.subject.id,
      duplicateOfId: automatic.other.id,
      actorId: null,
    })
    await recordEventAtCurrentStage(admin, {
      productId: input.subject.id,
      actorUserId: null,
      reason:
        `Marked a duplicate of ${automatic.other.id} by ${automatic.proposal.method} at ` +
        `${String(automatic.proposal.score)}. Reversible.`,
    })
    return { merged: automatic.other.id, queued: 0 }
  }

  const queued = await proposeCandidates(
    admin,
    proposals.map((entry) => ({
      researchProductId: input.subject.id,
      candidateId: entry.other.id,
      method: entry.proposal.method,
      score: entry.proposal.score,
      evidence: entry.proposal.evidence,
    })),
  )
  return { merged: null, queued }
}

/**
 * A merchandiser accepting a candidate. `research.confirm`, and both columns move together.
 *
 * THE PERMISSION CHECK IS THE CALLER'S — a Server Action — AND SO IS THE SESSION CLIENT. This
 * function takes the caller's client rather than an admin one on purpose: RLS is the second layer
 * under that check, and running the write as the service role would remove it.
 */
export async function acceptCandidateAsDuplicate(
  client: Client,
  admin: Client,
  input: { readonly candidateRowId: string; readonly userId: string },
): Promise<void> {
  const row = await decideCandidate(client, {
    candidateRowId: input.candidateRowId,
    decided: 'ACCEPTED',
    userId: input.userId,
  })

  await writeProductDisposition(client, {
    id: row.research_product_id,
    disposition: 'DUPLICATE',
    actorId: input.userId,
  })
  await setDuplicateOf(client, {
    id: row.research_product_id,
    duplicateOfId: row.candidate_id,
    actorId: input.userId,
  })
  // THE DOMAIN WRITES RUN AS THE PERSON so RLS applies to them; the RECORD of what they did runs
  // as the system, because `research_pipeline_events` has no insert policy for a session and an
  // event a merchandiser could forge is not a record of anything.
  await recordEventAtCurrentStage(admin, {
    productId: row.research_product_id,
    actorUserId: input.userId,
    reason: `Confirmed a duplicate of ${row.candidate_id} from a ${row.method} candidate.`,
  })
}

/**
 * Undo one. The reversal is the reason the flag is safe to set at all.
 *
 * IT CLEARS BOTH COLUMNS AND WRITES AN EVENT. A row left at `disposition = 'DUPLICATE'` with a null
 * pointer would be hidden from every comparison with nothing to say what it was hidden behind — the
 * exact state that makes an operator distrust the whole screen.
 */
export async function clearDuplicate(
  client: Client,
  admin: Client,
  input: { readonly productId: string; readonly userId: string; readonly reason: string },
): Promise<void> {
  await setDuplicateOf(client, { id: input.productId, duplicateOfId: null, actorId: input.userId })
  await writeProductDisposition(client, {
    id: input.productId,
    disposition: 'NONE',
    actorId: input.userId,
  })
  await recordEventAtCurrentStage(admin, {
    productId: input.productId,
    actorUserId: input.userId,
    reason: `Duplicate flag cleared: ${input.reason}`,
  })
}
