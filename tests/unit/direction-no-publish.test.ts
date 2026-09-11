import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  BRIEF_SECTIONS,
  BRIEF_STATUSES,
  briefBodyInputSchema,
  directionBriefRowSchema,
} from '@/lib/supabase/schemas/research-direction'

/**
 * A brief cannot reach PUBLISHED — in the Zod schema (this file), in the database (0320's CHECK,
 * exercised by tests/unit/rls/phase34.test.ts) and in the UI (no control offers it). And the brief
 * schema carries no Rivya price, dimension, material or lead-time field: a specification is not a
 * brief, and the risk table's first row is a brief drifting into one.
 */

const ROW = {
  id: '00000000-0000-4000-8000-000000003401',
  slug: 'low-table-in-ash',
  title: 'A low table in ash',
  intent: null,
  scale_intent: null,
  form_language: null,
  material_direction: null,
  finish_direction: null,
  constraints: null,
  open_questions: null,
  not_doing: null,
  target_category_slug: 'furniture',
  status: 'DRAFT',
  owner_verification: 'NOT_REQUIRED',
  fact_classification: 'EDITORIAL_COPY',
  approved_at: null,
  approved_by: null,
  created_at: '2026-09-11T00:00:00Z',
  created_by: null,
  updated_at: '2026-09-11T00:00:00Z',
  updated_by: null,
}

describe('the brief lifecycle', () => {
  it('names four statuses and PUBLISHED is not one of them', () => {
    expect([...BRIEF_STATUSES]).toEqual(['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'])
    expect(BRIEF_STATUSES as readonly string[]).not.toContain('PUBLISHED')
  })

  it('refuses a PUBLISHED row on the way out', () => {
    expect(directionBriefRowSchema.safeParse(ROW).success).toBe(true)
    expect(directionBriefRowSchema.safeParse({ ...ROW, status: 'PUBLISHED' }).success).toBe(false)
  })

  it('the migration refuses PUBLISHED at the row and has no price, dimension or lead-time column', () => {
    const sql = readFileSync('supabase/migrations/0320_phase34_direction_briefs.sql', 'utf8')
    expect(sql).toMatch(/check \(status in \('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'\)\)/u)
    const table = sql.slice(
      sql.indexOf('create table research_direction_briefs'),
      sql.indexOf('create index research_direction_briefs_status_idx'),
    )
    for (const forbidden of [
      'price',
      'dimension',
      'width',
      'height',
      'depth',
      'lead_time',
      'material_id',
      'tolerance',
      'numeric',
      'integer',
    ]) {
      expect(table.toLowerCase()).not.toContain(forbidden)
    }
  })
})

describe('the brief body', () => {
  it('is the title, the nine sections and a checked category — and nothing numeric', () => {
    expect([...BRIEF_SECTIONS]).toHaveLength(8)
    const ok = briefBodyInputSchema.safeParse({
      title: 'A low table in ash',
      intent: 'why now',
      scale_intent: 'dining-table scale, longest axis around two metres',
      form_language: null,
      material_direction: null,
      finish_direction: null,
      constraints: null,
      open_questions: null,
      not_doing: null,
      target_category_slug: 'furniture',
    })
    expect(ok.success).toBe(true)
  })

  it('rejects any dimension, price or lead-time field, and an unknown category', () => {
    const base = {
      title: 'x',
      intent: null,
      scale_intent: null,
      form_language: null,
      material_direction: null,
      finish_direction: null,
      constraints: null,
      open_questions: null,
      not_doing: null,
      target_category_slug: null,
    }
    for (const extra of [
      { length_mm: 2000 },
      { width_mm: 900 },
      { price_minor: 120000 },
      { lead_time_days: 30 },
      { dimensions_mm: { w: 1, h: 2, d: 3 } },
      { status: 'PUBLISHED' },
    ]) {
      expect(briefBodyInputSchema.safeParse({ ...base, ...extra }).success).toBe(false)
    }
    expect(briefBodyInputSchema.safeParse({ ...base, target_category_slug: 'sofas' }).success).toBe(
      false,
    )
    expect(briefBodyInputSchema.safeParse({ ...base, title: '   ' }).success).toBe(false)
  })
})
