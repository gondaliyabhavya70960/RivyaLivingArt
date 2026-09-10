import { describe, expect, it } from 'vitest'

import { inverseOf } from '@/lib/relations/write'
import {
  RECIPROCAL_RELATION_TYPES,
  RELATION_VOCABULARY,
  isReciprocal,
} from '@/lib/supabase/schemas'

/**
 * The inverse edge: which types get one, and what it is called.
 *
 * THE BUG THIS FILE EXISTS FOR IS A NAMING ONE, and it is easy to write and hard to see. A
 * product's edge to a project is `PORTFOLIO_PROJECT` — the name describes what is at the far end —
 * so the project's edge back must be `RELATED_PRODUCT`, not `PORTFOLIO_PROJECT` again. Getting it
 * wrong produces a project that claims to be a portfolio project of itself, which renders as a
 * plausible-looking row nobody would question.
 *
 * IT IS A PURE FUNCTION AND IS TESTED AS ONE. The database half — that both rows are created in one
 * gesture, paired, and deleted together — is in `tests/unit/rls/phase23.test.ts`, because that is a
 * question about two tables and a policy rather than about two type names.
 */

describe('which relation types are reciprocal', () => {
  it('exactly three, and they are the three that describe a two-way editorial fact', () => {
    expect([...RECIPROCAL_RELATION_TYPES]).toEqual([
      'RELATED_PRODUCT',
      'PORTFOLIO_PROJECT',
      'JOURNAL_ARTICLE',
    ])
  })

  it('the other six are one-way, because the far end is not a thing that points back', () => {
    const oneWay = RELATION_VOCABULARY.filter((type) => !isReciprocal(type))
    expect([...oneWay]).toEqual([
      'DESIGN_FAMILY',
      'RESIN_STYLE',
      'WOOD_SPECIES',
      'CUSTOMIZATION_FORM',
      'MATERIAL_STORY',
      'DESIGN_DIRECTION',
    ])
  })
})

describe('inverseOf', () => {
  it('returns null for a one-way type', () => {
    expect(
      inverseOf({
        source: { type: 'product', id: 'p1' },
        targetType: 'attribute_term',
        targetId: 't1',
        relationType: 'WOOD_SPECIES',
      }),
    ).toBeNull()
  })

  it('swaps the ends of a product-to-product edge and keeps the name', () => {
    const inverse = inverseOf({
      source: { type: 'product', id: 'p1' },
      targetType: 'product',
      targetId: 'p2',
      relationType: 'RELATED_PRODUCT',
    })
    expect(inverse).toMatchObject({
      source: { type: 'product', id: 'p2' },
      targetType: 'product',
      targetId: 'p1',
      relationType: 'RELATED_PRODUCT',
    })
  })

  it('RENAMES the edge when the two ends are different kinds — the bug this file is for', () => {
    const inverse = inverseOf({
      source: { type: 'product', id: 'p1' },
      targetType: 'portfolio',
      targetId: 'j1',
      relationType: 'PORTFOLIO_PROJECT',
    })
    expect(inverse?.source).toEqual({ type: 'portfolio_project', id: 'j1' })
    expect(inverse?.targetType).toBe('product')
    expect(inverse?.targetId).toBe('p1')
    // NOT 'PORTFOLIO_PROJECT': the project's edge points at a product.
    expect(inverse?.relationType).toBe('RELATED_PRODUCT')
  })

  it('does the same for a journal edge', () => {
    const inverse = inverseOf({
      source: { type: 'product', id: 'p1' },
      targetType: 'journal',
      targetId: 'a1',
      relationType: 'JOURNAL_ARTICLE',
    })
    expect(inverse?.source).toEqual({ type: 'journal_article', id: 'a1' })
    expect(inverse?.relationType).toBe('RELATED_PRODUCT')
  })

  it('carries the rule key onto the inverse, so both halves record where they came from', () => {
    const inverse = inverseOf({
      source: { type: 'product', id: 'p1' },
      targetType: 'product',
      targetId: 'p2',
      relationType: 'RELATED_PRODUCT',
      ruleKey: 'shared-materials',
    })
    expect(inverse?.ruleKey).toBe('shared-materials')
  })

  it('returns null when the far end cannot BE a source — a material has no edges of its own', () => {
    expect(
      inverseOf({
        source: { type: 'product', id: 'p1' },
        targetType: 'material',
        targetId: 'm1',
        relationType: 'RELATED_PRODUCT',
      }),
    ).toBeNull()
  })

  it('applying it twice returns to the original edge', () => {
    const original = {
      source: { type: 'product', id: 'p1' },
      targetType: 'portfolio',
      targetId: 'j1',
      relationType: 'PORTFOLIO_PROJECT',
    } as const
    const back = inverseOf(inverseOf(original)!)
    expect(back).toMatchObject({
      source: { type: 'product', id: 'p1' },
      targetType: 'portfolio',
      targetId: 'j1',
      relationType: 'PORTFOLIO_PROJECT',
    })
  })
})
