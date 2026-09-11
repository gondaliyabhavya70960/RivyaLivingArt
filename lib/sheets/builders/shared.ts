import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'

import type { Cell } from '../definitions'

/**
 * What every row builder shares — Phase 36.
 *
 * THIS MODULE READS ONE REPOSITORY, the research sources, for the name a source id stands for.
 * The category lookup deliberately lives in `research.ts` and not here: the direction builder
 * imports this module, and I4 (`check-research-isolation.mjs`) holds that no module imports both
 * the direction repository and a catalogue repository. Keeping the catalogue read out of the
 * shared module keeps that true of the direction builder without a carve-out.
 */

export type Client = SupabaseClient<Database>

export type Record_ = Readonly<Record<string, Cell>>

export const text = (value: unknown): Cell => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return JSON.stringify(value)
}

export async function sourceNames(client: Client): Promise<ReadonlyMap<string, string>> {
  const sources = await listResearchSources(client)
  return new Map(sources.map((source) => [source.id, source.name]))
}

export function project(
  columns: readonly string[],
  records: readonly Record_[],
): readonly (readonly Cell[])[] {
  return records.map((record) => columns.map((key) => record[key] ?? null))
}
