import { z } from 'zod'

import { ROLES } from '@/lib/auth/permissions'

/**
 * `system_logs` — Phase 38. `level` and `channel` are the two enums migration 0360 creates; every
 * FEAT §31 log type is a (level, channel) pair. `context` is redacted before insert and is parsed
 * here as an object of anything, because what a job records is the job's business — what it may
 * NOT record is the redactor's.
 */

export const LOG_LEVELS = ['INFO', 'WARNING', 'ERROR', 'SECURITY'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

export const LOG_CHANNELS = [
  'WORKFLOW',
  'SCRAPER',
  'MEDIA',
  'CONTENT',
  'AUTH',
  'SHEETS',
  'ANALYTICS',
  'SYSTEM',
] as const
export type LogChannel = (typeof LOG_CHANNELS)[number]

export const systemLogRowSchema = z.object({
  id: z.uuid(),
  level: z.enum(LOG_LEVELS),
  channel: z.enum(LOG_CHANNELS),
  event: z.string().min(1),
  message: z.string().min(1),
  context: z.record(z.string(), z.unknown()),
  actor_id: z.uuid().nullable(),
  actor_role: z.enum(ROLES).nullable(),
  request_id: z.string().nullable(),
  workflow_run_id: z.uuid().nullable(),
  research_source_id: z.uuid().nullable(),
  entity_type: z.string().nullable(),
  entity_id: z.uuid().nullable(),
  dedupe_key: z.string().min(1),
  occurrence_count: z.number().int().positive(),
  first_occurred_at: z.string(),
  occurred_at: z.string(),
})
export type SystemLogRow = z.infer<typeof systemLogRowSchema>

/** The filters `/studio/operations/logs` accepts, all optional, all validated at the boundary. */
export const systemLogFilterSchema = z
  .object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    level: z.enum(LOG_LEVELS).optional(),
    channel: z.enum(LOG_CHANNELS).optional(),
    actorId: z.uuid().optional(),
    workflowRunId: z.uuid().optional(),
    researchSourceId: z.uuid().optional(),
    entityType: z.string().min(1).max(80).optional(),
    entityId: z.uuid().optional(),
    /** Free text over `event`, matched as a case-insensitive substring. */
    event: z.string().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict()
export type SystemLogFilter = z.infer<typeof systemLogFilterSchema>

/** A row of `workflow_runs_v`. */
export const WORKFLOW_KINDS = ['RESEARCH', 'SHEETS', 'SEED', 'HIGGSFIELD', 'BULK'] as const
export type WorkflowKind = (typeof WORKFLOW_KINDS)[number]

export const workflowRunRowSchema = z.object({
  kind: z.enum(WORKFLOW_KINDS),
  id: z.uuid(),
  scope: z.string().nullable(),
  status: z.string().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
})
export type WorkflowRunRow = z.infer<typeof workflowRunRowSchema>
