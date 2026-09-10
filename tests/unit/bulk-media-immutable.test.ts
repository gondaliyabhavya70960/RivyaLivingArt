import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { IMMUTABLE_MEDIA_COLUMNS, setMediaColumns } from '@/lib/supabase/repositories/bulk-media'
import { stripCommentsAndStrings } from '@/scripts/db/strip-code.mjs'

/**
 * The four columns bulk may never write.
 *
 * THE ONE THAT MATTERS MOST IS `is_concept`. A concept render is a picture of something that does
 * not exist. Selecting a page of media rows and clearing that flag would launder a set of them
 * into real assets, after which nothing downstream could tell them from photographs of real work —
 * and the Phase 14 trigger that refuses a concept asset as a product hero would have nothing left
 * to refuse. D6 and D10.
 *
 * THE GUARD IS AT THE WRITE, NOT AT THE OPERATION, and this suite proves it there. Three
 * operations exist today; the failure this closes is a fourth added later by somebody who did not
 * read the other three.
 */

/** Enough of a Supabase client to see whether a write was attempted. */
function fakeClient() {
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: 'asset-1', updated_at: '2026-01-01T00:00:00+00:00', folder: 'old' },
    error: null,
  })
  return {
    client: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
        update,
      }),
    } as never,
    update,
  }
}

describe('the immutable set', () => {
  it('names exactly four columns', () => {
    expect([...IMMUTABLE_MEDIA_COLUMNS]).toEqual([
      'rivya_asset_id',
      'higgsfield_generation_id',
      'is_ai_generated',
      'is_concept',
    ])
  })

  it('refuses each of them, by name, before any write is attempted', async () => {
    for (const column of IMMUTABLE_MEDIA_COLUMNS) {
      const { client, update } = fakeClient()
      await expect(setMediaColumns(client, 'asset-1', { [column]: 'anything' })).rejects.toThrow(
        `${column} cannot be changed in bulk.`,
      )
      // NOT ATTEMPTED, not merely refused by the database: the guard runs first, so a policy that
      // happened to admit the write would still never see it.
      expect(update, column).not.toHaveBeenCalled()
    }
  })

  it('refuses an immutable column even when it travels beside a legitimate one', async () => {
    const { client, update } = fakeClient()
    await expect(
      setMediaColumns(client, 'asset-1', { folder: 'new', is_concept: false }),
    ).rejects.toThrow('is_concept cannot be changed in bulk.')
    expect(update).not.toHaveBeenCalled()
  })

  it('allows a column that is not on the list', async () => {
    const { client, update } = fakeClient()
    await expect(setMediaColumns(client, 'asset-1', { folder: 'new' })).resolves.toBeDefined()
    expect(update).toHaveBeenCalledWith({ folder: 'new' })
  })

  it('returns the previous value, so the write is undoable', async () => {
    const { client } = fakeClient()
    const result = await setMediaColumns(client, 'asset-1', { folder: 'new' })
    expect(result.before).toEqual({ folder: 'old' })
    expect(result.rowVersionForUndo).toBe('2026-01-01T00:00:00+00:00')
  })

  /**
   * THE ORDERING REGRESSION, AND IT IS THE ONE A UNIT TEST NEARLY MISSED.
   *
   * `rowVersionForUndo` must be the version the write LEFT the row at, so undo can tell "nobody
   * has touched this since we did" from "somebody has". Reading it before the write instead
   * mismatches on every row the operation itself changed, and the undo skips all of them while
   * reporting that someone else edited them — an undo that never restores anything and lies about
   * why. Nothing catches that without either a real database or this: the version is asserted to
   * be read AFTER the update, by sequence rather than by value.
   */
  it('reads the version it reports AFTER the write, not before it', async () => {
    const calls: string[] = []
    const maybeSingle = vi.fn().mockImplementation(async () => {
      calls.push('read')
      return {
        data: { id: 'asset-1', updated_at: '2026-01-01T00:00:00+00:00', folder: 'old' },
        error: null,
      }
    })
    const update = vi.fn().mockImplementation(() => {
      calls.push('write')
      return { eq: vi.fn().mockResolvedValue({ error: null }) }
    })
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
        update,
      }),
    } as never

    await setMediaColumns(client, 'asset-1', { folder: 'new' })

    // Read the row, write it, then read the version the write produced.
    expect(calls).toEqual(['read', 'write', 'read'])
  })
})

describe('no media operation reaches around the guard', () => {
  const OPERATIONS = stripCommentsAndStrings(
    readFileSync('lib/bulk/operations/media/index.ts', 'utf8'),
    { strings: false },
  )

  it('performs no write of its own — every apply goes through the repository', () => {
    for (const method of ['.insert(', '.update(', '.upsert(', '.delete(']) {
      expect(OPERATIONS, method).not.toContain(method)
    }
  })

  it('never names an immutable column', () => {
    for (const column of IMMUTABLE_MEDIA_COLUMNS) {
      expect(OPERATIONS, column).not.toContain(column)
    }
  })
})
