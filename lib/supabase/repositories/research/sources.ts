import type { SupabaseClient } from '@supabase/supabase-js'

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

const SOURCE_COLUMNS =
  'id, slug, name, base_url, region, currency, source_type, is_enabled, adapter_key, ' +
  'rate_limit_rpm, request_delay_ms, concurrency, next_fetch_not_before, in_flight_count, ' +
  'consecutive_failures, circuit_open_until, policy_status, policy_reviewed_by, ' +
  'policy_reviewed_at, policy_notes, status, owner_verification, created_at, updated_at, updated_by'

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
    readonly sourceType: string | null
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
