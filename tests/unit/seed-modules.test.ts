import { describe, expect, it } from 'vitest'

import { seedModules, allSeedKeys } from '@/content/seed/index'
import { SEEDABLE_TABLES, type SeedRecord } from '@/content/seed/types'
import { contentHash } from '../../scripts/seed/hash'

/**
 * The seed modules, checked for the mistakes the phase document's risk table names.
 *
 * EVERY ASSERTION HERE IS ABOUT A FAILURE THAT WOULD BE SILENT. A duplicated `seed_key` produces
 * two rows fighting over one identity and the second one quietly wins; a module targeting a
 * product table seeds inventory nobody entered; a category order that drifts changes the site's
 * positioning without anyone deciding to. None of them throws, and none is visible in a diff.
 */

const RECORDS: readonly SeedRecord[] = seedModules.flatMap((m) => m.records)

describe('seed_key identity', () => {
  /**
   * The risk this covers, in the phase document's words: "The same copy is duplicated into a
   * Phase 18/19 seed module to dodge the ordering problem." Uniqueness across ALL modules is what
   * makes that impossible — a second module restating a journal record fails here rather than
   * producing two rows that overwrite each other on alternate runs.
   */
  it('is unique across every module', () => {
    const keys = allSeedKeys()
    const seen = new Set<string>()
    const duplicates = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)))
    expect(duplicates).toEqual([])
    expect(keys).toHaveLength(RECORDS.length)
  })

  it('is namespaced by kind, so one glance says what a key addresses', () => {
    const prefixes = new Set(RECORDS.map((r) => r.seedKey.split(':')[0]))
    expect([...prefixes].sort()).toEqual([
      // Phase 14. The listing controls' own words — filter group names, sort options, pagination
      // — for the same reason `chrome:` exists and is not `global:`: they came from a component
      // that needed them, not from the SEED specification.
      'catalog',
      'category',
      // Phase 10. The public shell's own strings — the skip link, the two menu controls, the
      // announcement dismiss button, and the accessible names of the landmarks. They are not
      // `global:` because they came from a different phase for a different reason: `global.ts`
      // holds what the SEED specification supplies, and these are the words a component needed.
      'chrome',
      // Phase 16. The ten FEAT §9 concepts. `collection:` rather than `page:collection.<slug>` —
      // which `collections.ts` already uses for the seven CATEGORY pages — because these address a
      // `collections` ROW and those address a `pages` row. The two families would otherwise be one
      // prefix apart while pointing at different tables.
      'collection',
      'commission-form',
      'faq',
      'global',
      'journal-article',
      'journal-category',
      'nav',
      'page',
      'section',
      'seo',
    ])
  })

  it('never changes shape mid-list — every key carries exactly one colon separator', () => {
    for (const record of RECORDS) {
      expect(record.seedKey.split(':').length, record.seedKey).toBe(2)
      expect(record.seedKey.split(':')[1]?.length ?? 0, record.seedKey).toBeGreaterThan(0)
    }
  })
})

describe('the table allowlist', () => {
  /**
   * "The seed quietly invents a product to fill a grid." `products` is absent from `SeedableTable`
   * as a union member, so a module targeting it does not compile — this asserts the runtime list
   * agrees with the type, because the runner reads the list.
   */
  it('contains no catalog product table', () => {
    expect(SEEDABLE_TABLES).not.toContain('products')
    expect(SEEDABLE_TABLES).not.toContain('product_media')
    expect(SEEDABLE_TABLES).not.toContain('product_materials')
  })

  it('is what every record targets', () => {
    for (const record of RECORDS) {
      expect(SEEDABLE_TABLES, record.seedKey).toContain(record.table)
    }
  })
})

describe('deferral', () => {
  const deferred = RECORDS.filter((r) => r.requiresTables !== undefined)

  /**
   * "A `deferred` record is quietly lost instead of applied later." The union of applied and
   * deferred must be the whole module output — a record that is neither would be authored and
   * never written, with nothing anywhere saying so.
   */
  it('accounts for every record — applied plus deferred is the whole set', () => {
    const applied = RECORDS.filter((r) => r.requiresTables === undefined)
    expect(applied.length + deferred.length).toBe(RECORDS.length)
  })

  it('defers exactly the 22 the phase document names', () => {
    expect(deferred).toHaveLength(22)
    expect(deferred.filter((r) => r.table === 'journal_categories')).toHaveLength(9)
    expect(deferred.filter((r) => r.table === 'journal_articles')).toHaveLength(10)
    expect(deferred.filter((r) => r.table === 'customization_forms')).toHaveLength(3)
  })

  /** A deferred record must name the table it waits for, or the runner cannot probe anything. */
  it('names the tables each deferred record waits for', () => {
    for (const record of deferred) {
      expect(record.requiresTables?.length ?? 0, record.seedKey).toBeGreaterThan(0)
    }
  })

  /**
   * The mixed modules are the point. If either became wholly deferred, its page would have no
   * copy at all until Phase 18 or 19 — which is what per-record deferral was built to prevent.
   */
  it('leaves the two mixed modules with records that land today', () => {
    for (const name of ['commissions', 'journal']) {
      const found = seedModules.find((m) => m.name === name)
      const now = found?.records.filter((r) => r.requiresTables === undefined) ?? []
      expect(now.length, `${name} must still write something now`).toBeGreaterThan(0)
    }
  })
})

describe('SEED §56 content priority', () => {
  /**
   * "Positioning drifts to gifts/décor because those families have plenty of assets." The order is
   * a decision, and it is encoded in two places — the menu and the category pages — so both are
   * asserted against the same list.
   */
  const ORDER = [
    'furniture',
    'collectible-design',
    '3d-resin',
    'wall-statement-art',
    'preservation',
    'decor',
    'gifts',
  ]

  it('orders the header menu children', () => {
    const children = RECORDS.filter(
      (r) => r.table === 'navigation_items' && r.seedKey.startsWith('nav:header.collection.'),
    )
      .sort((a, b) => (a.fields.position as number) - (b.fields.position as number))
      .map((r) => r.seedKey.replace('nav:header.collection.', ''))
    expect(children).toEqual(ORDER)
  })

  it('orders the seven category pages the same way', () => {
    const pages = RECORDS.filter(
      (r) => r.table === 'pages' && r.seedKey.startsWith('page:collection.'),
    ).map((r) => r.seedKey.replace('page:collection.', ''))
    expect(pages).toEqual(ORDER)
  })
})

describe('D10 — nothing fabricated', () => {
  const BANNED = /lorem|coming soon|\bTBD\b|\bplaceholder\b|dummy text/i

  /**
   * ONLY THE FIELDS A VISITOR READS. The first version of this test stringified the whole record
   * and flagged `global:FORM_COPY.search.placeholder` — whose value is "Search furniture, art,
   * materials and stories" and whose KEY happens to contain the word. A checker that fires on a
   * field name rather than its content is the kind that gets disabled.
   *
   * `description` is excluded deliberately: on `global_content` it is the note explaining a row to
   * an editor, written here rather than by the specification, and it legitimately says things like
   * "no placeholder is substituted".
   *
   * `label` IS TABLE-DEPENDENT, which is the subtler case. On `navigation_items` it is the menu
   * text a visitor reads and must be checked; on `global_content` it is the Studio-facing name of
   * the row — "Search placeholder" — and must not be. One column name, two meanings, and the
   * check has to know which table it is looking at.
   */
  const VISIBLE_FIELDS = [
    'value',
    'eyebrow',
    'heading',
    'heading_highlight',
    'body',
    'supporting',
    'cta_label',
    'cta_secondary_label',
    'question',
    'answer',
    'title',
    'excerpt',
    'name',
    'payload',
  ]

  it('ships no filler copy', () => {
    for (const record of RECORDS) {
      const fields =
        record.table === 'global_content' ? VISIBLE_FIELDS : [...VISIBLE_FIELDS, 'label']
      for (const field of fields) {
        const value = record.fields[field]
        if (value === undefined || value === null) continue
        const text = typeof value === 'string' ? value : JSON.stringify(value)
        expect(BANNED.test(text), `${record.seedKey}.${field} contains filler copy`).toBe(false)
      }
    }
  })

  /**
   * A row asserting an unverified claim cannot be PUBLISHED — the database refuses the
   * combination on six tables. Catching it here names the record; catching it at insert time names
   * a constraint, and only for whichever record happened to be first.
   */
  it('never seeds an unverified claim as published', () => {
    for (const record of RECORDS) {
      if (record.fields.owner_verification !== 'OWNER_VERIFICATION_REQUIRED') continue
      expect(record.fields.status, `${record.seedKey} is flagged and published`).not.toBe(
        'PUBLISHED',
      )
    }
  })

  it('flags every FAQ answer', () => {
    const faqs = RECORDS.filter((r) => r.table === 'faqs')
    expect(faqs).toHaveLength(10)
    for (const faq of faqs) {
      expect(faq.fields.owner_verification, faq.seedKey).toBe('OWNER_VERIFICATION_REQUIRED')
    }
  })

  /** Portfolio ships an empty state and zero projects, which is §17's rule in capitals. */
  it('seeds no portfolio projects', () => {
    const portfolio = seedModules.find((m) => m.name === 'portfolio')
    expect(portfolio?.records).toHaveLength(2)
    expect(portfolio?.records.some((r) => r.fields.block_type === 'empty-state')).toBe(true)
  })
})

describe('the label library', () => {
  const group = (name: string) =>
    RECORDS.filter((r) => r.table === 'global_content' && r.fields.group_key === name)

  /**
   * §7 supplies thirteen CTAs. The fourteenth is "Return Home", which §45 and §46 name as the
   * secondary action on the 404 and error pages — Phase 10 seeded it when it built those surfaces,
   * because until then no page existed that could show it. Counted separately rather than folded
   * into the thirteen, so the specification's own number stays legible.
   */
  it('seeds §7, §30 and §31 in full', () => {
    const ctas = group('CTA')
    expect(ctas.filter((r) => r.seedKey.startsWith('global:'))).toHaveLength(13)
    expect(ctas.filter((r) => r.seedKey.startsWith('chrome:'))).toHaveLength(1)
    expect(group('COMMERCE_LABEL')).toHaveLength(10)
  })

  /**
   * Verification step 5 asserts ACTION_LABEL = 7, counting §31's product labels. The group holds
   * one more: Phase 08 seeded the media play button's label there before this phase ran, and
   * moving it to make a count come out would be filing a string under a group it does not belong
   * to. The precise requirement is that all seven §31 labels are present, which is what this
   * asserts.
   */
  it('seeds all seven §31 action labels, alongside the Phase 08 media label', () => {
    const keys = group('ACTION_LABEL').map((r) => r.fields.key)
    for (const key of [
      'customize_this_piece',
      'place_order',
      'discuss_on_whatsapp',
      'request_a_quote',
      'ask_about_this_piece',
      'view_details',
      'explore_similar_work',
    ]) {
      expect(keys, key).toContain(key)
    }
  })

  it('leaves Place Order disabled — there is no checkout', () => {
    const placeOrder = RECORDS.find((r) => r.seedKey === 'global:ACTION_LABEL.place_order')
    expect(placeOrder?.fields.is_enabled).toBe(false)
  })
})

describe('the content hash', () => {
  /**
   * The hash is what the whole owner-edit rule rests on, and it is compared across a `jsonb` round
   * trip. PostgreSQL reorders an object's keys, so a hash sensitive to key order reports every
   * payload-carrying row as edited on the very next run — which is exactly what happened to 31 of
   * them before `canonicalise` was added.
   */
  it('ignores object key order, at every depth', () => {
    const a = { payload: { is_video: false, autoplay: false, scrim: 45 }, heading: 'x' }
    const b = { heading: 'x', payload: { scrim: 45, autoplay: false, is_video: false } }
    expect(contentHash(a)).toBe(contentHash(b))
  })

  /** An array's order IS content — step 01 before step 02 — so reordering must change the hash. */
  it('does not ignore array order', () => {
    const a = { payload: { steps: [{ title: 'One' }, { title: 'Two' }] } }
    const b = { payload: { steps: [{ title: 'Two' }, { title: 'One' }] } }
    expect(contentHash(a)).not.toBe(contentHash(b))
  })

  it('still distinguishes a changed value', () => {
    expect(contentHash({ heading: 'One' })).not.toBe(contentHash({ heading: 'Two' }))
    expect(contentHash({ n: 10 })).not.toBe(contentHash({ n: '10' }))
    expect(contentHash({ a: null })).not.toBe(contentHash({ a: '' }))
  })
})
