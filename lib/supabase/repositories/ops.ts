import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'

type Client = SupabaseClient<Database>

/**
 * The two reads the environment page makes — Phase 38. Here rather than in `lib/ops/` because
 * only a repository may query a table; the checks hold the timing, the timeout and the mapping to
 * a fixed code, and never a row.
 */

/** `select 1`, in PostgREST's dialect: a head-only count of a table every deployment has. */
export async function pingDatabase(client: Client, signal: AbortSignal): Promise<boolean> {
  const { error } = await client
    .from('feature_flags')
    .select('key', { count: 'exact', head: true })
    .abortSignal(signal)
  return error === null
}

/**
 * The ledger is not application data and the type generator leaves it out, so the client is
 * retyped for this one read (version, checksum, applied_at), the way the view readers are.
 */
type LedgerDatabase = {
  readonly public: {
    readonly Tables: Database['public']['Tables'] & {
      readonly schema_migrations: {
        readonly Row: { version: string; checksum: string; applied_at: string }
        readonly Insert: { version: string; checksum: string; applied_at?: string }
        readonly Update: { version?: string; checksum?: string; applied_at?: string }
        readonly Relationships: []
      }
    }
    readonly Views: Database['public']['Views']
    readonly Functions: Database['public']['Functions']
    readonly Enums: Database['public']['Enums']
    readonly CompositeTypes: Database['public']['CompositeTypes']
  }
}

export interface MigrationLedger {
  readonly applied: number
  readonly latest: string | null
}

export async function readMigrationLedger(
  client: Client,
  signal: AbortSignal,
): Promise<MigrationLedger | null> {
  const ledger = client as unknown as SupabaseClient<LedgerDatabase>
  const { data, error, count } = await ledger
    .from('schema_migrations')
    .select('version', { count: 'exact' })
    .order('version', { ascending: false })
    .limit(1)
    .abortSignal(signal)
  if (error !== null) return null
  return { applied: count ?? 0, latest: data?.[0]?.version ?? null }
}
