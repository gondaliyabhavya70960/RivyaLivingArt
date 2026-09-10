import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { UNDO_WINDOW_HOURS } from '@/lib/bulk/types'
import { stripCommentsAndStrings } from '@/scripts/db/strip-code.mjs'

/**
 * Undo's skip rule, asserted where it is written.
 *
 * THE RULE IS THE FEATURE, AND IT IS EASY TO DELETE BY ACCIDENT. Every applied item records the
 * `updated_at` the operation LEFT the entity at; undo re-applies `before` only where that value
 * still matches, and reports the rest by id. Somebody optimising the loop could remove the
 * comparison and every test of "does undo restore the row" would still pass — because in a test
 * nothing edits the row in between. So this suite asserts on the code.
 *
 * AND THE COMPARISON HAS A DIRECTION, WHICH IS THE HALF THAT WENT WRONG. Recording the version as
 * it was read BEFORE the write, rather than after, leaves undo comparing against a version its own
 * operation has already moved on — so it skips every row it touched and reports each as edited by
 * somebody else. An undo that restores nothing and misattributes why. No amount of asserting that
 * the comparison exists catches that; what catches it is asserting the ORDER of the two reads
 * around the write, which `tests/unit/bulk-media-immutable.test.ts` does by sequence and the
 * `after` re-read below does by name.
 */

const UNDO = stripCommentsAndStrings(readFileSync('lib/bulk/undo.ts', 'utf8'), { strings: false })
const MIGRATION = readFileSync('supabase/migrations/0220_phase24_bulk.sql', 'utf8')

describe('the window', () => {
  it('is 24 hours', () => {
    expect(UNDO_WINDOW_HOURS).toBe(24)
  })

  it('is refused once it has passed', () => {
    expect(UNDO).toContain('new Date(original.undo_deadline_at) < new Date()')
    expect(UNDO).toContain('The undo window for that operation has closed.')
  })

  it('is refused twice for the same operation', () => {
    expect(UNDO).toContain('original.undone_at !== null')
  })
})

describe('the skip rule', () => {
  it('compares the recorded row version with the current one', () => {
    expect(UNDO).toContain('currentEntityVersion(admin, original.target_entity, item.entity_id)')
    expect(UNDO).toContain(
      'item.row_version_before !== null && current !== item.row_version_before',
    )
  })

  it('SKIPS rather than overwriting, and says why', () => {
    expect(UNDO).toContain("result: 'SKIPPED'")
    expect(UNDO).toContain('Changed since the operation ran, so it was left as it is.')
  })

  it('reports every skipped row by id, in the result AND in the audit row', () => {
    expect(UNDO).toContain('problems.push({ entityId: item.entity_id, reason })')
    expect(UNDO).toContain('skippedIds: problems.map((problem) => problem.entityId)')
  })

  it('only ever restores items the operation actually APPLIED', () => {
    expect(UNDO).toContain("listBulkItems(admin, original.id, 'APPLIED')")
  })

  /**
   * THE DIRECTION, ON THE PRODUCT SIDE. `setProductColumns` re-reads the row after its update and
   * reports THAT version; the two set-membership writers ask `productVersion()` for it, which is
   * also a read after the write. A change here that reported `current` — the row as it was read —
   * would silently disable undo for every product operation.
   */
  it('records the version the write LEFT the row at, not the one it read', () => {
    const PRODUCTS = stripCommentsAndStrings(
      readFileSync('lib/supabase/repositories/bulk-products.ts', 'utf8'),
      { strings: false },
    )
    expect(PRODUCTS).not.toContain('rowVersionForUndo: (current')
    expect(PRODUCTS).toContain('rowVersionForUndo: (after')
    expect(PRODUCTS).toContain('rowVersionForUndo: await productVersion(admin, productId)')
  })
})

describe('an undo is itself an operation', () => {
  it('gets its own row, pointing at what it reverses', () => {
    expect(UNDO).toContain('undoOfOperationId: original.id')
  })

  it('is recorded in the audit log under its own action', () => {
    expect(UNDO).toContain('action: `bulk.undo.${original.kind}`')
  })

  it('cannot point at itself, refused at the row', () => {
    expect(MIGRATION).toContain('bulk_operations_no_self_undo')
  })
})

describe('undoing a destructive operation needs the destructive permission', () => {
  /**
   * Reads backwards until you notice what an undo does: it writes to the same live rows the
   * operation wrote to. A merchandiser who may not archive a page of products may not un-archive
   * one either — both are a bulk write over live content, and the second is the one nobody
   * previewed.
   */
  it('checks bulk.execute and, for a destructive operation, destructive.execute', () => {
    expect(UNDO).toContain("roleHasPermission(request.actor.role, 'bulk.execute')")
    expect(UNDO).toContain(
      "original.is_destructive && !roleHasPermission(request.actor.role, 'destructive.execute')",
    )
  })
})

describe('the record is not erasable', () => {
  it('revokes delete on both record tables', () => {
    expect(MIGRATION).toContain('revoke delete on bulk_operations from anon, authenticated')
    expect(MIGRATION).toContain('revoke delete on bulk_operation_items from anon, authenticated')
  })

  it('stores the row version per item, which is what the skip rule reads', () => {
    expect(MIGRATION).toContain('row_version_before timestamptz')
  })

  it('caps a selection at 500 at the row, not only in TypeScript', () => {
    expect(MIGRATION).toContain('jsonb_array_length(selection) <= 500')
  })
})
