import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { STUDIO_STRINGS } from '@/components/studio/strings'
import {
  COMPETITIVE_METRIC_IDS,
  FIRST_PARTY_METRIC_IDS,
  METRIC_IDS,
  METRICS,
  metricById,
} from '@/lib/analytics/metrics'
import { FLAGS } from '@/lib/flags/flags'
import { MANAGED_TABLES } from '@/lib/auth/table-permissions'

/**
 * The registry holds exactly the eighteen FEAT §28 metrics — Phase 37.
 *
 * THE LIST IS WRITTEN OUT HERE FROM THE SPECIFICATION, not imported, so a renamed or added id fails
 * this test rather than silently becoming "one of the metrics". The definitions are held to the
 * guide byte for byte for the same reason: the sentence a tile shows is the sentence the owner
 * reads in the documentation, or the documentation is wrong.
 */

const FEAT_28_FIRST_PARTY = [
  'catalog',
  'product_categories',
  'product_scale',
  'large_format_share',
  'collection_mix',
  'inquiry_trends',
  'content_performance',
  'media_coverage',
]
const FEAT_28_COMPETITIVE = [
  'assortment',
  'price_architecture',
  'dimensions',
  'materials',
  'resin_styles',
  'colours',
  'customization',
  'production_model',
  'opportunity_scores',
  'source_freshness',
]

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx|mjs)$/u.test(entry) && !/\.test\.tsx?$/u.test(entry)) yield full
  }
}

describe('the metric registry', () => {
  it('contains exactly the eighteen FEAT §28 ids, in order', () => {
    expect([...FIRST_PARTY_METRIC_IDS]).toEqual(FEAT_28_FIRST_PARTY)
    expect([...COMPETITIVE_METRIC_IDS]).toEqual(FEAT_28_COMPETITIVE)
    expect(METRICS.map((metric) => metric.id)).toEqual([...METRIC_IDS])
    expect(new Set(METRIC_IDS).size).toBe(18)
  })

  it('declares the dimension the specification gives each metric', () => {
    for (const metric of METRICS) {
      const expected = FEAT_28_FIRST_PARTY.includes(metric.id) ? 'FIRST_PARTY' : 'COMPETITIVE'
      expect(metric.dimension, metric.id).toBe(expected)
    }
  })

  it('gives every metric a definition, a coverage rule, a label and a requirement', () => {
    for (const metric of METRICS) {
      expect(metric.definition.length, metric.id).toBeGreaterThan(20)
      expect(metric.coverage.length, metric.id).toBeGreaterThan(5)
      expect(STUDIO_STRINGS, metric.id).toHaveProperty(metric.labelKey)
      expect(metric.availableFrom, metric.id).toBeLessThanOrEqual(37)
      expect(metric.requires.tables.length, metric.id).toBeGreaterThan(0)
      for (const table of metric.requires.tables) {
        expect(MANAGED_TABLES as readonly string[], `${metric.id} names ${table}`).toContain(table)
      }
    }
  })

  it('prints every definition verbatim in STUDIO_GUIDE.md', () => {
    const guide = readFileSync('docs/studio/STUDIO_GUIDE.md', 'utf8')
    for (const metric of METRICS) {
      expect(guide, `${metric.id}: "${metric.definition}"`).toContain(metric.definition)
    }
  })

  it('says, in content_performance, that it is not traffic', () => {
    expect(metricById('content_performance').definition).toMatch(/not traffic/u)
    expect(metricById('content_performance').definition).toMatch(/No web-analytics provider/u)
  })

  it('calls compute() from the snapshot writer and nowhere else', () => {
    const callers: string[] = []
    for (const root of ['lib', 'app', 'components', 'scripts']) {
      for (const file of walk(root)) {
        const source = readFileSync(file, 'utf8')
        if (/\.compute\(/u.test(source)) callers.push(file.split('\\').join('/'))
      }
    }
    expect(callers).toEqual(['lib/analytics/snapshot.ts'])
  })

  it('registers the advanced_analytics flag', () => {
    expect(FLAGS).toHaveProperty('advanced_analytics')
  })
})
