import { describe, expect, it } from 'vitest'

import { sectionIsLive, selectSections, type SectionWindow } from '@/lib/cms/resolve'

/**
 * Which sections a visitor sees.
 *
 * FOUR CLAUSES, AND EVERY ONE OF THEM FAILS SILENTLY. A section wrongly included or excluded still
 * renders a page — just the wrong one — so there is no crash to notice and no error to search for.
 * Each fixture below differs from a live section in exactly one clause, which is the only way to
 * tell whether all four are actually being applied rather than three of them plus a coincidence.
 */

const NOW = new Date('2026-09-08T12:00:00.000Z')

const section = (over: Partial<SectionWindow> = {}): SectionWindow => ({
  is_visible: true,
  status: 'PUBLISHED',
  publish_at: null,
  unpublish_at: null,
  ...over,
})

describe('sectionIsLive', () => {
  it('is true for a visible, published, unscheduled section', () => {
    expect(sectionIsLive(section(), NOW)).toBe(true)
  })

  it('is false when hidden', () => {
    expect(sectionIsLive(section({ is_visible: false }), NOW)).toBe(false)
  })

  it('is false for every status except PUBLISHED', () => {
    for (const status of ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED']) {
      expect(sectionIsLive(section({ status }), NOW), status).toBe(false)
    }
  })

  it('is false before publish_at and true at it', () => {
    expect(sectionIsLive(section({ publish_at: '2026-09-08T12:00:00.001Z' }), NOW)).toBe(false)
    expect(sectionIsLive(section({ publish_at: '2026-09-08T12:00:00.000Z' }), NOW)).toBe(true)
  })

  it('is false at unpublish_at and true just before it', () => {
    expect(sectionIsLive(section({ unpublish_at: '2026-09-08T12:00:00.000Z' }), NOW)).toBe(false)
    expect(sectionIsLive(section({ unpublish_at: '2026-09-08T12:00:00.001Z' }), NOW)).toBe(true)
  })

  it('still refuses a hidden section that is otherwise live', () => {
    // Visibility is checked first and independently: an editor hiding a block expects it gone,
    // regardless of what its schedule says.
    expect(
      sectionIsLive(section({ is_visible: false, publish_at: '2026-09-01T00:00:00Z' }), NOW),
    ).toBe(false)
  })

  it('includes a hidden section when asked to', () => {
    expect(sectionIsLive(section({ is_visible: false }), NOW, true)).toBe(true)
  })
})

describe('selectSections', () => {
  // One live section and four that each fail a different clause.
  const all = [
    section(),
    section({ status: 'DRAFT' }),
    section({ is_visible: false }),
    section({ publish_at: '2026-09-09T00:00:00Z' }),
    section({ unpublish_at: '2026-09-07T00:00:00Z' }),
  ]

  it('returns only the live one in public mode', () => {
    const { sections, hidden } = selectSections(all, NOW)
    expect(sections).toHaveLength(1)
    expect(sections[0]).toBe(all[0])
    // The public site is never told what it is not being shown.
    expect(hidden).toEqual([])
  })

  it('returns everything in draft mode and reports what is not live', () => {
    // Studio needs to show an editor WHY a section is missing from the live page — "hidden",
    // "not published", "scheduled for tomorrow" are three different fixes.
    const { sections, hidden } = selectSections(all, NOW, { draft: true })
    expect(sections).toHaveLength(5)
    expect(hidden).toHaveLength(4)
  })

  it('preserves order rather than sorting', () => {
    // Order comes from the query (position, created_at, id). Re-sorting here would mean two
    // sources of truth for render order, and the one that lost would be invisible.
    const { sections } = selectSections(all, NOW, { draft: true })
    expect(sections).toEqual(all)
  })

  it('includeHidden alone does not admit an unpublished section', () => {
    // The flag relaxes visibility, not status. Otherwise a Studio preview would show a draft as
    // though it were live.
    const { sections } = selectSections([section({ is_visible: false, status: 'DRAFT' })], NOW, {
      includeHidden: true,
    })
    expect(sections).toEqual([])
  })

  it('is empty for an empty page rather than throwing', () => {
    expect(selectSections([], NOW).sections).toEqual([])
  })
})
