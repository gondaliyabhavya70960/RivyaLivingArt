import { describe, expect, it } from 'vitest'

import { seedModules } from '@/content/seed'
import type { SeedRecord } from '@/content/seed/types'

/**
 * What the journal seed writes, asserted against SEED §19 and §20 rather than against itself.
 *
 * THE RULE THIS FILE EXISTS FOR IS §20's, IN CAPITALS: seed the ten ideas as DRAFT, do NOT publish
 * automatically. Everything else here follows from it — an article with a body written by this
 * repository, or a status of PUBLISHED, would be editorial nobody commissioned appearing under
 * Rivya's name.
 *
 * IT CAUGHT A REAL MISTAKE. The records were authored in Phase 09 against a table Phase 18 had not
 * yet created, and they set `excerpt` to the article's ANGLE — the studio's internal brief for
 * whoever writes the piece. `excerpt` is what a card renders. Those ten briefs would have been
 * published as summaries on `/journal` the moment anything was. The angle now lives in
 * `angle_note`, which nothing renders.
 */

const records: readonly SeedRecord[] = seedModules.flatMap((module) => module.records)
const categories = records.filter((r) => r.table === ('journal_categories' as string))
const articles = records.filter((r) => r.table === ('journal_articles' as string))

/** SEED §19, in its order. */
const SEED_19 = [
  'Resin Furniture',
  'Collectible Design',
  'Materials',
  '3D Printing',
  'Studio Process',
  'Custom Projects',
  'Interior Art',
  'Preservation',
  'Care & Education',
] as const

/** SEED §20's ten titles, in its order. */
const SEED_20 = [
  'What Makes a Resin Table More Than a Surface?',
  'Choosing the Right Size for a Statement Dining Table',
  'Resin and Wood: Designing Around Contrast',
  'From Digital Form to Physical Object',
  'What to Prepare Before Requesting a Custom Furniture Commission',
  'A Guide to Resin Colour, Transparency and Visual Depth',
  'Large Wall Art: Thinking Beyond Decoration',
  'Preserving Flowers in Resin: What a Custom Brief Should Include',
  'How Material Choice Changes the Character of a Space',
  'Why Bespoke Furniture Starts With Context',
] as const

/** §20 attaches a caution to exactly these three, one-indexed as the specification numbers them. */
const FLAGGED = [2, 4, 8] as const

describe('the nine categories are SEED §19, in SEED §19 order', () => {
  it('seeds nine, and no more', () => {
    expect(categories).toHaveLength(SEED_19.length)
  })

  it('carries §19 names in §19 order, by ascending position', () => {
    const inOrder = [...categories].sort(
      (a, b) => Number(a.fields.position ?? 0) - Number(b.fields.position ?? 0),
    )
    expect(inOrder.map((record) => record.fields.name)).toEqual([...SEED_19])
  })

  /**
   * PUBLISHED, WHICH IS THE ONE EXCEPTION TO PHASE 09's RULE, and it is deliberate. A category is
   * taxonomy rather than copy: it asserts nothing about what Rivya can make. It also cannot work
   * any other way — `/journal/category/materials` reads through the anonymous policy, so a DRAFT
   * category is a page that 404s and a filter chip that leads nowhere.
   */
  it('seeds categories PUBLISHED and requiring no verification', () => {
    for (const record of categories) {
      expect(record.fields.status).toBe('PUBLISHED')
      expect(record.fields.owner_verification).toBe('NOT_REQUIRED')
    }
  })

  it('gives every category a slug distinct from every other', () => {
    const slugs = categories.map((record) => record.fields.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

describe('the ten articles are ideas, not articles', () => {
  it('seeds ten, with §20 titles in §20 order', () => {
    const inOrder = [...articles].sort((a, b) => a.seedKey.localeCompare(b.seedKey))
    expect(inOrder.map((record) => record.fields.title)).toEqual([...SEED_20])
  })

  /** §20, in capitals: "Do NOT publish automatically. Seed as DRAFT." */
  it('seeds every one DRAFT', () => {
    for (const record of articles) expect(record.fields.status).toBe('DRAFT')
  })

  /**
   * THE ANGLE IS THE BRIEF AND MUST NOT BE THE EXCERPT. `excerpt` is what a card renders; the angle
   * is what the studio wrote for whoever will write the piece. Putting one in the other publishes
   * the studio's internal notes, which is what the earlier version of this seed did.
   */
  it('puts the angle in angle_note and leaves excerpt empty', () => {
    const withAngles = articles.filter((record) => record.fields.angle_note !== null)
    expect(withAngles.length).toBeGreaterThan(0)
    for (const record of articles) {
      expect(record.fields.excerpt).toBeNull()
    }
  })

  /** Nothing in the seed may set a value the trigger derives, or one §20 forbids. */
  it('sets neither reading_minutes nor published_at nor a byline', () => {
    for (const record of articles) {
      expect(record.fields.reading_minutes).toBeUndefined()
      expect(record.fields.published_at).toBeUndefined()
      expect(record.fields.byline).toBeUndefined()
    }
  })

  it('flags exactly §20 articles 02, 04 and 08 for owner verification', () => {
    const flagged = articles
      .filter((record) => record.fields.owner_verification === 'OWNER_VERIFICATION_REQUIRED')
      .map((record) => Number(record.seedKey.split(':')[1]))
      .sort((a, b) => a - b)
    expect(flagged).toEqual([...FLAGGED])
  })

  it('files every article under one of the nine categories', () => {
    const categoryKeys = new Set(categories.map((record) => record.seedKey))
    for (const record of articles) {
      const ref = record.refs?.primary_category_id
      expect(ref).toBeDefined()
      expect(ref?.table).toBe('journal_categories')
      expect(categoryKeys.has(ref?.seedKey ?? '')).toBe(true)
    }
  })

  /**
   * A DISTINCT DESKTOP COVER EACH, AND A MOBILE ONE ONLY WHERE A PORTRAIT ASSET EXISTS. Four of the
   * sixteen `editorial` images are 4:5 or 3:4; the rest of the articles get no mobile binding rather
   * than a landscape asset squeezed into a portrait frame. D6 keeps the two slots separate exactly
   * so "there is no portrait asset" has a representation.
   */
  it('binds a distinct desktop cover to every article', () => {
    const desktops = articles.map((record) => record.media?.cover_media_id)
    expect(desktops.every((id) => typeof id === 'string' && id !== '')).toBe(true)
    expect(new Set(desktops).size).toBe(articles.length)
  })

  it('binds no duplicate mobile cover, and never a video', () => {
    const mobiles = articles
      .map((record) => record.media?.cover_mobile_media_id)
      .filter((id): id is string => typeof id === 'string')
    expect(new Set(mobiles).size).toBe(mobiles.length)
    // EDITORIAL-017/-018/-019 are the three videos in the family. A cover is a still; a video cover
    // would autoplay in a card grid, and nothing in this phase renders one.
    const videos = ['EDITORIAL-017', 'EDITORIAL-018', 'EDITORIAL-019']
    const all = [...articles.map((r) => r.media?.cover_media_id), ...mobiles]
    expect(all.filter((id) => videos.includes(id ?? ''))).toEqual([])
  })
})

describe('the journal seed writes no article body', () => {
  /**
   * There is no column for one, and that is the strongest form this rule can take: the body is a
   * `pages` block document created in the Studio, so a seed record has nowhere to put prose even if
   * somebody wanted it to.
   */
  it('sets no field that could hold prose', () => {
    for (const record of articles) {
      expect(record.fields.body).toBeUndefined()
      expect(record.fields.standfirst).toBeUndefined()
      expect(record.fields.page_id).toBeUndefined()
    }
  })
})
