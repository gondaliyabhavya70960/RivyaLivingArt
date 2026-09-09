import { describe, expect, it } from 'vitest'

import { seedModules } from '@/content/seed'
import type { SeedRecord } from '@/content/seed/types'

/**
 * The portfolio's empty state, which is the whole public surface of Phase 17.
 *
 * WHY THIS DESERVES ITS OWN FILE. `/portfolio` will render this and nothing else for as long as the
 * owner has no confirmed projects — which is the correct state, not a temporary one — so the copy on
 * it is not a placeholder awaiting replacement. It is the page. SEED §28 wrote the words; this file
 * checks that those are the words, and that nothing has quietly turned them into "Coming Soon".
 *
 * IT READS THE SEED MODULES, NOT THE DATABASE. The seed is the source of the copy; the database
 * holds whatever the last run wrote plus whatever an editor has since changed, and an editor
 * changing this wording is allowed — that is what a CMS is for. What must not happen is the
 * REPOSITORY shipping different words, and that is what these assertions hold.
 *
 * IT ALSO CAUGHT SOMETHING. The empty-state section shipped with no `heading` at all: the body came
 * from `global_content` and the heading came from nowhere, so `/portfolio` rendered half of §28 —
 * the explanation with nothing above it. The first assertion below is the one that failed.
 */

const SECTION_28 = {
  heading: 'The project archive is being prepared.',
  body: 'Verified Rivya projects will appear here as the portfolio develops.',
} as const

const records: readonly SeedRecord[] = seedModules.flatMap((module) => module.records)

const find = (seedKey: string): SeedRecord | undefined =>
  records.find((record) => record.seedKey === seedKey)

describe('the portfolio empty state says what SEED §28 says', () => {
  it('seeds §28 heading on the empty-state section, verbatim', () => {
    const section = find('section:portfolio.02.empty-state')
    expect(section).toBeDefined()
    expect(section?.fields.heading).toBe(SECTION_28.heading)
  })

  it('seeds §28 body as the shared EMPTY_STATE.portfolio row, verbatim', () => {
    const message = find('global:EMPTY_STATE.portfolio')
    expect(message).toBeDefined()
    expect(message?.fields.value).toBe(SECTION_28.body)
  })

  /**
   * The block renders NOTHING when its `content_key` names a missing or disabled row — no grey box,
   * no "coming soon", not the key itself. So the key must be the one that is actually seeded, and a
   * typo here is invisible in every way except that the page loses its explanation.
   */
  it('points the section at the row that carries the message', () => {
    const section = find('section:portfolio.02.empty-state')
    const payload = section?.fields.payload as { content_key?: string } | undefined
    expect(payload?.content_key).toBe('portfolio')
    expect(find(`global:EMPTY_STATE.${payload?.content_key ?? ''}`)).toBeDefined()
  })

  /**
   * SEED §55 forbids "Coming Soon" outright, and the risk it names is specific: a well-meaning
   * editor replacing an honest explanation with a promise nobody made. This checks the copy this
   * repository ships. It cannot check what an editor types into the Studio later — nothing can —
   * which is why §55 is also a rule written down for people.
   */
  it('ships no "Coming Soon" in any seeded string, anywhere', () => {
    const offenders: string[] = []
    for (const record of records) {
      for (const [field, value] of Object.entries(record.fields)) {
        const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
        if (/coming\s+soon/i.test(text)) offenders.push(`${record.seedKey}.${field}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('the portfolio ships with nothing in it', () => {
  /**
   * The exit criterion, asserted as the rule rather than as a count. `portfolio_projects` and
   * `testimonials` are not in `SeedableTable` at all, so this is a belt beside that brace: a record
   * targeting either would fail to type-check first, and would fail here if somebody cast past it.
   */
  it('seeds no project and no testimonial', () => {
    const forbidden = records.filter(
      (record) =>
        record.table === ('portfolio_projects' as string) ||
        record.table === ('portfolio_project_media' as string) ||
        record.table === ('testimonials' as string),
    )
    expect(forbidden).toEqual([])
  })

  /**
   * THE STRIP DOES NOT FALL BACK, AND THAT IS DELIBERATE. `portfolio-strip` can render its own empty
   * state; here `show_empty_state` is false because the `empty-state` band below it already carries
   * §28's sentence. Two of them on one page would print the same explanation twice.
   */
  it('leaves the project strip silent so the empty state is not said twice', () => {
    const strip = find('section:portfolio.03.projects')
    const payload = strip?.fields.payload as { show_empty_state?: boolean } | undefined
    expect(payload?.show_empty_state).toBe(false)
  })
})
