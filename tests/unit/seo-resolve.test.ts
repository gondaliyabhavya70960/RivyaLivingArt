import { describe, expect, it } from 'vitest'

import {
  DERIVED_DESCRIPTION_LENGTH,
  deriveEntitySeo,
  deriveSeo,
  resolveSeo,
  truncateAtWord,
  type SeoEntryLike,
} from '@/lib/seo/resolve'

/**
 * The four-level ladder, one rung at a time — Phase 39 exit criterion 1.
 *
 * EACH TEST REMOVES A RUNG AND CHECKS WHAT ANSWERS. The rule under test is the ORDER and the fact
 * that it is climbed per field: a path row with a title and no description lends its title and
 * lets the description fall through, rather than dragging the page to the path level whole.
 */

const row = (partial: Partial<SeoEntryLike>): SeoEntryLike => ({
  title: null,
  description: null,
  social_title: null,
  social_description: null,
  og_media_id: null,
  canonical_url: null,
  robots: null,
  noindex: false,
  nofollow: false,
  ...partial,
})

const GLOBAL = row({
  title: 'Rivya Living Art',
  description: 'Global description',
  og_media_id: 'og-global',
})
const PATH = row({ title: 'About', description: 'Path description' })
const ENTITY = row({
  title: 'Wave Table',
  description: 'Entity description',
  canonical_url: 'https://rivya.example/product/wave-table',
})
const DERIVED = { title: 'First heading', description: 'First body, cut at 155.' }

describe('resolveSeo — the order', () => {
  it('ENTITY wins over everything', () => {
    const r = resolveSeo({ entity: ENTITY, path: PATH, derived: DERIVED, global: GLOBAL })
    expect(r.title).toEqual({ value: 'Wave Table', level: 'ENTITY' })
    expect(r.description).toEqual({ value: 'Entity description', level: 'ENTITY' })
  })

  it("an entity's own SEO columns count as the ENTITY rung, below its entry row", () => {
    const r = resolveSeo({
      entity: row({ title: 'From the entry' }),
      entityOwn: { title: 'From the product column', description: 'Own description' },
      path: PATH,
      global: GLOBAL,
    })
    expect(r.title).toEqual({ value: 'From the entry', level: 'ENTITY' })
    expect(r.description).toEqual({ value: 'Own description', level: 'ENTITY' })
  })

  it('PATH answers when there is no entity', () => {
    const r = resolveSeo({ path: PATH, derived: DERIVED, global: GLOBAL })
    expect(r.title).toEqual({ value: 'About', level: 'PATH' })
  })

  it('DERIVED answers when the path row is silent', () => {
    const r = resolveSeo({ derived: DERIVED, global: GLOBAL })
    expect(r.title).toEqual({ value: 'First heading', level: 'DERIVED' })
    expect(r.description).toEqual({ value: 'First body, cut at 155.', level: 'DERIVED' })
  })

  it('GLOBAL is the last rung', () => {
    const r = resolveSeo({ global: GLOBAL })
    expect(r.title).toEqual({ value: 'Rivya Living Art', level: 'GLOBAL' })
    expect(r.ogMediaId).toEqual({ value: 'og-global', level: 'GLOBAL' })
  })

  it('is NONE, not an invented sentence, when every rung is empty', () => {
    const r = resolveSeo({})
    expect(r.title).toEqual({ value: null, level: 'NONE' })
    expect(r.description).toEqual({ value: null, level: 'NONE' })
    expect(r.socialTitle.level).toBe('NONE')
  })

  it('climbs per field: a path title with a derived description', () => {
    const r = resolveSeo({ path: row({ title: 'About' }), derived: DERIVED, global: GLOBAL })
    expect(r.title.level).toBe('PATH')
    expect(r.description.level).toBe('DERIVED')
  })

  it('treats a blank field as missing rather than as an empty title', () => {
    const r = resolveSeo({ path: row({ title: '   ' }), global: GLOBAL })
    expect(r.title).toEqual({ value: 'Rivya Living Art', level: 'GLOBAL' })
  })
})

describe('resolveSeo — social, canonical, directive', () => {
  it('social title falls back to the resolved page title before the site social default', () => {
    const r = resolveSeo({
      path: PATH,
      global: row({ social_title: 'Brand strapline', title: 'Brand' }),
    })
    expect(r.socialTitle).toEqual({ value: 'About', level: 'PATH' })
  })

  it('a canonical comes from ENTITY or PATH only, never GLOBAL', () => {
    expect(resolveSeo({ entity: ENTITY, global: GLOBAL }).canonicalUrl.level).toBe('ENTITY')
    expect(
      resolveSeo({ global: row({ canonical_url: 'https://x.example/' }) }).canonicalUrl,
    ).toEqual({
      value: null,
      level: 'NONE',
    })
  })

  it('takes the directive whole from the first rung that states one', () => {
    const r = resolveSeo({
      entity: row({ noindex: true }),
      path: row({ nofollow: true }),
    })
    expect(r.noindex).toBe(true)
    expect(r.nofollow).toBe(false)
    expect(r.robotsLevel).toBe('ENTITY')
  })

  it('reads the legacy robots string', () => {
    const r = resolveSeo({ path: row({ robots: 'noindex,follow' }) })
    expect(r.noindex).toBe(true)
    expect(r.nofollow).toBe(false)
    expect(r.robotsLevel).toBe('PATH')
  })

  it('is index, follow at NONE when no row says anything', () => {
    const r = resolveSeo({ global: GLOBAL })
    expect(r.noindex).toBe(false)
    expect(r.nofollow).toBe(false)
    expect(r.robotsLevel).toBe('NONE')
  })
})

describe('deriveSeo — deliberately dumb', () => {
  it('takes the first heading and the first body, which need not be the same section', () => {
    const d = deriveSeo([
      { heading: 'Hero heading', body: null },
      { heading: 'Manifesto', body: 'The manifesto body.' },
    ])
    expect(d).toEqual({ title: 'Hero heading', description: 'The manifesto body.' })
  })

  it('never concatenates two sections', () => {
    const d = deriveSeo([
      { heading: null, body: 'One.' },
      { heading: null, body: 'Two.' },
    ])
    expect(d.description).toBe('One.')
  })

  it('cuts the description at 155 on a word boundary, with no ellipsis', () => {
    const body = Array.from({ length: 60 }, (_, i) => `word${String(i)}`).join(' ')
    const d = deriveSeo([{ heading: null, body }])
    expect(d.description?.length).toBeLessThanOrEqual(DERIVED_DESCRIPTION_LENGTH)
    expect(d.description).not.toContain('…')
    expect(d.description?.endsWith(' ')).toBe(false)
    expect(body.startsWith(d.description as string)).toBe(true)
  })

  it('strips markdown emphasis so a description never opens with an asterisk', () => {
    expect(deriveSeo([{ heading: null, body: '**Bold** start' }]).description).toBe('Bold start')
  })

  it('is null on both counts for a page with nothing live', () => {
    expect(deriveSeo([])).toEqual({ title: null, description: null })
  })

  it('derives an entity from its name and summary by the same rule', () => {
    expect(deriveEntitySeo({ name: ' Wave Table ', summary: null })).toEqual({
      title: 'Wave Table',
      description: null,
    })
  })
})

describe('truncateAtWord', () => {
  it('leaves a short string alone and collapses whitespace', () => {
    expect(truncateAtWord('a  b\n c', 20)).toBe('a b c')
  })
  it('cuts on the last space before the mark', () => {
    expect(truncateAtWord('alpha beta gamma', 11)).toBe('alpha beta')
  })
  it('hard-cuts a single word longer than the mark', () => {
    expect(truncateAtWord('x'.repeat(200), 10)).toBe('x'.repeat(10))
  })
  it('drops trailing punctuation left by the cut', () => {
    expect(truncateAtWord('alpha, beta, gamma', 12)).toBe('alpha, beta')
  })
})
