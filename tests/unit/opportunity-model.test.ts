import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  MODEL_V1,
  scoringModelDocumentSchema,
  SIGNAL_KEYS,
  weightsOf,
} from '@/lib/scraper/analytics/opportunity/model'

/**
 * The model document: weights sum to 100, keys are the seven, and the seeded SQL agrees with the
 * TypeScript twin key for key and weight for weight.
 */

const ROOT = resolve(import.meta.dirname, '..', '..')

describe('scoring model document', () => {
  it('accepts v1 and sums its weights to 100', () => {
    expect(scoringModelDocumentSchema.safeParse(MODEL_V1).success).toBe(true)
    expect(MODEL_V1.reduce((sum, signal) => sum + signal.weight, 0)).toBe(100)
  })

  it('refuses weights that do not sum to 100, a duplicate key, and an eighth key', () => {
    const off = MODEL_V1.map((signal, index) =>
      index === 0 ? { ...signal, weight: signal.weight + 1 } : signal,
    )
    expect(scoringModelDocumentSchema.safeParse(off).success).toBe(false)
    expect(scoringModelDocumentSchema.safeParse([...MODEL_V1, MODEL_V1[0]]).success).toBe(false)
    expect(
      scoringModelDocumentSchema.safeParse([{ ...MODEL_V1[0], key: 'embedding_similarity' }])
        .success,
    ).toBe(false)
  })

  it('weighs a missing key at zero', () => {
    const weights = weightsOf({ signals: [MODEL_V1[0]!, { ...MODEL_V1[1]!, weight: 80 }] })
    expect(weights.category_gap).toBe(20)
    expect(weights.material_adjacency).toBe(0)
  })

  it('matches the seeded migration 0302 key for key and weight for weight', () => {
    const sql = readFileSync(join(ROOT, 'supabase/migrations/0302_phase32_model_v1.sql'), 'utf8')
    for (const signal of MODEL_V1) {
      const pattern = new RegExp(
        `"key":\\s*"${signal.key}",\\s*"weight":\\s*${String(signal.weight)}\\b`,
        'u',
      )
      expect(sql).toMatch(pattern)
    }
    expect(SIGNAL_KEYS.every((key) => sql.includes(`"key": "${key}"`))).toBe(true)
    expect(sql).toMatch(/'DRAFT'\s*\)/u)
  })
})
