import {
  LOG_CHANNELS,
  LOG_LEVELS,
  systemLogFilterSchema,
  type SystemLogFilter,
} from '@/lib/supabase/schemas/system-logs'

/**
 * The query string of `/studio/operations/logs` and its CSV export, parsed once — Phase 38. An
 * invalid value is dropped, not refused: a mistyped filter should land on the unfiltered list, and
 * there is nothing here worth a 400 over.
 */

type Params = Readonly<Record<string, string | string[] | undefined>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

function one(params: Params, key: string): string | undefined {
  const value = params[key]
  const single = Array.isArray(value) ? value[0] : value
  return single === undefined || single.trim() === '' ? undefined : single.trim()
}

function isoOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString()
}

export function parseLogFilter(params: Params): SystemLogFilter {
  const level = one(params, 'level')
  const channel = one(params, 'channel')
  const candidate = {
    from: isoOrUndefined(one(params, 'from')),
    to: isoOrUndefined(one(params, 'to')),
    level: (LOG_LEVELS as readonly string[]).includes(level ?? '') ? level : undefined,
    channel: (LOG_CHANNELS as readonly string[]).includes(channel ?? '') ? channel : undefined,
    actorId: UUID.test(one(params, 'actor') ?? '') ? one(params, 'actor') : undefined,
    workflowRunId: UUID.test(one(params, 'run') ?? '') ? one(params, 'run') : undefined,
    researchSourceId: UUID.test(one(params, 'source') ?? '') ? one(params, 'source') : undefined,
    entityType: one(params, 'entity_type')?.slice(0, 80),
    entityId: UUID.test(one(params, 'entity') ?? '') ? one(params, 'entity') : undefined,
    event: one(params, 'event')?.slice(0, 100),
  }
  const defined = Object.fromEntries(
    Object.entries(candidate).filter(([, value]) => value !== undefined),
  )
  const parsed = systemLogFilterSchema.safeParse(defined)
  return parsed.success ? parsed.data : {}
}

/** The same filter as a query string, for the export link and the form's defaults. */
export function logFilterQuery(filter: SystemLogFilter): string {
  const params = new URLSearchParams()
  if (filter.from !== undefined) params.set('from', filter.from)
  if (filter.to !== undefined) params.set('to', filter.to)
  if (filter.level !== undefined) params.set('level', filter.level)
  if (filter.channel !== undefined) params.set('channel', filter.channel)
  if (filter.actorId !== undefined) params.set('actor', filter.actorId)
  if (filter.workflowRunId !== undefined) params.set('run', filter.workflowRunId)
  if (filter.researchSourceId !== undefined) params.set('source', filter.researchSourceId)
  if (filter.entityType !== undefined) params.set('entity_type', filter.entityType)
  if (filter.entityId !== undefined) params.set('entity', filter.entityId)
  if (filter.event !== undefined) params.set('event', filter.event)
  return params.toString()
}

export function activeFilterCount(filter: SystemLogFilter): number {
  return Object.values(filter).filter((value) => value !== undefined).length
}
