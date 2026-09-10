import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { STAGE_ORDER, isLegalMove, stageIndex } from '@/lib/scraper/core/stage'
import { stripCommentsAndStrings } from '@/scripts/db/strip-code.mjs'

/**
 * The seven stages, and the one module allowed to move between them.
 *
 * TWO KINDS OF ASSERTION HERE. The first is about the vocabulary: FEAT §23 names seven stages, in
 * an order, and rejection is not among them — a later phase adding `REJECTED` to this enum would
 * be undoing the decision that keeps "how far did this get before we said no" answerable. The
 * second is about the code that writes it, asserted on the source, because "only one module may do
 * this" is a rule no type system expresses.
 */

const STAGE = stripCommentsAndStrings(readFileSync('lib/scraper/core/stage.ts', 'utf8'), {
  strings: false,
})
const MIGRATION = readFileSync('supabase/migrations/0230_phase25_research_enums.sql', 'utf8')

describe('the vocabulary', () => {
  it('is exactly FEAT §23, in order', () => {
    expect([...STAGE_ORDER]).toEqual([
      'RAW',
      'NORMALIZED',
      'VALIDATED',
      'MATCHED',
      'REVIEW',
      'SHORTLISTED',
      'CONFIRMED',
    ])
  })

  it('matches the database enum, value for value and in the same order', () => {
    const declaration = /create type research_stage as enum \(([\s\S]*?)\);/.exec(MIGRATION)
    expect(declaration).not.toBeNull()
    const values = [...declaration![1]!.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1])
    expect(values).toEqual([...STAGE_ORDER])
  })

  it('contains no rejection value — that is a disposition, not a stage', () => {
    for (const forbidden of ['REJECTED', 'IGNORED', 'DUPLICATE']) {
      expect(STAGE_ORDER as readonly string[]).not.toContain(forbidden)
    }
    // And the disposition enum is where they actually live.
    expect(MIGRATION).toContain(
      "create type research_disposition as enum ('NONE', 'IGNORED', 'REJECTED', 'DUPLICATE')",
    )
  })
})

describe('legal moves', () => {
  it('allows exactly one step forward', () => {
    expect(isLegalMove('RAW', 'NORMALIZED')).toBe(true)
    expect(isLegalMove('SHORTLISTED', 'CONFIRMED')).toBe(true)
  })

  it('refuses a jump forward', () => {
    // A ROW AT SHORTLISTED THAT WAS NEVER NORMALISED, VALIDATED OR MATCHED is a URL and a page
    // title on a merchandiser's shortlist. Each stage has a phase that owns it.
    expect(isLegalMove('RAW', 'SHORTLISTED')).toBe(false)
    expect(isLegalMove('RAW', 'CONFIRMED')).toBe(false)
    expect(isLegalMove('NORMALIZED', 'MATCHED')).toBe(false)
  })

  it('allows a jump BACKWARD, because sending something back is one act', () => {
    expect(isLegalMove('CONFIRMED', 'RAW')).toBe(true)
    expect(isLegalMove('REVIEW', 'NORMALIZED')).toBe(true)
  })

  it('refuses a move to the same stage', () => {
    // An event saying something happened when nothing did makes a log people stop reading.
    for (const stage of STAGE_ORDER) expect(isLegalMove(stage, stage)).toBe(false)
  })

  it('refuses a stage it does not recognise', () => {
    expect(isLegalMove('RAW', 'ELSEWHERE' as never)).toBe(false)
  })

  it('agrees with the ordering it is derived from', () => {
    for (let index = 0; index < STAGE_ORDER.length; index += 1) {
      expect(stageIndex(STAGE_ORDER[index]!)).toBe(index)
    }
  })
})

describe('one writer, and it writes both halves', () => {
  it('records the event BEFORE it moves the stage', () => {
    /*
     * THE ORDER IS THE FAILURE MODE. PostgREST gives no transaction, so one of the two writes can
     * land alone. Event-then-stage leaves a log entry for a move that did not take, which is
     * visible by comparing the row with its last event. Stage-then-event leaves a row that moved
     * with no record of who moved it — indistinguishable from one that was always there.
     */
    const eventAt = STAGE.indexOf('recordPipelineEvent(admin')
    const stageAt = STAGE.indexOf('writeProductStage(admin')
    expect(eventAt).toBeGreaterThan(-1)
    expect(stageAt).toBeGreaterThan(-1)
    expect(eventAt).toBeLessThan(stageAt)
  })

  it('refuses an illegal move before writing anything at all', () => {
    const guardAt = STAGE.indexOf('if (!isLegalMove(from, input.to)) throw')
    expect(guardAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(STAGE.indexOf('recordPipelineEvent(admin'))
  })

  it('records a disposition WITHOUT moving the stage', () => {
    const dispositionBody = STAGE.slice(STAGE.indexOf('export async function setDisposition'))
    expect(dispositionBody).toContain('writeProductDisposition(admin')
    // A REJECTED ROW KEEPS THE STAGE IT REACHED. A stage write in this function would erase that.
    expect(dispositionBody).not.toContain('writeProductStage(admin')
  })

  it('gates on research.confirm rather than research.write', () => {
    // The dividing line is the COLUMN, not the screen: a researcher operates the pipeline, a
    // merchandiser judges its output, and `stage` is a judgement.
    expect(STAGE).toContain('assertMayMoveStage')
    expect(STAGE).toContain('PermissionError')
  })
})
