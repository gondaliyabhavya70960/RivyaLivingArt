'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { writeAudit } from '@/lib/auth/audit'
import { requirePermission } from '@/lib/auth/require'
import {
  applyOverrides,
  normalizedProductSchema,
  RESEARCH_AVAILABILITIES,
  RESEARCH_PRICE_STATES,
} from '@/lib/scraper/normalization'
import { normalizeStoredVersion, readPriceExtraction } from '@/lib/scraper/validation/run'
import { recordEventAtCurrentStage } from '@/lib/scraper/core/stage'
import { acceptCandidateAsDuplicate, clearDuplicate } from '@/lib/scraper/workflows/match'
import { createAdminClient } from '@/lib/supabase/admin'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'
import { getExplorerRow } from '@/lib/supabase/repositories/research/explorer'
import { readLexicon } from '@/lib/supabase/repositories/research/lexicon'
import { decideCandidate } from '@/lib/supabase/repositories/research/match-candidates'
import { writeNormalizedOverride } from '@/lib/supabase/repositories/research/normalization'
import { getProductVersionById } from '@/lib/supabase/repositories/research/product-versions'
import { getSourceParsingConfig } from '@/lib/supabase/repositories/research/sources'
import { dismissIssue } from '@/lib/supabase/repositories/research/validation-issues'
import { createClient } from '@/lib/supabase/server'

/**
 * What a person may do to a scraped row, and the line that runs through the middle of it.
 *
 * `research.write` CORRECTS A VALUE; `research.confirm` DECIDES AN IDENTITY. That is not a
 * hierarchy of seniority, it is a difference in what the act costs if it is wrong. Correcting a
 * mis-parsed price is visible, reversible and affects one figure; marking a row a duplicate HIDES
 * it from every later comparison, opportunity score and shortlist, and nothing on any screen says
 * why a missing product is missing. So a researcher operates the pipeline and a merchandiser
 * decides what it found, and `0261` draws the same line at the row — because RLS gates a TABLE, not
 * a COLUMN, and without these checks a `research.write` holder could write `duplicate_of_id`
 * through PostgREST directly.
 *
 * EVERY ACT HERE IS RECORDED TWICE, AND THE TWO RECORDS ANSWER DIFFERENT QUESTIONS.
 * `research_pipeline_events` answers "what happened to this row and who did it", which is the
 * question somebody asks with the row in front of them. The audit log answers "what did this person
 * do", which is the question somebody asks about a person. Neither is derivable from the other.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT. `requirePermission` is therefore the
 * first statement of each one, before any argument is read — a check after a parse is a check that
 * an unauthorised caller has already got work out of.
 *
 * **TWO CLIENTS, AND WHICH WRITE USES WHICH IS THE WHOLE OF THE SECURITY MODEL HERE.**
 *
 *   The SESSION client makes every write a person is entitled to make under RLS — deciding a match
 *   candidate, dismissing a finding, setting a duplicate flag. RLS is the second layer under the
 *   permission check above it, and using an admin client for those would remove it.
 *
 *   The ADMIN client makes exactly two kinds of write, and each is one RLS cannot express:
 *
 *     1. `research_pipeline_events`, which has no insert policy for `authenticated` and never will
 *        (0233). An event is the system's record of what a person did; a record its subject can
 *        forge is not one.
 *
 *     2. The NORMALISED COLUMNS of `research_products` under `research.write`. RLS gates a TABLE,
 *        not a COLUMN: `research_products_update_staff` requires `research.confirm` because that
 *        table also carries `disposition` and `duplicate_of_id`, which are a merchandiser's. The
 *        phase document is explicit that correcting a normalised VALUE is a researcher's, so the
 *        column split is drawn here — `overrideSchema` is a strict allowlist of exactly the
 *        columns `research.write` may touch — and the write goes round RLS because RLS has no way
 *        to say it. Widening the policy instead would hand researchers `duplicate_of_id`.
 *
 * A FIRST DRAFT OF THIS FILE USED THE SESSION CLIENT FOR BOTH, and neither worked: the event
 * inserts were refused outright, and a researcher's correction matched zero rows while the action
 * reported success.
 */

const EXPLORER_PATH = '/studio/research/explorer'

function issue(message: string, code: string, field = '_form'): StudioFormState {
  return { status: 'error', issues: [{ field, code, message }] }
}

function refusal(error: unknown): StudioFormState {
  if (error instanceof ValidationError) {
    return {
      status: 'error',
      issues: error.issues.map((entry) => ({
        field: entry.path,
        code: 'invalid',
        message: entry.message,
      })),
    }
  }
  if (error instanceof PermissionError) return issue('You cannot do that.', 'forbidden')
  return issue('That was refused. Nothing was changed.', 'refused')
}

/**
 * The keys a person is allowed to correct.
 *
 * AN ALLOWLIST, NOT THE WHOLE SCHEMA. `normalized_overrides` is a jsonb column written from a form,
 * and every key in it is frozen against re-normalisation for good — so a key admitted here by
 * accident is a field the pipeline stops maintaining, silently, for that row. `parseStates`,
 * `sourceTexts` and `normalizerVersion` are the rules' own record of what they did and are
 * unwritable by anybody: an override of them would make the audit trail describe an edit rather
 * than the parse it exists to describe.
 */
const overrideSchema = z
  .object({
    titleNormalized: z.string().trim().min(1).max(500).nullable().optional(),
    brandText: z.string().trim().min(1).max(200).nullable().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/u)
      .nullable()
      .optional(),
    priceState: z.enum(RESEARCH_PRICE_STATES).nullable().optional(),
    priceMinMinor: z.number().int().nullable().optional(),
    priceMaxMinor: z.number().int().nullable().optional(),
    availability: z.enum(RESEARCH_AVAILABILITIES).nullable().optional(),
    leadTimeDaysMin: z.number().int().min(0).max(3_650).nullable().optional(),
    leadTimeDaysMax: z.number().int().min(0).max(3_650).nullable().optional(),
    variantCount: z.number().int().min(0).max(10_000).nullable().optional(),
  })
  .strict()

function readOverrideForm(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const text = (key: string): string => String(form.get(key) ?? '').trim()
  const number = (key: string): number | null | undefined => {
    const raw = text(key)
    if (raw === '') return undefined
    if (raw === '-') return null
    const value = Number(raw)
    return Number.isFinite(value) ? Math.round(value) : undefined
  }

  // A FIELD LEFT BLANK IS NOT AN OVERRIDE OF NULL. Blank means "I did not touch this", and treating
  // it as a correction to nothing would freeze every untouched field on the first save.
  if (text('title_normalized') !== '') out.titleNormalized = text('title_normalized')
  if (text('brand_text') !== '') out.brandText = text('brand_text')
  if (text('currency') !== '') out.currency = text('currency').toUpperCase()
  if (text('price_state') !== '') out.priceState = text('price_state')
  if (text('availability') !== '') out.availability = text('availability')

  const min = number('price_min_minor')
  if (min !== undefined) out.priceMinMinor = min
  const max = number('price_max_minor')
  if (max !== undefined) out.priceMaxMinor = max
  const leadMin = number('lead_time_days_min')
  if (leadMin !== undefined) out.leadTimeDaysMin = leadMin
  const leadMax = number('lead_time_days_max')
  if (leadMax !== undefined) out.leadTimeDaysMax = leadMax
  const variants = number('variant_count')
  if (variants !== undefined) out.variantCount = variants

  return out
}

/**
 * Correct one or more normalised values by hand.
 *
 * THE CORRECTION IS APPLIED OVER A FRESH PARSE, NOT OVER THE STORED ROW. Re-deriving the rules'
 * answer and then laying the person's keys on top is what makes the result INTERNALLY CONSISTENT:
 * a corrected `priceState` of `REQUEST_QUOTE` must come with null amounts or
 * `research_price_state_coherent` refuses the write, and only a full re-parse-then-merge knows
 * which other fields have to move with it. Patching the stored row key by key would produce a value
 * the schema rejects and a constraint violation where a sentence belongs.
 */
export async function saveOverrideAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const productId = String(form.get('product_id') ?? '')
    if (productId === '') return issue('That row could not be identified.', 'required')

    const raw = readOverrideForm(form)
    if (Object.keys(raw).length === 0) {
      return issue('Nothing was changed. Fill in a field to correct it.', 'empty')
    }

    const parsed = overrideSchema.safeParse(raw)
    if (!parsed.success) {
      return {
        status: 'error',
        issues: parsed.error.issues.map((entry) => ({
          field: entry.path.length === 0 ? '_form' : String(entry.path[0]),
          code: 'invalid',
          message: entry.message,
        })),
      }
    }

    const client = await createClient()
    const row = await getExplorerRow(client, productId)
    if (row === null) return issue('That row could not be found.', 'missing')
    if (row.current_version_id === null) {
      return issue('This row has no stored page yet, so there is nothing to correct.', 'no_version')
    }

    const [source, lexicon, version] = await Promise.all([
      getSourceParsingConfig(client, row.source_id),
      readLexicon(client),
      getProductVersionById(client, row.current_version_id),
    ])
    if (version === null) return issue('The stored page could not be read.', 'refused')

    const merged = { ...readStoredOverrides(row.normalized_overrides), ...parsed.data }

    const pass = normalizeStoredVersion({
      raw: version.raw,
      config: {
        sourceId: row.source_id,
        declaredCurrency: source?.currency ?? null,
        priceExtraction: readPriceExtraction(source?.priceExtraction),
      },
      lexicon,
      overrides: merged,
    })

    // `applyOverrides` returns the RULES' answer unchanged when the merged value fails the schema —
    // a corrected price with no currency, say. Writing that would silently discard the correction
    // and report success, so the mismatch is reported instead.
    const check = applyOverrides(pass.outcome.product, merged)
    if (check.frozen.length === 0 && Object.keys(merged).length > 0) {
      return issue(
        'Those values cannot go together on one row — a quote-only posture cannot carry a price, ' +
          'and a price needs a currency.',
        'incoherent',
      )
    }

    // See the header: the column split `research_products`'s single UPDATE policy cannot express.
    const admin = createAdminClient()
    await writeNormalizedOverride(admin, {
      productId,
      overrides: merged,
      normalized: normalizedProductSchema.parse(pass.product),
      userId: session.userId,
    })

    await recordEventAtCurrentStage(admin, {
      productId,
      actorUserId: session.userId,
      reason: `Corrected by hand: ${Object.keys(parsed.data).join(', ')}. Frozen against re-normalisation.`,
    })
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.product.override',
      result: 'SUCCESS',
      entityType: 'research_product',
      entityId: productId,
      summary: `corrected ${String(Object.keys(parsed.data).length)} normalised value(s) by hand`,
      // THE KEYS, NEVER THE VALUES. An audit row is read by more people than the screen is, and a
      // corrected competitor price is research nobody needs in a log line to answer "who changed
      // what". The row itself holds the value, and its pipeline event points at the moment.
      after: { keys: Object.keys(parsed.data) },
    })

    revalidatePath(EXPLORER_PATH)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

function readStoredOverrides(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Explain away a finding. `research.write`, and the reason is not optional. */
export async function dismissIssueAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const issueId = String(form.get('issue_id') ?? '')
    const reason = String(form.get('reason') ?? '').trim()
    if (issueId === '') return issue('That finding could not be identified.', 'required')
    if (reason === '') {
      return issue(
        'Say why this is not a problem. A finding nobody explained away is one nobody can review.',
        'required',
        'reason',
      )
    }

    const client = await createClient()
    await dismissIssue(client, { issueId, reason, userId: session.userId })
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.issue.dismiss',
      result: 'SUCCESS',
      entityType: 'research_validation_issue',
      entityId: issueId,
      summary: 'explained away a validation finding',
    })

    revalidatePath(EXPLORER_PATH)
    revalidatePath('/studio/operations/data-quality')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Decide a duplicate candidate. `research.confirm` — a merchandiser's, not a researcher's.
 *
 * **AND `research.confirm` ALONE.** A second check on `research.write` used to sit here, justified
 * in a comment that said "a role holding confirm without write does not exist today". That role is
 * MERCHANDISER — `research.write` is `[owner, admin, researcher]` and `research.confirm` is
 * `[owner, admin, merchandiser]` — so the extra check locked the one role this action exists for
 * out of it, and the comment asserting otherwise is what made it look deliberate. A defence in
 * depth that refuses the intended user is not defence, it is a bug with a rationale attached.
 */
export async function decideCandidateAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.confirm')
    const candidateRowId = String(form.get('candidate_id') ?? '')
    const decision = String(form.get('decision') ?? '')
    if (candidateRowId === '') return issue('That proposal could not be identified.', 'required')
    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
      return issue('A proposal is either the same product or a different one.', 'invalid')
    }

    const client = await createClient()
    if (decision === 'ACCEPTED') {
      await acceptCandidateAsDuplicate(client, createAdminClient(), {
        candidateRowId,
        userId: session.userId,
      })
    } else {
      await decideCandidate(client, { candidateRowId, decided: 'REJECTED', userId: session.userId })
    }

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.candidate.decide',
      result: 'SUCCESS',
      entityType: 'research_match_candidate',
      entityId: candidateRowId,
      summary: decision === 'ACCEPTED' ? 'confirmed as one product' : 'judged different products',
      after: { decided: decision },
    })

    revalidatePath(EXPLORER_PATH)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Undo a duplicate flag.
 *
 * THE REVERSAL IS WHY THE FLAG IS SAFE TO SET AT ALL, and it needs the same permission as setting
 * one: un-hiding a row changes what every comparison contains just as much as hiding it did.
 */
export async function clearDuplicateAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.confirm')
    const productId = String(form.get('product_id') ?? '')
    const reason = String(form.get('reason') ?? '').trim()
    if (productId === '') return issue('That row could not be identified.', 'required')
    if (reason === '') {
      return issue('Say why these are different products.', 'required', 'reason')
    }

    const client = await createClient()
    await clearDuplicate(client, createAdminClient(), { productId, userId: session.userId, reason })
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.duplicate.clear',
      result: 'SUCCESS',
      entityType: 'research_product',
      entityId: productId,
      summary: 'cleared a duplicate flag',
    })

    revalidatePath(EXPLORER_PATH)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
