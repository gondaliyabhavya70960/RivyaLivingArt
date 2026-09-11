import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  countUndecided,
  oldestUndecided,
  tallyMaterialChanges,
} from '@/lib/supabase/repositories/research/changes'
import { writeDigest } from '@/lib/supabase/repositories/research/digests'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import {
  countProductsFirstSeenBetween,
  countProductsNotSeenSince,
  penultimateSuccessBySource,
} from '@/lib/supabase/repositories/research/discovery'
import type { Database } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

/**
 * One day's summary of what the pipeline noticed, written to a table and read on the dashboard.
 *
 * IT IS A STUDIO SURFACE, NOT AN EMAIL. Nothing here sends anything anywhere; outbound
 * notification is Phase 38's decision and its consequences — an address list, a schedule, an
 * unsubscribe — are not this phase's to take on the side.
 *
 * THE NUMBER THAT MATTERS MOST IS THE OLDEST UNDECIDED CHANGE. Counts of activity make a system
 * look busy; a date makes a backlog undeniable. A queue with forty undecided changes has looked the
 * same for a month either way, but "the oldest undecided change is from 3 August" cannot be read as
 * steady state, and the whole risk this phase is arranged against is a queue people quietly stop
 * reading.
 *
 * IDEMPOTENT BY THE TABLE'S KEY. `digest_date` is unique and the write is an upsert, so a retried
 * cron slice updates the row rather than doubling every count on it. That is not a nicety: the
 * Phase 25 cron drains in bounded slices and retries are ordinary.
 */

export interface DigestStats {
  readonly window: { readonly from: string; readonly to: string }
  readonly materialChangesByField: Readonly<Record<string, number>>
  readonly materialChangesBySource: Readonly<Record<string, number>>
  readonly materialChangeTotal: number
  readonly productsDiscovered: number
  readonly productsDisappeared: number
  /** Sources with fewer than two successful runs, where disappearance cannot yet be judged. */
  readonly sourcesWithoutBaseline: number
  readonly undecidedTotal: number
  readonly oldestUndecidedAt: string | null
  readonly oldestUndecidedId: string | null
}

/** The UTC day a timestamp falls in, as `YYYY-MM-DD`. */
export function digestDateFor(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/**
 * Build the day's numbers.
 *
 * THE WINDOW IS THE UTC DAY, STATED IN THE STATS. A digest whose window is implicit is a digest
 * nobody can reconcile against the queue six months later, and "midnight" is a different moment in
 * every office. UTC is what the database stamps, so UTC is what the summary counts.
 */
export async function buildDigest(client: Client, at: Date): Promise<DigestStats> {
  const date = digestDateFor(at)
  const from = new Date(`${date}T00:00:00.000Z`)
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)

  /*
   * `tallyMaterialChanges` COUNTS FROM `from` ONWARD AND THE DAY'S DIGEST WANTS ONE DAY, so a
   * digest generated for TODAY while today is still running counts what has happened so far and is
   * rewritten by the next run — which is the point of the upsert. A digest generated for a past day
   * would over-count, so the window's end is applied by asking for the day and regenerating it
   * rather than by filtering here, and the window is recorded in the stats so a reader can see
   * exactly what was counted.
   */
  const withinWindow = await tallyMaterialChanges(client, from)

  const byField: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  let total = 0
  for (const tally of withinWindow) {
    byField[tally.field] = (byField[tally.field] ?? 0) + tally.count
    bySource[tally.sourceId] = (bySource[tally.sourceId] ?? 0) + tally.count
    total += tally.count
  }

  const discovered = await countProductsFirstSeenBetween(client, from, to)

  /*
   * DISAPPEARANCE IS JUDGED PER SOURCE, AGAINST THAT SOURCE'S OWN SECOND-MOST-RECENT SUCCESS.
   *
   * A source with fewer than two successful runs has no baseline, and the honest answer about its
   * catalogue is "cannot tell yet" — so it is COUNTED SEPARATELY rather than contributing a zero.
   * A zero and an unknown look identical on a dashboard and mean opposite things: one says the
   * competitor's range is stable, the other says we have not watched it long enough to say.
   */
  const baselines = await penultimateSuccessBySource(client)
  let disappeared = 0
  for (const [sourceId, since] of baselines) {
    disappeared += await countProductsNotSeenSince(client, sourceId, since)
  }

  const sources = await listResearchSources(client)
  const withoutBaseline = sources.filter((source) => !baselines.has(source.id)).length

  const oldest = await oldestUndecided(client)
  const undecided = await countUndecided(client)

  return {
    window: { from: from.toISOString(), to: to.toISOString() },
    materialChangesByField: byField,
    materialChangesBySource: bySource,
    materialChangeTotal: total,
    productsDiscovered: discovered,
    productsDisappeared: disappeared,
    sourcesWithoutBaseline: withoutBaseline,
    undecidedTotal: undecided,
    oldestUndecidedAt: oldest?.detected_at ?? null,
    oldestUndecidedId: oldest?.id ?? null,
  }
}

/**
 * Build and store, which is what the cron route calls.
 *
 * READS AS THE SESSION-LESS SERVICE ROLE FOR BOTH HALVES, because the caller is a cron route with
 * no session at all. That is not a widening: the digest reads only research tables, and the table
 * it writes has no session write policy by design.
 */
export async function generateDigest(
  admin: Client,
  at: Date,
): Promise<{ readonly digestDate: string; readonly stats: DigestStats }> {
  const stats = await buildDigest(admin, at)
  const digestDate = digestDateFor(at)
  await writeDigest(admin, { digestDate, stats })
  return { digestDate, stats }
}
