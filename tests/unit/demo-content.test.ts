import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DEMO_ARTICLE_BODIES } from '../../scripts/demo/articles'
import { DEMO_PRODUCTS } from '../../scripts/demo/content'
import { DEMO_PROJECTS, DEMO_TESTIMONIALS } from '../../scripts/demo/portfolio'

/**
 * The demo content, checked against the one condition it exists under.
 *
 * The owner authorised placeholder rows so the site can be seen working, on the understanding that
 * none of it asserts a business fact. CLAUDE.md's prohibition is not suspended by that permission —
 * a fabricated price is a fabricated price whether or not `is_demo` is set beside it, and the owner
 * is the person who would be answering for it.
 *
 * EVERY ASSERTION HERE IS ABOUT A FAILURE THAT WOULD BE SILENT. Nobody reviewing a thirty-product
 * list notices that one of them acquired a dimension; the site would simply start telling visitors
 * something untrue, and it would look exactly like the other twenty-nine.
 */

const PRODUCT_TEXT = DEMO_PRODUCTS.map(
  (p) => `${p.title} ${p.subtitle} ${p.summary} ${p.description}`,
).join('\n')

const ALL_TEXT = [
  PRODUCT_TEXT,
  Object.values(DEMO_ARTICLE_BODIES)
    .flat()
    .map((b) => `${b.heading} ${b.body}`)
    .join('\n'),
  DEMO_PROJECTS.map((p) => `${p.title} ${p.subtitle} ${p.summary}`).join('\n'),
  DEMO_TESTIMONIALS.map((t) => `${t.attributedTo} ${t.attributionRole} ${t.quote}`).join('\n'),
].join('\n')

describe('demo products', () => {
  it('are the thirty the register names, with unique slugs', () => {
    expect(DEMO_PRODUCTS).toHaveLength(30)
    expect(new Set(DEMO_PRODUCTS.map((p) => p.slug)).size).toBe(30)
  })

  it('only ever use the seven seeded categories', () => {
    const seeded = new Set([
      'furniture',
      'collectible-design',
      '3d-resin',
      'wall-statement-art',
      'preservation',
      'decor',
      'gifts',
    ])
    for (const product of DEMO_PRODUCTS) {
      expect(seeded, product.slug).toContain(product.category)
    }
  })

  /**
   * The seeder writes `PRICE_ON_REQUEST` for all thirty and there is no price field on
   * `DemoProduct` to carry a number. This asserts the second half: that no price crept into the
   * PROSE, which is the one place the type system cannot stop it.
   */
  it('quote no price anywhere in their copy', () => {
    const money = /(₹|\bINR\b|\brs\.?\s*\d|\$\s*\d|\bpriced?\s+(at|from)\b|\bcosts?\s+\d)/i
    expect(PRODUCT_TEXT).not.toMatch(money)
  })

  /**
   * A dimension in a description is a measurement a visitor will believe. The seeder leaves
   * `products.dimensions` null; this catches "2400 x 1100 mm" written into a sentence instead.
   */
  it('state no dimension in their copy', () => {
    const measurement = /\d+\s*(mm|cm|centimetres?|metres?|m\b|inches|in\b|ft\b|feet)\b/i
    expect(PRODUCT_TEXT).not.toMatch(measurement)
  })

  /**
   * A lead time is one of the facts CLAUDE.md names outright, and it is the one most likely to be
   * written into a description without anybody thinking of it as a claim.
   */
  it('promise no lead time or delivery window', () => {
    const promise =
      /\b(\d+\s*(day|week|month)s?\b|lead\s*time|delivery\s+(in|within)|ships?\s+(in|within)|ready\s+in)\b/i
    expect(ALL_TEXT).not.toMatch(promise)
  })

  /** Awards, certifications and durability guarantees, all named in CLAUDE.md. */
  it('claim no award, certification or guarantee', () => {
    expect(ALL_TEXT).not.toMatch(
      /\b(award[- ]winning|certified|iso\s*\d|guarantee[ds]?|warrant(y|ied)|lifetime\b|scratch[- ]proof|waterproof)\b/i,
    )
  })
})

describe('demo testimonials', () => {
  /**
   * NOBODY IS NAMED, and this is the sharpest of the rules. Inventing a customer is what D10
   * forbids most directly, and `is_demo` beside it changes nothing: a visitor reading a quote
   * attributed to a person has been told that person said it.
   *
   * The check is that every attribution is explicitly a placeholder rather than that it "looks like
   * a role" — a heuristic on name shapes would pass "Priya S." on its first attempt.
   */
  it('attribute nothing to a person', () => {
    for (const testimonial of DEMO_TESTIMONIALS) {
      expect(testimonial.attributedTo.toLowerCase(), testimonial.quote).toContain('placeholder')
    }
  })

  it('say in their own words that they are placeholders', () => {
    for (const testimonial of DEMO_TESTIMONIALS) {
      expect(testimonial.quote.toLowerCase()).toContain('placeholder')
    }
  })
})

describe('demo projects', () => {
  /**
   * A project record is a claim that Rivya delivered work. The database refuses to publish these —
   * both evidence gates see to that — but a project naming a real place would still be a fabricated
   * delivered project sitting in the Studio for somebody to verify by mistake.
   */
  it('name no real location', () => {
    for (const project of DEMO_PROJECTS) {
      expect(project.locationLabel.toLowerCase(), project.slug).toContain('placeholder')
    }
  })

  it('are slugged so nobody mistakes one for a real archive entry', () => {
    for (const project of DEMO_PROJECTS) {
      expect(project.slug.startsWith('demo-'), project.slug).toBe(true)
    }
  })
})

describe('the register', () => {
  /**
   * `docs/content/DEMO_CONTENT.md` is the owner's condition for the whole exercise. A register that
   * had drifted from the modules would be worse than none: it would be a list somebody trusted.
   *
   * The counts are checked rather than the whole document — `npm run demo:check-register`
   * regenerates and diffs byte for byte, and duplicating that here would fail on a reworded
   * paragraph rather than on a missing row.
   */
  const register = readFileSync('docs/content/DEMO_CONTENT.md', 'utf8')

  it('names every count the modules actually hold', () => {
    expect(register).toContain(`## Products — ${DEMO_PRODUCTS.length} rows`)
    expect(register).toContain(
      `## Journal bodies — ${Object.keys(DEMO_ARTICLE_BODIES).length} pages`,
    )
    expect(register).toContain(`## Portfolio projects — ${DEMO_PROJECTS.length} rows`)
    expect(register).toContain(`## Testimonials — ${DEMO_TESTIMONIALS.length} rows`)
  })

  it('lists every product slug', () => {
    for (const product of DEMO_PRODUCTS) {
      expect(register, product.slug).toContain(`\`${product.slug}\``)
    }
  })

  it('tells the reader how to remove all of it', () => {
    expect(register).toContain('npm run demo:purge')
  })
})
