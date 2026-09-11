import { describe, expect, it, vi } from 'vitest'

import { writeSystemLog } from '@/lib/supabase/repositories/system-logs'

/**
 * THE RPC PAYLOAD CARRIES EVERY PARAMETER — Phase 42, written after finding that it did not.
 *
 * `system_log_write` declares thirteen parameters and a default for none of them. PostgREST picks
 * an overload by matching the JSON keys it receives, and `supabase-js` DROPS a key whose value is
 * `undefined` before serialising. The repository passed its seven optional arguments as
 * `?? undefined`, so six keys arrived, no overload matched, and every write failed with PGRST202.
 *
 * WHAT MADE IT SURVIVE FOUR PHASES IS NOT THE BUG, IT IS THE SILENCE. `logSystem` catches
 * everything and logs the error's NAME only — deliberately, so a log line cannot carry a secret —
 * so the symptom was one word in a dev server's output and an empty table in Studio that reads
 * exactly like "nothing has gone wrong". A logging system that fails quietly is worse than none,
 * because its emptiness is believed.
 *
 * SO THE TEST IS ABOUT THE SHAPE OF THE REQUEST, not about the database. It stubs the client and
 * asserts the payload: thirteen keys, not one of them `undefined`. It runs offline, in the unit
 * project, on every push — which is what the original defect needed and did not have.
 */

/** The full parameter list, from `system_log_write`'s signature. */
const PARAMETERS = [
  'p_level',
  'p_channel',
  'p_event',
  'p_message',
  'p_context',
  'p_actor_id',
  'p_actor_role',
  'p_request_id',
  'p_workflow_run_id',
  'p_research_source_id',
  'p_entity_type',
  'p_entity_id',
  'p_dedupe_key',
] as const

function stubClient(): {
  client: Parameters<typeof writeSystemLog>[0]
  payload: () => Record<string, unknown>
} {
  let captured: Record<string, unknown> = {}
  const rpc = vi.fn((_name: string, args: Record<string, unknown>) => {
    captured = args
    return Promise.resolve({ data: 'written', error: null })
  })
  return {
    client: { rpc } as unknown as Parameters<typeof writeSystemLog>[0],
    payload: () => captured,
  }
}

describe('writeSystemLog', () => {
  it('sends every parameter the function declares', async () => {
    const { client, payload } = stubClient()
    await writeSystemLog(client, {
      level: 'SECURITY',
      channel: 'SYSTEM',
      event: 'csp.violation',
      message: 'CSP report: script-src-elem',
      context: { directive: 'script-src-elem' },
      actorId: null,
      actorRole: null,
      requestId: null,
      workflowRunId: null,
      researchSourceId: null,
      entityType: null,
      entityId: null,
      dedupeKey: 'csp|script-src-elem',
    })

    expect(Object.keys(payload()).sort()).toEqual([...PARAMETERS].sort())
  })

  it('never sends undefined for an absent value', async () => {
    /*
     * THE ASSERTION THAT WOULD HAVE CAUGHT IT. `toEqual` above passes for a key whose value is
     * `undefined`, and that is exactly the value `supabase-js` removes on the way out — so the key
     * count can look right in a test and be wrong on the wire.
     */
    const { client, payload } = stubClient()
    /*
     * NULLS SPELLED OUT, because `SystemLogWrite` requires every field — so a caller CANNOT omit
     * one, and `logSystem` is what turns its own optional entry into these nulls. What is still
     * worth asserting is that the repository passes a null through as a null: the defect was a
     * `?? undefined` between this object and the wire, which no type could see.
     */
    await writeSystemLog(client, {
      level: 'INFO',
      channel: 'SCRAPER',
      event: 'fetch.retry',
      message: 'retrying',
      context: {},
      actorId: null,
      actorRole: null,
      requestId: null,
      workflowRunId: null,
      researchSourceId: null,
      entityType: null,
      entityId: null,
      dedupeKey: 'scraper|fetch.retry',
    })

    const sent = payload()
    const undefinedKeys = Object.keys(sent).filter((key) => sent[key] === undefined)
    expect(
      undefinedKeys,
      'supabase-js drops these before serialising, and system_log_write has no defaults to fall back on',
    ).toEqual([])
    expect(Object.keys(sent).sort()).toEqual([...PARAMETERS].sort())
  })

  it('passes the caller values through unchanged', async () => {
    const { client, payload } = stubClient()
    await writeSystemLog(client, {
      level: 'ERROR',
      channel: 'MEDIA',
      event: 'upload.rejected',
      message: 'rejected',
      context: { reason: 'EMPTY' },
      actorId: '00000000-0000-4000-8000-000000000001',
      actorRole: 'editor',
      requestId: null,
      workflowRunId: null,
      researchSourceId: null,
      entityType: 'media_asset',
      entityId: null,
      dedupeKey: 'media|upload.rejected',
    })

    expect(payload()).toMatchObject({
      p_level: 'ERROR',
      p_channel: 'MEDIA',
      p_event: 'upload.rejected',
      p_actor_id: '00000000-0000-4000-8000-000000000001',
      p_actor_role: 'editor',
      p_entity_type: 'media_asset',
      p_entity_id: null,
    })
  })
})
