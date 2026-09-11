import { z } from 'zod'

import { D3_CATEGORY_SLUGS } from '@/lib/cms/merchandising-register'
import { EVIDENCE_TYPES } from '@/lib/scraper/analytics/direction/capture'

/**
 * Zod for every Phase 34 table, at the repository boundary.
 *
 * `PUBLISHED` IS ABSENT AT THE TYPE LEVEL. `BRIEF_STATUSES` is the four-value list, so a row that
 * somehow carried PUBLISHED would fail to parse on the way out and could never be written on the
 * way in — the same rule the CHECK constraint holds at the table, held again here.
 *
 * THERE IS NO NUMERIC DIMENSION, PRICE, MATERIAL OR LEAD-TIME FIELD, and a unit test asserts the
 * schema rejects one: a brief is what a maker reads before sketching, never a specification.
 */

export const BRIEF_STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'] as const
export type BriefStatus = (typeof BRIEF_STATUSES)[number]

export const BRIEF_SECTIONS = [
  'intent',
  'scale_intent',
  'form_language',
  'material_direction',
  'finish_direction',
  'constraints',
  'open_questions',
  'not_doing',
] as const
export type BriefSection = (typeof BRIEF_SECTIONS)[number]

const prose = z.string().max(20_000).nullable()

export const directionBriefRowSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    title: z.string().min(1),
    intent: prose,
    scale_intent: prose,
    form_language: prose,
    material_direction: prose,
    finish_direction: prose,
    constraints: prose,
    open_questions: prose,
    not_doing: prose,
    target_category_slug: z.enum(D3_CATEGORY_SLUGS).nullable(),
    status: z.enum(BRIEF_STATUSES),
    owner_verification: z.string(),
    fact_classification: z.string(),
    approved_at: z.string().nullable(),
    approved_by: z.string().uuid().nullable(),
    created_at: z.string(),
    created_by: z.string().uuid().nullable(),
    updated_at: z.string(),
    updated_by: z.string().uuid().nullable(),
  })
  .strict()
export type DirectionBriefRow = z.infer<typeof directionBriefRowSchema>

/** What the editor may write: the title, the nine sections, the category. Nothing else. */
export const briefBodyInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    intent: prose,
    scale_intent: prose,
    form_language: prose,
    material_direction: prose,
    finish_direction: prose,
    constraints: prose,
    open_questions: prose,
    not_doing: prose,
    target_category_slug: z.enum(D3_CATEGORY_SLUGS).nullable(),
  })
  .strict()
export type BriefBodyInput = z.infer<typeof briefBodyInputSchema>

export const briefEvidenceRowSchema = z.object({
  id: z.string().uuid(),
  brief_id: z.string().uuid(),
  evidence_type: z.enum(EVIDENCE_TYPES),
  evidence_id: z.string().uuid(),
  captured: z.record(z.string(), z.unknown()),
  rationale: z.string().min(1),
  position: z.number().int().nonnegative(),
  created_at: z.string(),
  created_by: z.string().uuid(),
})
export type BriefEvidenceRow = z.infer<typeof briefEvidenceRowSchema>

export const briefRevisionRowSchema = z.object({
  id: z.string().uuid(),
  brief_id: z.string().uuid(),
  revision: z.number().int().positive(),
  action: z.enum(['CREATE', 'UPDATE', 'STATUS_CHANGE', 'RESTORE']),
  body: z.record(z.string(), z.unknown()),
  note: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
})
export type BriefRevisionRow = z.infer<typeof briefRevisionRowSchema>
