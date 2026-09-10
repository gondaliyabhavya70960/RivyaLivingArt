import { describe, expect, it } from 'vitest'

import {
  duplicateMappingLabels,
  normaliseLabel,
  resolveCategory,
  unmappedLabels,
  type CategoryMapping,
} from '@/lib/scraper/core/category-map'

/**
 * Resolving somebody else's category labels to Rivya's — and, far more often, to nothing.
 *
 * MOST OF THIS FILE IS ABOUT THE ANSWER "NO". A test suite for a matcher naturally fills up with
 * the cases where it matches, and those are the cases that were never going to be got wrong. The
 * ones worth writing are the ways a match could appear where nobody made one: a label defaulted to
 * the first category, an ignore overruled by a later breadcrumb segment, a deleted category
 * quietly re-pointing items at a different one, two labels colliding because the normaliser got
 * clever. Each of those produces a category assignment nobody typed, on a row a merchandiser reads
 * as a decision — and Phase 31 then charts it.
 *
 * EVERY LABEL HERE IS INVENTED. No source, brand, domain or price appears in this repository (D10),
 * and a fixture is not an exception to that.
 */

/**
 * Category identifiers are uuids because `categories.id` is one. These are shaped like uuids and
 * are not any row's: nothing in this file touches a database.
 */
const CATEGORY_SEATING = '00000000-0000-4000-8000-000000000001'
const CATEGORY_TABLES = '00000000-0000-4000-8000-000000000002'
const CATEGORY_LIGHTING = '00000000-0000-4000-8000-000000000003'

/** A mapping pointing at a Rivya category — `mapping_state` MAPPED. */
function toCategory(sourceLabel: string, categoryId: string): CategoryMapping {
  return { id: 'map:' + sourceLabel, sourceLabel, sourcePath: null, categoryId, isIgnored: false }
}

/** A mapping somebody looked at and dismissed — `mapping_state` IGNORED. */
function toIgnore(sourceLabel: string): CategoryMapping {
  return {
    id: 'map:' + sourceLabel,
    sourceLabel,
    sourcePath: null,
    categoryId: null,
    isIgnored: true,
  }
}

/**
 * A mapping whose Rivya category has been deleted — `mapping_state` UNRESOLVED. Reached by
 * `on delete set null`, never by anyone saving it: the drawer's schema refuses an undecided row.
 */
function toNothingYet(sourceLabel: string): CategoryMapping {
  return {
    id: 'map:' + sourceLabel,
    sourceLabel,
    sourcePath: null,
    categoryId: null,
    isIgnored: false,
  }
}

describe('normaliseLabel', () => {
  it('case-folds, so one label saved in title case matches the same label shouted', () => {
    expect(normaliseLabel('Occasional Tables')).toBe('occasional tables')
    expect(normaliseLabel('OCCASIONAL TABLES')).toBe('occasional tables')
  })

  it('collapses every run of internal whitespace to one space', () => {
    expect(normaliseLabel('Occasional   Tables')).toBe('occasional tables')
    expect(normaliseLabel('Occasional\tTables')).toBe('occasional tables')
    expect(normaliseLabel('Occasional\n  Tables')).toBe('occasional tables')
  })

  it('collapses a non-breaking space, which is what a scraped label is usually full of', () => {
    // `&nbsp;` between two words decodes to U+00A0. Left alone it is the single most common reason
    // two spellings of one label fail to match.
    expect(normaliseLabel('Occasional\u00a0Tables')).toBe('occasional tables')
  })

  it('trims', () => {
    expect(normaliseLabel('  Seating  ')).toBe('seating')
  })

  it('strips a trailing separator, whichever glyph the site puts between segments', () => {
    expect(normaliseLabel('Seating ›')).toBe('seating')
    expect(normaliseLabel('Seating >')).toBe('seating')
    expect(normaliseLabel('Seating »')).toBe('seating')
    expect(normaliseLabel('Seating /')).toBe('seating')
    expect(normaliseLabel('Seating |')).toBe('seating')
    expect(normaliseLabel('Seating —')).toBe('seating')
  })

  it('strips a whole trailing run, separators and spaces together', () => {
    expect(normaliseLabel('Seating › / ')).toBe('seating')
  })

  it('leaves a LEADING separator alone, because the rule is trailing only', () => {
    // Deliberate: every character removed is a character that can make two different labels
    // collide, so the rule stays at the narrowest shape actually observed.
    expect(normaliseLabel('› Seating')).toBe('› seating')
  })

  it('keeps punctuation inside the label, which is part of what the site calls it', () => {
    expect(normaliseLabel('Hand-woven Seating')).toBe('hand-woven seating')
    expect(normaliseLabel('Seating & Benches')).toBe('seating & benches')
  })

  it('does not singularise, stem, fold accents or otherwise guess', () => {
    // EACH OF THESE PAIRS IS TWO LABELS UNTIL A PERSON SAYS OTHERWISE, and saying otherwise costs
    // them one mapping row. A normaliser that closed any of these gaps would be assigning a
    // category nobody chose.
    expect(normaliseLabel('Tables')).not.toBe(normaliseLabel('Table'))
    expect(normaliseLabel('Seating')).not.toBe(normaliseLabel('Seats'))
    expect(normaliseLabel('Décor')).not.toBe(normaliseLabel('Decor'))
  })

  it('reduces a label made only of separators to nothing', () => {
    expect(normaliseLabel(' › ')).toBe('')
    expect(normaliseLabel('')).toBe('')
  })
})

describe('resolveCategory', () => {
  const mappings: readonly CategoryMapping[] = [
    toCategory('Seating', CATEGORY_SEATING),
    toCategory('Dining Tables', CATEGORY_TABLES),
    toIgnore('Gift Vouchers'),
  ]

  it('matches an exact label and reports how it got there', () => {
    expect(resolveCategory(['Seating'], mappings)).toEqual({
      outcome: 'MAPPED',
      categoryId: CATEGORY_SEATING,
      matchedLabel: 'Seating',
      method: 'MAP',
    })
  })

  it('matches across a case difference', () => {
    expect(resolveCategory(['SEATING'], mappings).categoryId).toBe(CATEGORY_SEATING)
  })

  it('matches across a whitespace difference', () => {
    expect(resolveCategory(['  Dining   Tables '], mappings).categoryId).toBe(CATEGORY_TABLES)
  })

  it('matches when the OBSERVED label arrived with its separator attached', () => {
    expect(resolveCategory(['Dining Tables ›'], mappings).categoryId).toBe(CATEGORY_TABLES)
  })

  it('matches when the STORED label was saved with a separator attached', () => {
    const stored = [toCategory('Dining Tables /', CATEGORY_TABLES)]
    expect(resolveCategory(['Dining Tables'], stored).categoryId).toBe(CATEGORY_TABLES)
  })

  it('returns the observed spelling as matchedLabel, not the stored one', () => {
    // The caller asks "which of MY segments answered this", and that is the segment it can act on.
    expect(resolveCategory(['dining tables'], mappings).matchedLabel).toBe('dining tables')
  })

  it('reports an explicit dismissal as IGNORED, with no category', () => {
    expect(resolveCategory(['Gift Vouchers'], mappings)).toEqual({
      outcome: 'IGNORED',
      categoryId: null,
      matchedLabel: 'Gift Vouchers',
      method: 'MAP',
    })
  })

  it('STOPS at an ignore rather than looking for a later label that maps', () => {
    // A breadcrumb's second segment must not overrule a decision somebody made about its first.
    const match = resolveCategory(['Gift Vouchers', 'Seating'], mappings)
    expect(match.outcome).toBe('IGNORED')
    expect(match.categoryId).toBeNull()
  })

  it('still finds a later label when the earlier one has no mapping at all', () => {
    const match = resolveCategory(['Seasonal Offers', 'Seating'], mappings)
    expect(match.outcome).toBe('MAPPED')
    expect(match.matchedLabel).toBe('Seating')
  })

  it('takes the FIRST label that matches when several do', () => {
    const match = resolveCategory(['Dining Tables', 'Seating'], mappings)
    expect(match.categoryId).toBe(CATEGORY_TABLES)
    expect(match.matchedLabel).toBe('Dining Tables')
  })

  it('answers UNMAPPED with nulls when nothing matches', () => {
    expect(resolveCategory(['Seasonal Offers'], mappings)).toEqual({
      outcome: 'UNMAPPED',
      categoryId: null,
      matchedLabel: null,
      method: null,
    })
  })

  it('answers UNMAPPED with nulls when there are no labels', () => {
    expect(resolveCategory([], mappings)).toEqual({
      outcome: 'UNMAPPED',
      categoryId: null,
      matchedLabel: null,
      method: null,
    })
  })

  it('answers UNMAPPED when there are no mappings at all', () => {
    expect(resolveCategory(['Seating'], [])).toEqual({
      outcome: 'UNMAPPED',
      categoryId: null,
      matchedLabel: null,
      method: null,
    })
  })

  it('NEVER falls back to the first mapping, or to any other, when nothing matches', () => {
    // The failure this whole module exists to prevent, asserted directly.
    const match = resolveCategory(['Seasonal Offers', 'Clearance'], mappings)
    expect(match.categoryId).toBeNull()
    expect(match.method).toBeNull()
  })

  it('does not read the words of a label to find a category', () => {
    // "Dining Table Linens" contains "Dining Table" and is not it.
    expect(resolveCategory(['Dining Table Linens'], mappings).outcome).toBe('UNMAPPED')
  })

  it('skips a label that normalises to nothing rather than matching on emptiness', () => {
    const match = resolveCategory([' › ', 'Seating'], mappings)
    expect(match.matchedLabel).toBe('Seating')
  })

  it('stops at a row whose category was deleted, and answers UNMAPPED naming the label', () => {
    // THE UNRESOLVED CASE. Carrying on to the next label would mean deleting one Rivya category
    // silently re-points items at a DIFFERENT one, as a side effect of an unrelated edit.
    const withDeleted = [toNothingYet('Wall Lighting'), toCategory('Lighting', CATEGORY_LIGHTING)]
    expect(resolveCategory(['Wall Lighting', 'Lighting'], withDeleted)).toEqual({
      outcome: 'UNMAPPED',
      categoryId: null,
      matchedLabel: 'Wall Lighting',
      method: null,
    })
  })

  it('reads a contradictory row as an ignore, because that reading invents nothing', () => {
    // Refused by the CHECK and by the drawer's schema; reachable only by a direct SQL write.
    const contradictory: CategoryMapping = {
      id: 'map:contradictory',
      sourceLabel: 'Clearance',
      sourcePath: null,
      categoryId: CATEGORY_SEATING,
      isIgnored: true,
    }
    const match = resolveCategory(['Clearance'], [contradictory])
    expect(match.outcome).toBe('IGNORED')
    expect(match.categoryId).toBeNull()
  })

  it('lets the FIRST of two colliding rows decide, so today does not rewrite yesterday', () => {
    const colliding = [
      toCategory('Dining Tables', CATEGORY_TABLES),
      toCategory('dining tables', CATEGORY_SEATING),
    ]
    expect(resolveCategory(['Dining Tables'], colliding).categoryId).toBe(CATEGORY_TABLES)
  })

  it('ignores the order the mappings arrive in when their labels are distinct', () => {
    const reversed = [...mappings].reverse()
    expect(resolveCategory(['Seating'], reversed)).toEqual(resolveCategory(['Seating'], mappings))
  })

  it('does not match on the mapping path, only on the label', () => {
    const pathed: CategoryMapping = {
      id: 'map:pathed',
      sourceLabel: 'Benches',
      sourcePath: 'Outdoor Range / Benches',
      categoryId: CATEGORY_SEATING,
      isIgnored: false,
    }
    expect(resolveCategory(['Outdoor Range / Benches'], [pathed]).outcome).toBe('UNMAPPED')
    expect(resolveCategory(['Benches'], [pathed]).outcome).toBe('MAPPED')
  })
})

describe('unmappedLabels', () => {
  const mappings: readonly CategoryMapping[] = [
    toCategory('Seating', CATEGORY_SEATING),
    toIgnore('Gift Vouchers'),
    toNothingYet('Wall Lighting'),
  ]

  it('reports the labels nobody has decided about, in the order they were first seen', () => {
    expect(unmappedLabels(['Clearance', 'Seasonal Offers'], mappings)).toEqual([
      'Clearance',
      'Seasonal Offers',
    ])
  })

  it('de-duplicates by key and keeps the first spelling seen', () => {
    // The mapping row stores the label as observed, so the worklist must offer a spelling the site
    // actually used — and offer it once.
    expect(unmappedLabels(['Clearance', 'CLEARANCE', '  clearance  '], mappings)).toEqual([
      'Clearance',
    ])
  })

  it('does not report a label that maps to a category', () => {
    expect(unmappedLabels(['Seating'], mappings)).toEqual([])
  })

  it('does not report an ignored label, because that decision has been taken', () => {
    expect(unmappedLabels(['Gift Vouchers'], mappings)).toEqual([])
  })

  it('DOES report a row whose category was deleted, which is the dashboard rule', () => {
    // Migration 0240: UNRESOLVED "appears in the dashboard's unmapped figure exactly as a
    // never-mapped label does". This function is what puts it there.
    expect(unmappedLabels(['Wall Lighting'], mappings)).toEqual(['Wall Lighting'])
  })

  it('skips labels that normalise to nothing', () => {
    expect(unmappedLabels([' › ', '  '], mappings)).toEqual([])
  })

  it('returns nothing for no labels, and everything for no mappings', () => {
    expect(unmappedLabels([], mappings)).toEqual([])
    expect(unmappedLabels(['Seating', 'Clearance'], [])).toEqual(['Seating', 'Clearance'])
  })
})

describe('duplicateMappingLabels', () => {
  it('reports nothing when every stored label resolves to its own key', () => {
    expect(
      duplicateMappingLabels([
        toCategory('Seating', CATEGORY_SEATING),
        toCategory('Dining Tables', CATEGORY_TABLES),
      ]),
    ).toEqual([])
  })

  it('reports the key when two rows differ only in case', () => {
    // `unique (source_id, source_label)` is on the RAW label, so both rows save. One of them is
    // then dead configuration, and nothing about the row itself says so.
    expect(
      duplicateMappingLabels([
        toCategory('Dining Tables', CATEGORY_TABLES),
        toCategory('dining tables', CATEGORY_SEATING),
      ]),
    ).toEqual(['dining tables'])
  })

  it('reports a clash produced by whitespace or a trailing separator', () => {
    expect(
      duplicateMappingLabels([
        toCategory('Seating', CATEGORY_SEATING),
        toCategory('Seating ›', CATEGORY_SEATING),
        toIgnore('  seating  '),
      ]),
    ).toEqual(['seating'])
  })

  it('reports one entry per clash however many rows collide, in first-seen order', () => {
    const reported = duplicateMappingLabels([
      toCategory('Dining Tables', CATEGORY_TABLES),
      toCategory('Seating', CATEGORY_SEATING),
      toCategory('SEATING', CATEGORY_SEATING),
      toCategory('dining tables', CATEGORY_TABLES),
      toCategory('Seating /', CATEGORY_SEATING),
    ])
    expect(reported).toEqual(['dining tables', 'seating'])
  })

  it('reports nothing for no rows, and nothing for a single row', () => {
    expect(duplicateMappingLabels([])).toEqual([])
    expect(duplicateMappingLabels([toCategory('Seating', CATEGORY_SEATING)])).toEqual([])
  })
})
