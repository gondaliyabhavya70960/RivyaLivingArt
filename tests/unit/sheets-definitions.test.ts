import { describe, expect, it } from 'vitest'

import {
  ENTITY_COLUMNS,
  FILTER_SCHEMAS,
  GENERATED_MARKER,
  cellCount,
  defaultColumns,
  extraRunPermission,
  headerRow,
  piiColumns,
  requiresScope,
  validateColumns,
} from '@/lib/sheets/definitions'
import { SHEET_ENTITIES } from '@/lib/supabase/schemas/sheets'

/**
 * The column allowlist — Phase 36, verification 2. An arbitrary column name is rejected; PII
 * columns exist on INQUIRIES only and are refused without the flag; no media, secret or log column
 * exists anywhere; the header ends with the fixed generated-tab marker.
 */

describe('the per-entity allowlist', () => {
  it('covers exactly the seven entities', () => {
    expect(Object.keys(ENTITY_COLUMNS).sort()).toEqual([...SHEET_ENTITIES].sort())
    for (const entity of SHEET_ENTITIES) expect(ENTITY_COLUMNS[entity].length).toBeGreaterThan(0)
  })

  it('rejects an unknown column and accepts the defaults', () => {
    for (const entity of SHEET_ENTITIES) {
      const defaults = defaultColumns(entity)
      expect(validateColumns(entity, defaults, false)).toEqual({ ok: true, columns: defaults })
      const widened = validateColumns(entity, [...defaults, 'private_key'], false)
      expect(widened.ok).toBe(false)
      if (!widened.ok) expect(widened.unknown).toEqual(['private_key'])
    }
  })

  it('names no media, secret, log or staff column', () => {
    const forbidden = /media|cloudinary|asset|secret|key|token|password|audit|system_log|staff/iu
    for (const entity of SHEET_ENTITIES) {
      for (const column of ENTITY_COLUMNS[entity]) {
        expect(column.key, `${entity}.${column.key}`).not.toMatch(forbidden)
      }
    }
  })

  it('keeps personal data on INQUIRIES only, behind the flag', () => {
    for (const entity of SHEET_ENTITIES) {
      if (entity === 'INQUIRIES') {
        expect([...piiColumns(entity)].sort()).toEqual(['email', 'name', 'phone'])
      } else {
        expect(piiColumns(entity)).toEqual([])
      }
    }
    const refused = validateColumns('INQUIRIES', ['reference_code', 'phone'], false)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.pii).toEqual(['phone'])
    expect(validateColumns('INQUIRIES', ['reference_code', 'phone'], true).ok).toBe(true)
    // The defaults never include a PII column, flag or no flag.
    expect(defaultColumns('INQUIRIES')).not.toContain('phone')
  })

  it('de-duplicates while keeping order', () => {
    const result = validateColumns('SHORTLIST', ['reason', 'source', 'reason'], false)
    expect(result).toEqual({ ok: true, columns: ['reason', 'source'] })
  })

  it('ends every header with the generated-tab marker and counts cells with it', () => {
    const header = headerRow('CONFIRMED', ['decision_note', 'confirmed_at'])
    expect(header).toEqual(['Decision note', 'Confirmed', GENERATED_MARKER])
    expect(cellCount(['decision_note', 'confirmed_at'], 10)).toBe(3 * 11)
  })

  it('knows which entity needs a scope and which needs the enquiry permission', () => {
    expect(SHEET_ENTITIES.filter(requiresScope)).toEqual(['COMPARISON_SET'])
    expect(extraRunPermission('INQUIRIES')).toBe('inquiries.export')
    for (const entity of SHEET_ENTITIES.filter((e) => e !== 'INQUIRIES')) {
      expect(extraRunPermission(entity)).toBe('research.read')
    }
  })

  it('refuses a filter key the entity does not take', () => {
    expect(FILTER_SCHEMAS.RESEARCH_PRODUCTS.safeParse({ sourceId: 'not-a-uuid' }).success).toBe(
      false,
    )
    expect(FILTER_SCHEMAS.RESEARCH_PRODUCTS.safeParse({ anything: 1 }).success).toBe(false)
    expect(FILTER_SCHEMAS.CONFIRMED.safeParse({ includeArchived: true }).success).toBe(true)
    expect(FILTER_SCHEMAS.COMPARISON_SET.safeParse({}).success).toBe(true)
  })
})
