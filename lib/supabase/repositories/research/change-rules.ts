import type { SupabaseClient } from '@supabase/supabase-js'

import {
  CHANGE_FIELDS,
  type ChangeField,
  type ChangeRule,
} from '@/lib/scraper/analytics/materiality'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research change rule'

export type ChangeRuleRow = Database['public']['Tables']['research_change_rules']['Row']

const RULE_COLUMNS =
  'id, source_id, field, material_threshold, minor_threshold, is_enabled, status, ' +
  'created_at, updated_at, updated_by'

/**
 * The materiality thresholds, and the one place their precedence is read from the database.
 *
 * THE WHOLE TABLE IS READ AT ONCE, ALWAYS. There are eleven fields and at most one override per
 * source per field, so even a hundred sources is a table of a few hundred rows — smaller than one
 * page of the queue it configures. Reading it whole and resolving in TypeScript makes
 * `resolveThresholds` a pure function over a list, which is what lets the classification rules be
 * a fixture table with no database at all; a per-row query would put a network round trip inside
 * the detector's inner loop and would make the precedence rule a SQL expression nobody can test.
 *
 * A DISABLED RULE IS STILL RETURNED. `is_enabled = false` means "stop showing me this field", and
 * the detector records the movement as `NOISE` rather than not looking. Filtering the row out here
 * would make a disabled field indistinguishable from an unconfigured one, and an unconfigured one
 * falls back to the built-in default, which is the opposite of what was asked for.
 */

/**
 * Only PUBLISHED rules configure anything.
 *
 * A DRAFT OVERRIDE IS SOMEBODY THINKING ALOUD. The status column exists on this table because
 * every staff-editable research configuration table has one, and it earns its place here: a
 * researcher can prepare a per-source threshold, look at it, and publish it when they mean it —
 * rather than every keystroke in the Studio editor immediately re-classifying a queue somebody
 * else is working through.
 */
function isActive(row: ChangeRuleRow): boolean {
  return row.status === 'PUBLISHED'
}

function toRule(row: ChangeRuleRow): ChangeRule {
  return {
    sourceId: row.source_id,
    field: row.field as ChangeField,
    materialThreshold: row.material_threshold === null ? null : Number(row.material_threshold),
    minorThreshold: row.minor_threshold === null ? null : Number(row.minor_threshold),
    isEnabled: row.is_enabled,
  }
}

export async function readChangeRules(client: Client): Promise<readonly ChangeRule[]> {
  const { data, error } = await client
    .from('research_change_rules')
    .select(RULE_COLUMNS)
    .limit(2_000)
  if (error !== null) throw toRepositoryError(ENTITY, 'read', 'all', error)
  return ((data ?? []) as unknown as ChangeRuleRow[]).filter(isActive).map(toRule)
}

/** Every rule row, published or not, for the Studio editor. */
export async function listChangeRules(client: Client): Promise<readonly ChangeRuleRow[]> {
  const { data, error } = await client
    .from('research_change_rules')
    .select(RULE_COLUMNS)
    .order('field', { ascending: true })
    .order('source_id', { ascending: true, nullsFirst: true })
    .limit(2_000)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return (data ?? []) as unknown as ChangeRuleRow[]
}

/**
 * Create or update one rule.
 *
 * WRITTEN AS THE PERSON, NOT AS THE SYSTEM, because a threshold is a `research.write` decision and
 * RLS is the layer that should judge it. The server action checks the permission first; this write
 * then goes through the session client so that a bug in that check meets a second refusal rather
 * than a service-role key.
 *
 * THE UPSERT KEY IS THE UNIQUE CONSTRAINT, `nulls not distinct` INCLUDED. That is what makes
 * editing the global default for `price` an update rather than a second default row — and the
 * reason the constraint is written that way is recorded in `0270` and in amendment A29.
 */
export async function upsertChangeRule(
  client: Client,
  input: {
    readonly sourceId: string | null
    readonly field: ChangeField
    readonly materialThreshold: number | null
    readonly minorThreshold: number | null
    readonly isEnabled: boolean
    readonly status: 'DRAFT' | 'PUBLISHED'
    readonly actorUserId: string
  },
): Promise<void> {
  if (!CHANGE_FIELDS.includes(input.field)) {
    throw new Error(`Not a change field: ${input.field}`)
  }

  const { error } = await client.from('research_change_rules').upsert(
    {
      source_id: input.sourceId,
      field: input.field,
      material_threshold: input.materialThreshold,
      minor_threshold: input.minorThreshold,
      is_enabled: input.isEnabled,
      status: input.status,
      updated_at: new Date().toISOString(),
      updated_by: input.actorUserId,
    },
    { onConflict: 'source_id,field' },
  )
  if (error !== null) throw toRepositoryError(ENTITY, 'upsert', input.field, error)
}
