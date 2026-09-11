import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  findOperation,
  isAvailable,
  registerBulkOperation,
  registeredOperations,
  resetBulkOperations,
} from '@/lib/bulk/registry'
import { BATCH_SIZE, MAX_SELECTION, UNDO_WINDOW_HOURS } from '@/lib/bulk/types'
import { stripCommentsAndStrings } from '@/scripts/db/strip-code.mjs'

/**
 * The engine's contract, asserted without a database.
 *
 * WHAT IS WORTH TESTING HERE IS THE SHAPE, NOT THE SQL. Whether a publish actually publishes is a
 * question for `tests/unit/rls/phase24.test.ts` against a real PostgreSQL; whether every registered
 * operation CAN be previewed, whether the destructive flags are right, and whether anything outside
 * the engine mutates in bulk are questions about the code, and they are the ones a later phase is
 * most likely to break.
 */

describe('the registry', () => {
  beforeEach(() => {
    resetBulkOperations()
  })

  it('registers and finds an operation by kind', () => {
    registerBulkOperation({
      kind: 'test.thing',
      targetEntity: 'product',
      paramsSchema: z.object({}),
      isDestructive: false,
      preview: async () => [],
      applyItem: async () => ({ before: null, after: null, rowVersionForUndo: null }),
    })
    expect(findOperation('test.thing')?.kind).toBe('test.thing')
  })

  it('returns null for a kind nobody registered', () => {
    expect(findOperation('test.absent')).toBeNull()
  })

  it('treats an operation with no `available` as available', () => {
    registerBulkOperation({
      kind: 'test.default',
      targetEntity: 'product',
      paramsSchema: z.object({}),
      isDestructive: false,
      preview: async () => [],
      applyItem: async () => ({ before: null, after: null, rowVersionForUndo: null }),
    })
    expect(isAvailable(findOperation('test.default')!)).toBe(true)
  })

  it('treats `available: false` as unavailable', () => {
    registerBulkOperation({
      kind: 'test.later',
      targetEntity: 'research_product',
      paramsSchema: z.object({}),
      isDestructive: false,
      available: false,
      owningPhase: 29,
      preview: async () => [],
      applyItem: async () => ({ before: null, after: null, rowVersionForUndo: null }),
    })
    expect(isAvailable(findOperation('test.later')!)).toBe(false)
  })

  it('lets a re-registration win rather than throwing, so hot reload does not crash', () => {
    const base = {
      kind: 'test.dup',
      targetEntity: 'product' as const,
      paramsSchema: z.object({}),
      isDestructive: false,
      preview: async () => [],
      applyItem: async () => ({ before: null, after: null, rowVersionForUndo: null }),
    }
    registerBulkOperation(base)
    registerBulkOperation({ ...base, isDestructive: true })
    expect(registeredOperations()).toHaveLength(1)
    expect(findOperation('test.dup')?.isDestructive).toBe(true)
  })
})

describe('every shipped operation', () => {
  beforeEach(async () => {
    resetBulkOperations()
    const { loadBulkOperations } = await import('@/lib/bulk/registry')
    await loadBulkOperations()
  })

  it('registers the eleven Phase 24 kinds', async () => {
    const kinds = registeredOperations().map((operation) => operation.kind)
    expect(kinds).toEqual([
      'media.archive',
      'media.move',
      'media.tag',
      'product.archive',
      'product.assign_media',
      'product.import',
      'product.publish',
      'product.set_category',
      'product.set_collections',
      'product.set_materials',
      'product.set_status',
      'product.set_tags',
      'product.unpublish',
      'research.confirm',
      'research.mark_duplicate',
      'research.reject',
      'research.set_tags',
      'research.shortlist',
    ])
  })

  it('gives every one a preview, an applyItem and a params schema', () => {
    for (const operation of registeredOperations()) {
      expect(typeof operation.preview, operation.kind).toBe('function')
      expect(typeof operation.applyItem, operation.kind).toBe('function')
      expect(operation.paramsSchema, operation.kind).toBeDefined()
    }
  })

  /** The list this repository would most regret getting wrong. */
  it('marks every removal destructive', () => {
    for (const kind of [
      'product.unpublish',
      'product.archive',
      'media.archive',
      'research.reject',
    ]) {
      const operation = findOperation(kind)
      expect(operation, kind).not.toBeNull()
      const flag =
        typeof operation!.isDestructive === 'function'
          ? operation!.isDestructive({} as never)
          : operation!.isDestructive
      expect(flag, kind).toBe(true)
    }
  })

  it('marks the ordinary edits non-destructive', () => {
    for (const kind of ['product.publish', 'product.set_category', 'media.tag', 'media.move']) {
      const operation = findOperation(kind)
      const flag =
        typeof operation!.isDestructive === 'function'
          ? operation!.isDestructive({} as never)
          : operation!.isDestructive
      expect(flag, kind).toBe(false)
    }
  })

  /**
   * `product.set_status` IS THE CONDITIONAL ONE, and this is the assertion that keeps it honest:
   * moving a row to PUBLISHED is an ordinary edit; every other target takes a live page off the
   * site and needs the owner's permission and a typed count.
   */
  it('makes set_status destructive only when it is not publishing', () => {
    const operation = findOperation('product.set_status')!
    const flag = operation.isDestructive as (params: { status: string }) => boolean
    expect(flag({ status: 'PUBLISHED' })).toBe(false)
    expect(flag({ status: 'DRAFT' })).toBe(true)
    expect(flag({ status: 'REVIEW' })).toBe(true)
  })

  /**
   * Phase 24 registered these five unavailable and asserted exactly that; Phase 29 implemented them
   * and this assertion moved with them.
   *
   * IT IS THE SAME TEST TURNED ROUND, WHICH IS THE POINT. The registration existed so that the
   * phase implementing them would fill in a `preview` and an `applyItem` and inherit the one
   * engine, rather than building a second bulk system with its own confirmation and its own undo.
   * `owningPhase` stays 29 because it still says which phase owns them.
   */
  it('has all five research operations implemented against the one engine, owned by Phase 29', () => {
    const research = registeredOperations().filter((operation) =>
      operation.kind.startsWith('research.'),
    )
    expect(research.map((operation) => operation.kind).sort()).toEqual([
      'research.confirm',
      'research.mark_duplicate',
      'research.reject',
      'research.set_tags',
      'research.shortlist',
    ])
    for (const operation of research) {
      expect(isAvailable(operation), operation.kind).toBe(true)
      expect(operation.owningPhase, operation.kind).toBe(29)
      // THE PHASE 04 SPLIT AT THE ENGINE. Every one of the five writes a disposition-bearing
      // column, so a researcher holding `bulk.execute` must not reach in bulk what they cannot
      // reach one row at a time.
      expect(operation.extraPermission, operation.kind).toBe('research.confirm')
    }
  })

  it('makes research.reject the only destructive research operation', () => {
    // It empties a queue: rejecting forty rows takes a week of somebody else's review out of the
    // working set in one click. Nothing is deleted, and "recoverable if you know it happened" is
    // not the same as recoverable.
    const destructive = registeredOperations()
      .filter((operation) => operation.kind.startsWith('research.'))
      .filter((operation) => operation.isDestructive === true)
      .map((operation) => operation.kind)
    expect(destructive).toEqual(['research.reject'])
  })
})

describe('the engine is the only mutator', () => {
  const ENGINE = stripCommentsAndStrings(readFileSync('lib/bulk/run.ts', 'utf8'), {
    strings: false,
  })

  it('caps a selection at 500 and batches at 50', () => {
    expect(MAX_SELECTION).toBe(500)
    expect(BATCH_SIZE).toBe(50)
    expect(MAX_SELECTION % BATCH_SIZE).toBe(0)
  })

  it('offers undo for 24 hours', () => {
    expect(UNDO_WINDOW_HOURS).toBe(24)
  })

  it('re-checks the role immediately before writing, not only in the Server Action', () => {
    expect(ENGINE).toContain("roleHasPermission(request.actor.role, 'bulk.execute')")
    expect(ENGINE).toContain("roleHasPermission(request.actor.role, 'destructive.execute')")
  })

  it('requires the confirmation token to match and re-reads the selection from the row', () => {
    expect(ENGINE).toContain('row.confirmation_token !== request.confirmationToken')
    expect(ENGINE).toContain('Array.isArray(row.selection)')
  })

  it('checks the typed count server-side for a destructive operation', () => {
    expect(ENGINE).toContain('request.typedCount !== (previewCounts.willApply ?? 0)')
  })

  it('writes ONE audit row per operation, carrying counts rather than the row set', () => {
    expect(ENGINE).toContain('withAudit')
    // The audit `after` is the counts object, never the items array.
    expect(ENGINE).not.toContain('after: results')
  })
})
