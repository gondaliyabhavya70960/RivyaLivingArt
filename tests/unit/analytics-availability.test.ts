import { describe, expect, it } from 'vitest'

import {
  RECENT_RUN_DAYS,
  resolveAvailability,
  type AvailabilityFacts,
} from '@/lib/analytics/availability'
import { metricById } from '@/lib/analytics/metrics'

/**
 * Every reason the resolver can give, proved to be given — Phase 37. The point of an UNAVAILABLE
 * tile is the sentence on it, so the sentence is what is tested: the missing table by name, the
 * attribute key with the sources that would need it, the capability nobody has declared.
 */

const enabledSource = {
  id: 's1',
  slug: 'modern-forms',
  name: 'Modern Forms',
  isEnabled: true,
  adapterKey: 'generic',
  attributeKeys: ['dimensions', 'materials'],
}

const facts = (overrides: Partial<AvailabilityFacts> = {}): AvailabilityFacts => ({
  tables: ['products', 'research_products', 'research_sources'],
  sources: [enabledSource],
  adapters: [{ key: 'generic', capabilities: ['DISCOVER', 'EXTRACT'] }],
  successfulRunsInWindow: 1,
  hasActiveModel: true,
  ...overrides,
})

describe('resolveAvailability', () => {
  it('passes a metric whose tables exist and whose needs are met', () => {
    expect(resolveAvailability({ tables: ['products'] }, facts())).toEqual({ ok: true })
  })

  it('names a table that does not exist yet', () => {
    const verdict = resolveAvailability({ tables: ['web_vitals_samples'] }, facts())
    expect(verdict).toEqual({ ok: false, reason: 'table web_vitals_samples does not exist yet' })
  })

  it('admits an attribute one enabled source extracts under an EXTRACT adapter', () => {
    expect(
      resolveAvailability(
        {
          tables: ['research_products'],
          attributeKeys: [{ key: 'materials', label: 'materials' }],
        },
        facts(),
      ),
    ).toEqual({ ok: true })
  })

  it('names the sources that would need to extract a key none is configured for', () => {
    const verdict = resolveAvailability(
      {
        tables: ['research_products'],
        attributeKeys: [{ key: 'customization', label: 'customisation' }],
      },
      facts(),
    )
    expect(verdict.ok).toBe(false)
    if (verdict.ok) return
    expect(verdict.reason).toContain('no enabled adapter captures customisation')
    expect(verdict.reason).toContain('modern-forms')
    expect(verdict.reason).toContain('"customization"')
  })

  it('does not count a disabled source, and says when none is enabled', () => {
    const verdict = resolveAvailability(
      { tables: ['research_products'], attributeKeys: [{ key: 'materials', label: 'materials' }] },
      facts({ sources: [{ ...enabledSource, isEnabled: false }] }),
    )
    expect(verdict.ok).toBe(false)
    if (verdict.ok) return
    expect(verdict.reason).toContain('no research source is enabled')
  })

  it('does not count a source whose adapter declares no EXTRACT capability', () => {
    const verdict = resolveAvailability(
      { tables: ['research_products'], attributeKeys: [{ key: 'materials', label: 'materials' }] },
      facts({ adapters: [{ key: 'generic', capabilities: ['DISCOVER'] }] }),
    )
    expect(verdict.ok).toBe(false)
  })

  it('states the missing capability and the Phase 26/27 change for resin style, colour and production model', () => {
    for (const id of ['resin_styles', 'colours', 'production_model'] as const) {
      const verdict = resolveAvailability(metricById(id).requires, facts())
      expect(verdict.ok, id).toBe(false)
      if (verdict.ok) continue
      expect(verdict.reason).toMatch(
        /^no enabled adapter captures (resin style|colour|production model)/u,
      )
      expect(verdict.reason).toContain('Phase 26/27')
      expect(verdict.reason).toContain('modern-forms')
    }
  })

  it('requires a successful run in the window for the Phase 31 readings', () => {
    const verdict = resolveAvailability(
      metricById('assortment').requires,
      facts({
        tables: ['research_analytics_snapshots', 'research_runs'],
        successfulRunsInWindow: 0,
      }),
    )
    expect(verdict).toEqual({
      ok: false,
      reason: `no successful run in the last ${String(RECENT_RUN_DAYS)} days; sources: modern-forms`,
    })
  })

  it('requires an ACTIVE model for opportunity scores', () => {
    const verdict = resolveAvailability(
      metricById('opportunity_scores').requires,
      facts({
        tables: ['research_opportunity_scores', 'research_scoring_models'],
        hasActiveModel: false,
      }),
    )
    expect(verdict.ok).toBe(false)
    if (verdict.ok) return
    expect(verdict.reason).toContain('no ACTIVE scoring model')
  })
})
