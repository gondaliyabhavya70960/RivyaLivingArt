import type { SupabaseClient } from '@supabase/supabase-js'

import type { IssueSeverity, ResearchIssue } from '@/lib/scraper/validation/rules'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research validation issue'

export type ValidationIssueRow = Database['public']['Tables']['research_validation_issues']['Row']

const ISSUE_COLUMNS =
  'id, research_product_id, version_id, rule, severity, field, detail, is_dismissed, ' +
  'dismissed_by, dismissed_at, dismiss_reason, detected_at'

/**
 * The findings on a row, and the two things a person may do about one.
 *
 * A SESSION MAY DISMISS AN ISSUE AND MAY NOT RAISE ONE, WHICH IS WHY THE TABLE HAS NO INSERT POLICY
 * FOR ANY ROLE. An ERROR is what holds a row back; a forged one would be a way to quarantine a
 * competitor's product silently, and nothing about the screen would show it had been done by hand.
 * So the pipeline raises, under the service role, and a person dismisses — with a reason, which
 * `research_validation_issues_dismissal_is_attributed` makes non-optional at the row.
 *
 * DISMISSAL DOES NOT DELETE, AND THE ROW COMES BACK IF THE PAGE STILL SAYS SO. `is_dismissed` hides
 * a finding from triage and leaves it on the record, so "who decided this was fine, and when" stays
 * answerable — and the next run re-raises nothing, because `research_validation_issues_unique` on
 * (product, version, rule, field) means the same finding against the same version is the same row.
 * A NEW version raises its own, which is correct: the page changed, so the judgement is new.
 */

/**
 * Replace the findings for one (product, version) with what the rules just found.
 *
 * DELETE-THEN-INSERT, SCOPED TO THE VERSION, AND THE SCOPE IS THE WHOLE SAFETY OF IT. Re-running the
 * rules over one version must not clear a finding against a DIFFERENT version — that history is
 * what Phase 29 reads — and must not preserve a finding this pass no longer makes, which would leave
 * a row blocked by a rule that has since stopped firing. Two statements rather than one upsert
 * because an upsert cannot express the removal.
 *
 * A DISMISSED FINDING SURVIVES THE REPLACE. Re-raising a finding somebody has already judged, on a
 * version that has not changed, would undo their judgement on every re-normalisation — which is the
 * `renormalize.ts` failure this phase is most careful about everywhere else.
 */
export async function replaceIssues(
  admin: Client,
  input: {
    readonly productId: string
    readonly versionId: string | null
    readonly issues: readonly ResearchIssue[]
  },
): Promise<void> {
  const scope = admin
    .from('research_validation_issues')
    .delete()
    .eq('research_product_id', input.productId)
    .eq('is_dismissed', false)

  const { error: deleteError } =
    input.versionId === null
      ? await scope.is('version_id', null)
      : await scope.eq('version_id', input.versionId)
  if (deleteError !== null) throw toRepositoryError(ENTITY, 'clear', input.productId, deleteError)

  if (input.issues.length === 0) return

  const { error } = await admin.from('research_validation_issues').insert(
    input.issues.map((issue) => ({
      research_product_id: input.productId,
      version_id: input.versionId,
      rule: issue.rule,
      severity: issue.severity,
      field: issue.field,
      detail: issue.detail,
    })),
  )
  // A conflict here means a dismissed row already holds this (product, version, rule, field) — the
  // person's judgement stands and there is nothing to write. Anything else is a real failure.
  if (error !== null && error.code !== '23505') {
    throw toRepositoryError(ENTITY, 'raise', input.productId, error)
  }
}

export async function listIssuesForProduct(
  client: Client,
  productId: string,
): Promise<readonly ValidationIssueRow[]> {
  const { data, error } = await client
    .from('research_validation_issues')
    .select(ISSUE_COLUMNS)
    .eq('research_product_id', productId)
    .order('severity', { ascending: true })
    .order('detected_at', { ascending: false })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', productId, error)
  return (data ?? []) as unknown as ValidationIssueRow[]
}

/**
 * Dismiss one finding, with a reason.
 *
 * THE REASON IS REQUIRED HERE AS WELL AS AT THE ROW, and the duplication is deliberate: the
 * constraint produces `new row violates check constraint`, and a person who has just typed a
 * dismissal deserves a sentence naming what is missing.
 */
export async function dismissIssue(
  client: Client,
  input: { readonly issueId: string; readonly reason: string; readonly userId: string },
): Promise<void> {
  const reason = input.reason.trim()
  if (reason === '') {
    throw new Error(
      'A dismissal needs a reason. An issue nobody explained away is one nobody can review.',
    )
  }

  const { error } = await client
    .from('research_validation_issues')
    .update({
      is_dismissed: true,
      dismissed_by: input.userId,
      dismissed_at: new Date().toISOString(),
      dismiss_reason: reason,
    })
    .eq('id', input.issueId)
  if (error !== null) throw toRepositoryError(ENTITY, 'dismiss', input.issueId, error)
}

export interface IssueTally {
  readonly rule: string
  readonly severity: IssueSeverity
  readonly count: number
}

/**
 * Counts by rule and severity, for the data-quality tab and the dashboard tiles.
 *
 * COUNTED IN THE APPLICATION RATHER THAN BY A `group by`, AND THE REASON IS POSTGREST. It has no
 * grouping without a database view or an RPC, and a view over a research table is a second surface
 * whose grants and `security_invoker` posture have to be got right — which `0240` spends fifty
 * lines on for the one view that earns it. Undismissed findings across every source are in the low
 * thousands at the scale this system runs at, and the index
 * `research_validation_issues_by_rule_idx` is partial on exactly this predicate.
 */
export async function tallyIssues(client: Client): Promise<readonly IssueTally[]> {
  const { data, error } = await client
    .from('research_validation_issues')
    .select('rule, severity')
    .eq('is_dismissed', false)
    .limit(20_000)
  if (error !== null) throw toRepositoryError(ENTITY, 'tally', 'all', error)

  const counts = new Map<string, IssueTally>()
  for (const row of data ?? []) {
    const key = `${row.rule}:${row.severity}`
    const existing = counts.get(key)
    counts.set(
      key,
      existing === undefined
        ? { rule: row.rule, severity: row.severity as IssueSeverity, count: 1 }
        : { ...existing, count: existing.count + 1 },
    )
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

/**
 * The rules currently holding a row back.
 *
 * UNDISMISSED ERRORS ONLY, WHICH IS THE DEFINITION OF "BLOCKING" IN ONE PLACE. `rules.ts` decides
 * which rules block and this decides which of those are live on a row; a promotion pass that
 * re-derived either from a severity comparison of its own would be a second definition, and the two
 * would disagree the first time a rule's severity changed.
 */
export async function listBlockingRules(
  client: Client,
  productId: string,
): Promise<readonly string[]> {
  const { data, error } = await client
    .from('research_validation_issues')
    .select('rule')
    .eq('research_product_id', productId)
    .eq('severity', 'ERROR')
    .eq('is_dismissed', false)
  if (error !== null) throw toRepositoryError(ENTITY, 'blocking', productId, error)
  return (data ?? []).map((row) => row.rule)
}
