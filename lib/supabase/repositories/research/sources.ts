import type { SupabaseClient } from '@supabase/supabase-js'

import type { ReadinessState, SourceInput } from '@/lib/scraper/core/source-schema'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research source'

/**
 * Reads and writes for `research_sources`.
 *
 * TWO CLIENTS REACH THIS FILE AND THE DIFFERENCE MATTERS. The Studio pages pass the SESSION
 * client, so RLS decides what a viewer may see and a researcher may change. The drain loop passes
 * the SERVICE-ROLE client, because a cron tick has no session — and the politeness counters
 * (`in_flight_count`, `next_fetch_not_before`, `consecutive_failures`, `circuit_open_until`) have
 * no session write policy at all, deliberately: a member of staff who could edit them could edit
 * the rate limit.
 */

export type ResearchSourceRow = Database['public']['Tables']['research_sources']['Row']

/**
 * Phase 26 appends eight columns — FEAT §26 fields 6, 8, 12, 13, 14, 15 and 23, plus `readiness` —
 * rather than interleaving them, so the diff reads as an addition and every existing reader keeps
 * the shape it already had.
 *
 * AND IT REMOVES ONE THAT NEVER EXISTED. This list named `owner_verification`, and
 * `research_sources` has no such column: `0231` refuses it by name, at length, because
 * `policy_status` already answers that question with a constraint behind it and two columns
 * answering one question drift. PostgREST resolves a select list against the real relation, so
 * every read in this file — the sources page, the source drawer, the drain loop's runnable query —
 * was answering `42703 column research_sources.owner_verification does not exist`. Removing it is
 * a correction, not a change of behaviour: there is no prior behaviour to preserve. It survived
 * because nothing typechecks a select string; `SOURCE_HEALTH_COLUMNS` in `source-health.ts` is
 * read back against `information_schema.columns` by a test for exactly this reason.
 */
const SOURCE_COLUMNS =
  'id, slug, name, base_url, region, currency, source_type, is_enabled, adapter_key, ' +
  'rate_limit_rpm, request_delay_ms, concurrency, next_fetch_not_before, in_flight_count, ' +
  'consecutive_failures, circuit_open_until, policy_status, policy_reviewed_by, ' +
  'policy_reviewed_at, policy_notes, status, created_at, updated_at, updated_by, ' +
  'analytics_league, collection_mode, image_extraction_mode, price_extraction, sku_extraction, ' +
  'attribute_extraction, notes, readiness'

export async function listResearchSources(client: Client): Promise<ResearchSourceRow[]> {
  const { data, error } = await client
    .from('research_sources')
    .select(SOURCE_COLUMNS)
    .order('name', { ascending: true })
  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return (data ?? []) as unknown as ResearchSourceRow[]
}

export async function getResearchSource(
  client: Client,
  id: string,
): Promise<ResearchSourceRow | null> {
  const { data, error } = await client
    .from('research_sources')
    .select(SOURCE_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as ResearchSourceRow | null
}

/**
 * The sources a tick may actually work on.
 *
 * EVERY GATE IS IN THE QUERY, not in a filter afterwards. Enabled, policy-approved, circuit
 * closed, and due. A source that fails any of them is not returned at all, so there is no code
 * path where the drain loop holds a source it must not fetch and relies on remembering to check.
 * The lease function re-applies the same gates in the statement that hands out work — twice, on
 * purpose, because the seconds between this read and that write are seconds in which a kill switch
 * may have been thrown.
 */
export async function listRunnableSources(admin: Client): Promise<ResearchSourceRow[]> {
  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('research_sources')
    .select(SOURCE_COLUMNS)
    .eq('is_enabled', true)
    .eq('policy_status', 'APPROVED')
    .or(`circuit_open_until.is.null,circuit_open_until.lte.${nowIso}`)
    .or(`next_fetch_not_before.is.null,next_fetch_not_before.lte.${nowIso}`)
    .order('next_fetch_not_before', { ascending: true, nullsFirst: true })
  if (error) throw toRepositoryError(ENTITY, 'list', 'runnable', error)
  return (data ?? []) as unknown as ResearchSourceRow[]
}

/** Create a source. Always UNREVIEWED and disabled — the CHECK refuses anything else anyway. */
export async function createResearchSource(
  client: Client,
  input: {
    readonly slug: string
    readonly name: string
    readonly baseUrl: string
    readonly region: string | null
    readonly currency: string | null
    /**
     * `research_source_type` SINCE `0240`, WHERE IT WAS `text` BEFORE. Phase 25 left the column
     * text because the vocabulary was FEAT §26's to fix; narrowing the parameter to match is a
     * type correction, not a behaviour change — the only caller passes `sourceInputSchema`'s
     * `sourceType`, which is that enum's six values, and a wider parameter would have let a
     * seventh through to be refused by the database instead of by the compiler.
     */
    readonly sourceType: Database['public']['Enums']['research_source_type'] | null
    readonly actorId: string
  },
): Promise<string> {
  const { data, error } = await client
    .from('research_sources')
    .insert({
      slug: input.slug,
      name: input.name,
      base_url: input.baseUrl,
      region: input.region,
      currency: input.currency,
      source_type: input.sourceType,
      updated_by: input.actorId,
    })
    .select('id')
    .single()
  if (error) throw toRepositoryError(ENTITY, 'create', input.slug, error)
  return data.id
}

/**
 * Every FEAT §26 field a researcher may edit, in one write.
 *
 * WHAT IS DELIBERATELY ABSENT IS THE POINT OF THIS FUNCTION. `policy_status`, `policy_reviewed_by`,
 * `policy_reviewed_at`, `policy_notes` and `is_enabled` are not here, and they keep the two narrow
 * functions below instead. RLS gates a ROW, not a COLUMN: as far as PostgreSQL is concerned a
 * researcher who may edit a source's request delay may also write its `policy_status`. The pair of
 * permission checks in the server action is what draws that line, and this signature is what keeps
 * the line drawable — a general update that could carry `policy_status` would let any caller of it
 * move a source towards approval, and every future caller would have to remember not to. A caller
 * cannot forget a field this function does not accept.
 *
 * `slug`, `name` and `base_url` ARE here, because `sourceInputSchema` carries them and the drawer
 * that posts it is the screen where a source is renamed. `createResearchSource` stays narrow for
 * the opposite reason: it exists to guarantee one thing — a new source is UNREVIEWED and disabled —
 * and widening it to twenty-three arguments would give that guarantee twenty-three reasons to be
 * edited.
 *
 * THE THREE `jsonb` FIELDS ARE WRITTEN AS THE VALIDATED OBJECTS THEY ALREADY ARE. `0240` checks
 * only that each is an object, an object and an array; the shape is `priceExtractionSchema`,
 * `skuExtractionSchema` and `attributeExtractionSchema`'s to enforce, and it did so at the form.
 */
export async function updateResearchSource(
  client: Client,
  id: string,
  input: SourceInput & { readonly actorId: string },
): Promise<void> {
  const { error } = await client
    .from('research_sources')
    .update({
      slug: input.slug,
      name: input.name,
      base_url: input.baseUrl,
      region: input.region,
      currency: input.currency,
      source_type: input.sourceType,
      analytics_league: input.analyticsLeague,
      collection_mode: input.collectionMode,
      adapter_key: input.adapterKey,
      image_extraction_mode: input.imageExtractionMode,
      price_extraction: input.priceExtraction,
      sku_extraction: input.skuExtraction,
      attribute_extraction: input.attributeExtraction,
      rate_limit_rpm: input.rateLimitRpm,
      request_delay_ms: input.requestDelayMs,
      concurrency: input.concurrency,
      notes: input.notes,
      readiness: input.readiness,
      updated_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
}

/**
 * Move a source along the researcher's half of the policy workflow.
 *
 * ITS OWN FUNCTION RATHER THAN A FIELD OF THE UPDATE ABOVE, because `readiness` is a REQUEST and
 * `policy_status` is the ANSWER, and `0240` separates the two columns so that one may not be both.
 * The values this accepts are not all equal: a researcher posts `READY_FOR_REVIEW` (or `DRAFT` to
 * withdraw), while `REVIEWED` is written only by the policy decision, which is an owner's act. That
 * distinction is enforced in the server action, where the session is known — this layer takes the
 * value it is given and records who gave it, exactly as `setPolicyReview` does.
 */
export async function setSourceReadiness(
  client: Client,
  id: string,
  readiness: ReadinessState,
  actorId: string,
): Promise<void> {
  const { error } = await client
    .from('research_sources')
    .update({ readiness, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'readiness', id, error)
}

/**
 * Record a policy review.
 *
 * THE PERMISSION CHECK IS NOT HERE AND MUST NOT BE. Approving a source is `research.write` AND
 * `system.settings.write` — owner and admin — and that pair is checked in the server action, above
 * this layer, where `requirePermission` lives. What this function guarantees is narrower and
 * different: an approval always carries a name and a time, because the row refuses one that does
 * not.
 */
export async function setPolicyReview(
  client: Client,
  id: string,
  input: {
    readonly status: Database['public']['Enums']['research_policy_status']
    readonly notes: string | null
    readonly actorId: string
  },
): Promise<void> {
  const { error } = await client
    .from('research_sources')
    .update({
      policy_status: input.status,
      policy_reviewed_by: input.status === 'APPROVED' ? input.actorId : null,
      policy_reviewed_at: input.status === 'APPROVED' ? new Date().toISOString() : null,
      policy_notes: input.notes,
      updated_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'review', id, error)
}

/**
 * Enable or disable a source.
 *
 * ENABLING AN UNAPPROVED SOURCE IS REFUSED BY THE ROW, not by this function, and that is the point:
 * `research_sources_enabled_requires_approval` cannot be forgotten by a later caller, a fixture or
 * a migration. This function does not check first — it lets the constraint speak, and the typed
 * ValidationError names the constraint, so the Studio can say exactly what is missing.
 */
export async function setSourceEnabled(
  client: Client,
  id: string,
  isEnabled: boolean,
  actorId: string,
): Promise<void> {
  const { error } = await client
    .from('research_sources')
    .update({ is_enabled: isEnabled, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'enable', id, error)
}

/** Politeness bookkeeping after a fetch. Service role only — there is no session policy for it. */
export async function recordSourceFetchOutcome(
  admin: Client,
  id: string,
  input: {
    readonly nextFetchNotBefore: Date
    readonly consecutiveFailures: number
    readonly circuitOpenUntil: Date | null
  },
): Promise<void> {
  const { error } = await admin
    .from('research_sources')
    .update({
      next_fetch_not_before: input.nextFetchNotBefore.toISOString(),
      consecutive_failures: input.consecutiveFailures,
      circuit_open_until: input.circuitOpenUntil?.toISOString() ?? null,
    })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'politeness', id, error)
}

/** Per-source counts for the dashboard, in one round trip per state rather than one per source. */
export async function countSourcesByPolicyStatus(client: Client): Promise<Record<string, number>> {
  const { data, error } = await client.from('research_sources').select('policy_status')
  if (error) throw toRepositoryError(ENTITY, 'count', 'policy', error)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = String(row.policy_status)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
