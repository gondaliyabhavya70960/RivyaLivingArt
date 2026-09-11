import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  InvalidStageTransitionError,
  MOVEMENTS,
  MovementReasonError,
  STAGE_ORDER,
  StageTransitionError,
  isLegalMove,
  movementFor,
  requireMovementReason,
} from '@/lib/scraper/core/stage'

/**
 * THE MOVEMENT TABLE, CELL FOR CELL — Phase 35, verification 2.
 *
 * The table in `PHASE-31-38.md` §Phase 35, the table inside `lib/scraper/core/stage.ts` and the
 * one in `SCRAPER.md` §26 must agree exactly. This reads the two documents' tables and compares
 * them with the module's `MOVEMENTS`, so a fork would have to be committed to all three in plain
 * sight. It also asserts the properties the table makes load-bearing: no second pipeline module,
 * a disposition never moves a stage, and every movement outside the table raises.
 */

interface Cell {
  readonly column: 'stage' | 'disposition'
  readonly from: readonly string[]
  readonly to: string
  readonly reasonRequired: boolean
}

/** The rows between the table header and the "either | any" catch-all, from a Markdown document. */
function readTable(path: string): Cell[] {
  const source = readFileSync(path, 'utf8')
  const lines = source.split('\n')
  const header = lines.findIndex((line) => /^\| Column \| From \| Allowed to \|/u.test(line))
  expect(header, `${path} has the movement table`).toBeGreaterThan(-1)
  const cells: Cell[] = []
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break
    const parts = line.split('|').map((part) => part.trim())
    const column = parts[1]?.replace(/`/gu, '')
    if (column !== 'stage' && column !== 'disposition') break
    const from = (parts[2] ?? '')
      .split('·')
      .map((entry) => entry.replace(/`/gu, '').trim())
      .filter((entry) => entry !== '')
    const to = (parts[3] ?? '').replace(/`/gu, '').trim()
    const reason = (parts[5] ?? '').replace(/\*/gu, '').trim().toLowerCase()
    cells.push({ column, from, to, reasonRequired: reason.startsWith('yes') })
  }
  return cells
}

const fromModule: Cell[] = MOVEMENTS.map((movement) => ({
  column: movement.column,
  from: [...movement.from],
  to: movement.to,
  reasonRequired: movement.reasonRequired,
}))

describe('the movement table', () => {
  it('is the phase document’s, cell for cell', () => {
    expect(fromModule).toEqual(readTable('docs/project/phases/PHASE-31-38.md'))
  })

  it('is SCRAPER.md §26’s, cell for cell', () => {
    expect(fromModule).toEqual(readTable('docs/architecture/SCRAPER.md'))
  })

  it('has eight rows, every one behind research.confirm', () => {
    expect(MOVEMENTS).toHaveLength(8)
    for (const movement of MOVEMENTS) expect(movement.permission).toBe('research.confirm')
  })

  it('never moves a stage from a disposition row or sets a disposition from a stage row', () => {
    for (const movement of MOVEMENTS) {
      if (movement.column === 'stage') {
        expect(STAGE_ORDER).toContain(movement.to)
        for (const from of movement.from) expect(STAGE_ORDER).toContain(from)
      } else {
        expect(['NONE', 'IGNORED', 'REJECTED', 'DUPLICATE']).toContain(movement.to)
        expect(STAGE_ORDER).not.toContain(movement.to)
      }
    }
  })
})

describe('the stage machine honours the table', () => {
  it('admits every stage movement the table names', () => {
    for (const movement of MOVEMENTS) {
      if (movement.column !== 'stage') continue
      for (const from of movement.from) {
        expect(isLegalMove(from as never, movement.to as never), `${from} → ${movement.to}`).toBe(
          true,
        )
      }
    }
  })

  it('refuses the forward jumps the table does not name', () => {
    // MATCHED → SHORTLISTED is the one named forward jump. Nothing else skips a rung.
    expect(isLegalMove('MATCHED', 'CONFIRMED')).toBe(false)
    expect(isLegalMove('REVIEW', 'CONFIRMED')).toBe(false)
    expect(isLegalMove('VALIDATED', 'SHORTLISTED')).toBe(false)
    expect(isLegalMove('RAW', 'SHORTLISTED')).toBe(false)
  })

  it('names the error the phase document names', () => {
    expect(InvalidStageTransitionError).toBe(StageTransitionError)
    expect(new InvalidStageTransitionError('REVIEW', 'CONFIRMED').name).toBe('StageTransitionError')
  })

  it('requires a reason exactly where the table says yes', () => {
    for (const movement of MOVEMENTS) {
      const found = movementFor(movement.column, movement.from[0] as string, movement.to)
      expect(found).toBe(movement)
      if (movement.reasonRequired) {
        expect(() => requireMovementReason(found, null)).toThrow(MovementReasonError)
        expect(() => requireMovementReason(found, '   ')).toThrow(MovementReasonError)
        expect(() => requireMovementReason(found, 'because')).not.toThrow()
      } else {
        expect(() => requireMovementReason(found, null)).not.toThrow()
      }
    }
  })

  it('has no row for a movement outside the table', () => {
    expect(movementFor('stage', 'REVIEW', 'CONFIRMED')).toBeNull()
    expect(movementFor('disposition', 'REJECTED', 'IGNORED')).toBeNull()
  })
})

describe('no second pipeline', () => {
  it('has no lib/scraper/workflows/pipeline.ts', () => {
    expect(existsSync('lib/scraper/workflows/pipeline.ts')).toBe(false)
  })

  it('alters no enum in the Phase 35 migrations', () => {
    for (const file of ['0330_phase35_shortlist_confirmation.sql', '0331_phase35_rls.sql']) {
      const sql = readFileSync(`supabase/migrations/${file}`, 'utf8').toLowerCase()
      expect(sql).not.toContain('alter type')
    }
  })
})
