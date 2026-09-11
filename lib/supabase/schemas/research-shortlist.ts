import { z } from 'zod'

/**
 * Zod for the two Phase 35 decision records, at the repository boundary.
 *
 * `reason` and `decision_note` are `min(1)` after trimming — the same rule the CHECK constraints
 * hold at the table — so a blank decision fails in the action with a sentence rather than at the
 * database with a constraint name.
 */

export const shortlistEntryRowSchema = z.object({
  id: z.string().uuid(),
  research_product_id: z.string().uuid(),
  reason: z.string().trim().min(1),
  captured: z.record(z.string(), z.unknown()),
  brief_id: z.string().uuid().nullable(),
  opened_at: z.string(),
  opened_by: z.string().uuid(),
  closed_at: z.string().nullable(),
  closed_reason: z.string().nullable(),
  closed_by: z.string().uuid().nullable(),
})
export type ShortlistEntryRow = z.infer<typeof shortlistEntryRowSchema>

export const confirmationRowSchema = z.object({
  id: z.string().uuid(),
  research_product_id: z.string().uuid(),
  decision_note: z.string().trim().min(1),
  brief_id: z.string().uuid().nullable(),
  confirmed_at: z.string(),
  confirmed_by: z.string().uuid(),
  created_product_id: z.string().uuid().nullable(),
  product_started_at: z.string().nullable(),
  product_started_by: z.string().uuid().nullable(),
  archived_at: z.string().nullable(),
  archived_reason: z.string().nullable(),
})
export type ConfirmationRow = z.infer<typeof confirmationRowSchema>

/** The score as it stood at shortlisting: numbers copied from a research row, never prose. */
export const shortlistCaptureSchema = z.object({
  score: z.number().int().nullable(),
  confidence: z.number().nullable(),
  modelVersion: z.string().nullable(),
  scoredAt: z.string().nullable(),
})
export type ShortlistCapture = z.infer<typeof shortlistCaptureSchema>

/**
 * The bridge's projection: exactly three fields, none of them competitor text. `stage` is here so
 * the action can refuse a row that is not CONFIRMED; `archived_at` so it can refuse a retired
 * decision. Nothing else is in scope to copy.
 */
export const confirmationForBridgeSchema = z
  .object({
    id: z.string().uuid(),
    stage: z.string(),
    archived_at: z.string().nullable(),
  })
  // STRICT, so a wider select fails at the schema before it reaches the insert. The isolation
  // guard fails the build on a wider import; this fails the request on a wider row.
  .strict()
export type ConfirmationForBridge = z.infer<typeof confirmationForBridgeSchema>
