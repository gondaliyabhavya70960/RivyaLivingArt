import { z } from 'zod'

import { SIGNAL_KEYS } from '@/lib/scraper/analytics/opportunity/model'
import { SHEET_ENTITIES, type SheetEntity } from '@/lib/supabase/schemas/sheets'

/**
 * What each export may contain — Phase 36, the pure half.
 *
 * ONE ALLOWLIST PER ENTITY, AND NOTHING OUTSIDE IT REACHES A SPREADSHEET. A definition names its
 * columns; `validateColumns` refuses any name the entity does not declare. No media column exists
 * on any entity (no asset id, no Cloudinary URL), no secret, nothing from `audit_logs`,
 * `system_logs` or `staff_profiles`. PII columns exist on `INQUIRIES` only, flagged as such, and
 * are stripped unless the definition carries `includes_pii`.
 *
 * NO I/O HERE. The row builders that read the database are `lib/sheets/builders.ts`; this module
 * is what `tests/unit/sheets-definitions.test.ts` proves without one.
 */

export interface ColumnSpec {
  readonly key: string
  readonly label: string
  readonly pii?: boolean
}

const signalColumns: readonly ColumnSpec[] = SIGNAL_KEYS.map((key) => ({
  key: `signal:${key}`,
  label: `Signal · ${key} (normalised)`,
}))

export const ENTITY_COLUMNS: Readonly<Record<SheetEntity, readonly ColumnSpec[]>> = {
  RESEARCH_PRODUCTS: [
    { key: 'source', label: 'Source' },
    { key: 'title_normalized', label: 'Title' },
    { key: 'category', label: 'Mapped category' },
    { key: 'price_state', label: 'Price state' },
    { key: 'price_min_minor', label: 'Price min (minor units)' },
    { key: 'price_max_minor', label: 'Price max (minor units)' },
    { key: 'currency', label: 'Currency' },
    { key: 'dimensions_mm', label: 'Dimensions (mm, JSON)' },
    { key: 'dimension_parse_state', label: 'Dimension parse state' },
    { key: 'stage', label: 'Stage' },
    { key: 'disposition', label: 'Disposition' },
    { key: 'first_seen_at', label: 'First seen' },
    { key: 'last_seen_at', label: 'Last seen' },
    { key: 'source_url', label: 'Source URL' },
  ],
  COMPARISON_SET: [
    { key: 'member_type', label: 'Member type' },
    { key: 'member', label: 'Member' },
    { key: 'source', label: 'Source' },
    { key: 'category', label: 'Mapped category' },
    { key: 'price_state', label: 'Price state' },
    { key: 'price_min_minor', label: 'Price min (minor units)' },
    { key: 'currency', label: 'Currency' },
    { key: 'longest_axis_mm', label: 'Longest axis (mm)' },
    { key: 'scale_band', label: 'Scale band' },
    { key: 'snapshot_computed_at', label: 'Latest snapshot' },
    { key: 'coverage_pct', label: 'Coverage %' },
  ],
  OPPORTUNITY_SCORES: [
    { key: 'research_product', label: 'Research product' },
    { key: 'source', label: 'Source' },
    { key: 'score', label: 'Score' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'state', label: 'State' },
    { key: 'model_version', label: 'Model version' },
    { key: 'computed_at', label: 'Computed' },
    ...signalColumns,
  ],
  SHORTLIST: [
    { key: 'research_product', label: 'Research product' },
    { key: 'source', label: 'Source' },
    { key: 'reason', label: 'Reason' },
    { key: 'tags', label: 'Tags' },
    { key: 'score_at_entry', label: 'Score at entry' },
    { key: 'confidence_at_entry', label: 'Confidence at entry' },
    { key: 'opened_at', label: 'Opened' },
    { key: 'opened_by', label: 'Opened by (user id)' },
  ],
  CONFIRMED: [
    { key: 'research_product', label: 'Research product' },
    { key: 'source', label: 'Source' },
    { key: 'decision_note', label: 'Decision note' },
    { key: 'confirmed_by', label: 'Confirmed by (user id)' },
    { key: 'confirmed_at', label: 'Confirmed' },
    { key: 'product_started', label: 'Rivya product started' },
    { key: 'archived_at', label: 'Archived' },
  ],
  DIRECTION_BRIEFS: [
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'target_category_slug', label: 'Target category' },
    { key: 'evidence_count', label: 'Evidence count' },
    { key: 'approved_by', label: 'Approved by (user id)' },
    { key: 'updated_at', label: 'Updated' },
  ],
  INQUIRIES: [
    { key: 'reference_code', label: 'Reference' },
    { key: 'kind', label: 'Kind' },
    { key: 'pipeline_status', label: 'Pipeline status' },
    { key: 'created_at', label: 'Created' },
    { key: 'city', label: 'City' },
    { key: 'enquiry_type', label: 'Enquiry type' },
    { key: 'whatsapp_state', label: 'WhatsApp state' },
    { key: 'source_path', label: 'Source path' },
    { key: 'name', label: 'Name', pii: true },
    { key: 'phone', label: 'Phone', pii: true },
    { key: 'email', label: 'Email', pii: true },
  ],
}

export const ENTITY_LABELS: Readonly<Record<SheetEntity, string>> = {
  RESEARCH_PRODUCTS: 'Research products',
  COMPARISON_SET: 'Comparison set',
  OPPORTUNITY_SCORES: 'Opportunity scores',
  SHORTLIST: 'Shortlist',
  CONFIRMED: 'Confirmed references',
  DIRECTION_BRIEFS: 'Direction briefs',
  INQUIRIES: 'Enquiries',
}

/** The default column set: every non-PII column, in allowlist order. */
export function defaultColumns(entity: SheetEntity): readonly string[] {
  return ENTITY_COLUMNS[entity].filter((column) => column.pii !== true).map((column) => column.key)
}

export function piiColumns(entity: SheetEntity): readonly string[] {
  return ENTITY_COLUMNS[entity].filter((column) => column.pii === true).map((column) => column.key)
}

/** COMPARISON_SET needs a set id; nothing else takes a scope. */
export function requiresScope(entity: SheetEntity): boolean {
  return entity === 'COMPARISON_SET'
}

/** The permission a run needs beyond `integrations.sheets.run`, per the phase document's table. */
export function extraRunPermission(entity: SheetEntity): 'research.read' | 'inquiries.export' {
  return entity === 'INQUIRIES' ? 'inquiries.export' : 'research.read'
}

export type ColumnValidation =
  | { readonly ok: true; readonly columns: readonly string[] }
  | { readonly ok: false; readonly unknown: readonly string[]; readonly pii: readonly string[] }

/**
 * Keep only allowlisted columns, in the order given; refuse unknown names, and refuse PII names on
 * a definition that does not carry `includes_pii`.
 */
export function validateColumns(
  entity: SheetEntity,
  columns: readonly string[],
  includesPii: boolean,
): ColumnValidation {
  const allowed = new Map(ENTITY_COLUMNS[entity].map((column) => [column.key, column]))
  const unknown = columns.filter((key) => !allowed.has(key))
  const pii = includesPii ? [] : columns.filter((key) => allowed.get(key)?.pii === true)
  if (unknown.length > 0 || pii.length > 0) return { ok: false, unknown, pii }
  const seen = new Set<string>()
  return {
    ok: true,
    columns: columns.filter((key) => (seen.has(key) ? false : (seen.add(key), true))),
  }
}

/** The fixed last header cell — what tells a reader the tab is generated. */
export const GENERATED_MARKER =
  'Generated by Rivya Studio — edits in this tab are overwritten on the next run'

export function headerRow(entity: SheetEntity, columns: readonly string[]): readonly string[] {
  const labels = new Map(ENTITY_COLUMNS[entity].map((column) => [column.key, column.label]))
  return [...columns.map((key) => labels.get(key) ?? key), GENERATED_MARKER]
}

/** Header plus rows, each row as wide as the header (the marker column is blank on data rows). */
export function cellCount(columns: readonly string[], rowCount: number): number {
  return (columns.length + 1) * (rowCount + 1)
}

// --- filters ------------------------------------------------------------------------------------

const uuid = z.string().uuid()

/** The filter each entity accepts — the same shape the Studio tables produce, nothing wider. */
export const FILTER_SCHEMAS: Readonly<Record<SheetEntity, z.ZodType<Record<string, unknown>>>> = {
  RESEARCH_PRODUCTS: z
    .object({
      sourceId: uuid.optional(),
      stage: z.string().optional(),
      disposition: z.string().optional(),
    })
    .strict(),
  COMPARISON_SET: z.object({}).strict(),
  OPPORTUNITY_SCORES: z
    .object({
      sourceId: uuid.optional(),
      state: z.enum(['SCORED', 'INSUFFICIENT_DATA']).optional(),
    })
    .strict(),
  SHORTLIST: z.object({ sourceId: uuid.optional() }).strict(),
  CONFIRMED: z.object({ includeArchived: z.boolean().optional() }).strict(),
  DIRECTION_BRIEFS: z.object({ status: z.string().optional() }).strict(),
  INQUIRIES: z
    .object({
      kind: z.string().optional(),
      status: z.string().optional(),
    })
    .strict(),
}

export function isSheetEntity(value: unknown): value is SheetEntity {
  return typeof value === 'string' && (SHEET_ENTITIES as readonly string[]).includes(value)
}

/** A cell as written: text, a number, or blank. Never an object — JSON is stringified first. */
export type Cell = string | number | null
