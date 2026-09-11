import { z } from 'zod'

/**
 * Zod for the two Phase 36 tables, at the repository boundary.
 *
 * `error_code` IS A CLOSED VOCABULARY, mirrored by the CHECK on the table: a run may say WHAT KIND of
 * failure happened and never what the upstream said about it.
 */

export const SHEET_ENTITIES = [
  'RESEARCH_PRODUCTS',
  'COMPARISON_SET',
  'OPPORTUNITY_SCORES',
  'SHORTLIST',
  'CONFIRMED',
  'DIRECTION_BRIEFS',
  'INQUIRIES',
] as const
export type SheetEntity = (typeof SHEET_ENTITIES)[number]

export const RUN_STATUSES = ['RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const RUN_TRIGGERS = ['MANUAL', 'CRON', 'CLI'] as const
export type RunTrigger = (typeof RUN_TRIGGERS)[number]

export const SHEETS_ERROR_CODES = [
  'NOT_CONFIGURED',
  'FLAG_OFF',
  'AUTH',
  'QUOTA',
  'UPSTREAM',
  'WRITE',
  'NO_SCOPE',
  'INVALID_COLUMNS',
  'PAUSED',
  'DISABLED',
  'RUNNING',
  'FORBIDDEN',
  'DRY_RUN',
] as const
export type SheetsErrorCode = (typeof SHEETS_ERROR_CODES)[number]

export const exportDefinitionRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  entity: z.enum(SHEET_ENTITIES),
  scope_id: z.string().uuid().nullable(),
  columns: z.array(z.string().min(1)).min(1).max(40),
  filter: z.record(z.string(), z.unknown()),
  spreadsheet_id: z.string().nullable(),
  tab_name: z.string().min(1),
  schedule: z.string().min(1),
  includes_pii: z.boolean(),
  is_enabled: z.boolean(),
  paused_at: z.string().nullable(),
  paused_reason: z.string().nullable(),
  consecutive_failures: z.number().int().nonnegative(),
  last_run_at: z.string().nullable(),
  last_status: z.enum(RUN_STATUSES).nullable(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
})
export type ExportDefinitionRow = z.infer<typeof exportDefinitionRowSchema>

export const syncRunRowSchema = z.object({
  id: z.string().uuid(),
  definition_id: z.string().uuid(),
  status: z.enum(RUN_STATUSES),
  trigger: z.enum(RUN_TRIGGERS),
  row_count: z.number().int().nonnegative(),
  cell_count: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  error_code: z.enum(SHEETS_ERROR_CODES).nullable(),
  duration_ms: z.number().int().nullable(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  actor_id: z.string().uuid().nullable(),
})
export type SyncRunRow = z.infer<typeof syncRunRowSchema>

/** What the definition form may say. Columns are validated against the entity's allowlist by the action. */
export const exportDefinitionInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    name: z.string().trim().min(1).max(120),
    entity: z.enum(SHEET_ENTITIES),
    scopeId: z.string().uuid().nullable(),
    columns: z.array(z.string().min(1)).min(1).max(40),
    filter: z.record(z.string(), z.unknown()),
    spreadsheetId: z.string().trim().min(1).max(200).nullable(),
    tabName: z.string().trim().min(1).max(100),
    schedule: z.string().trim().min(1).max(60),
    includesPii: z.boolean(),
  })
  .strict()
export type ExportDefinitionInput = z.infer<typeof exportDefinitionInputSchema>
