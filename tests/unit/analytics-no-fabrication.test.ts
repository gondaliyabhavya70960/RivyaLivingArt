import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { trendPoints } from '@/components/studio/analytics/MetricTrend'
import { METRICS } from '@/lib/analytics/metrics'
import { emptyAnalyticsReads } from '@/lib/analytics/reads'
import { runSnapshots, type SnapshotWriter } from '@/lib/analytics/snapshot'
import {
  analyticsSnapshotInputSchema,
  type AnalyticsSnapshotInput,
  type AnalyticsSnapshotRow,
} from '@/lib/supabase/schemas/analytics'

/**
 * Do not manufacture unavailable analytics data — FEAT §28's last line, Phase 37's first risk.
 *
 * THE WHOLE REGISTRY IS RUN AGAINST AN EMPTY DATABASE — the in-memory `emptyAnalyticsReads()`,
 * which answers every read with nothing — and every outcome must be one of two honest things: a
 * true zero with n = 0, or UNAVAILABLE with a named reason. Not a sample figure, not a dash, not an
 * interpolation. The same suite proves the writer's rows satisfy the CHECK before they reach the
 * database, that a second run for one date updates rather than duplicates, that a trend needs two
 * points, and that no seed or fixture in the repository inserts an analytics row.
 */

function* walk(dir: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx|mjs|sql|json)$/u.test(entry)) yield full
  }
}

class RecordingWriter implements SnapshotWriter {
  readonly rows = new Map<string, AnalyticsSnapshotInput>()
  upserts = 0
  async upsert(row: AnalyticsSnapshotInput): Promise<void> {
    this.upserts += 1
    this.rows.set(`${row.metricId}:${row.asOf}`, row)
  }
  async prune(): Promise<number> {
    return 0
  }
}

describe('against an empty database', () => {
  it('every metric is a true zero with n = 0 or UNAVAILABLE with a reason', async () => {
    const result = await runSnapshots(emptyAnalyticsReads(), null, {
      now: new Date('2026-09-11T04:00:00Z'),
    })
    expect(result.lines).toHaveLength(METRICS.length)
    for (const line of result.lines) {
      if (line.availability === 'AVAILABLE') {
        expect(line.n, line.id).toBe(0)
        expect(line.figure, line.id).toBe(0)
      } else {
        expect(line.reason, line.id).toBeTruthy()
        expect((line.reason ?? '').trim().length, line.id).toBeGreaterThan(8)
        expect(line.figure, line.id).toBeNull()
      }
    }
  })

  it('names why each unavailable metric is unavailable, never "no data"', async () => {
    const result = await runSnapshots(emptyAnalyticsReads(), null)
    const reasons = new Map(result.lines.map((line) => [line.id, line.reason]))
    expect(reasons.get('product_scale')).toBe('no product dimensions recorded')
    expect(reasons.get('large_format_share')).toBe('no published product')
    expect(reasons.get('inquiry_trends')).toBe('no enquiry recorded')
    expect(reasons.get('assortment')).toMatch(/^no successful run in the last 30 days/u)
    expect(reasons.get('resin_styles')).toMatch(/^no enabled adapter captures resin style/u)
    expect(reasons.get('materials')).toMatch(/^no enabled adapter captures materials/u)
    expect(reasons.get('opportunity_scores')).toMatch(/^no ACTIVE scoring model/u)
    for (const reason of reasons.values()) {
      if (reason !== null) expect(reason.toLowerCase()).not.toBe('no data')
    }
  })

  it('writes rows the CHECK constraint would accept, and updates rather than duplicates', async () => {
    const writer = new RecordingWriter()
    const options = { date: '2026-09-11', now: new Date('2026-09-11T04:00:00Z') }
    await runSnapshots(emptyAnalyticsReads(), writer, options)
    await runSnapshots(emptyAnalyticsReads(), writer, options)
    expect(writer.upserts).toBe(METRICS.length * 2)
    expect(writer.rows.size).toBe(METRICS.length)
    for (const row of writer.rows.values()) {
      const parsed = analyticsSnapshotInputSchema.safeParse(row)
      expect(parsed.success, row.metricId).toBe(true)
      expect((row.availability === 'UNAVAILABLE') === (row.unavailableReason !== null)).toBe(true)
    }
  })

  it('draws no trend through one point', () => {
    const row = (asOf: string, figure: number | null): AnalyticsSnapshotRow => ({
      id: '00000000-0000-4000-8000-000000003701',
      metric_id: 'catalog',
      dimension: 'FIRST_PARTY',
      as_of: asOf,
      value: { figure, unit: 'count' },
      n: 0,
      denominator: 0,
      availability: figure === null ? 'UNAVAILABLE' : 'AVAILABLE',
      unavailable_reason: figure === null ? 'not measured' : null,
      computed_at: `${asOf}T04:00:00Z`,
      computed_by: null,
    })
    expect(trendPoints([row('2026-09-10', 3)])).toBeNull()
    expect(trendPoints([row('2026-09-10', 3), row('2026-09-11', null)])).toBeNull()
    expect(trendPoints([row('2026-09-11', 4), row('2026-09-10', 3)])).toEqual([
      { label: '2026-09-10', value: 3 },
      { label: '2026-09-11', value: 4 },
    ])
  })

  it('has no seed, fixture or demo that inserts an analytics row', () => {
    const offenders: string[] = []
    for (const root of [
      'content/seed',
      'scripts/demo',
      'scripts/seed',
      'tests/unit/rls/harness.ts',
    ]) {
      const files = statSync(root).isDirectory() ? [...walk(root)] : [root]
      for (const file of files) {
        if (/analytics_snapshots/u.test(readFileSync(file, 'utf8'))) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
