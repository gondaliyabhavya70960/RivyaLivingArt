import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * THE CSS MOTION LAYER'S CONTRACT, ASSERTED AS TEXT.
 *
 * `app/styles/motion.css` carries the §4.2 entrance for every CMS band. It cannot be tested by
 * rendering: jsdom implements no scroll timelines, and the three properties that matter —
 * `animation-timeline`, `animation-range` and the `@supports` gate — are exactly the ones it drops.
 * A browser test would need a real scroll, which is the visual suite's job, not a unit's.
 *
 * So this reads the stylesheet and asserts the properties that make it SAFE, each of which is a way
 * the file could silently strand a band at `opacity: 0`:
 *
 *   · no `animation-name` outside the `@supports` block, so the unenhanced state is the finished
 *     state and a browser without scroll timelines renders exactly what it rendered before;
 *   · its own reduced-motion suppression, because `base.css`'s floor sets `animation-duration`,
 *     which is a TIME duration and aims at a different instrument than a progress timeline;
 *   · compositor properties only, per §4.2's third cross-cutting rule.
 *
 * Each of these was a real way to get this wrong, and none of them fails loudly in a browser — the
 * band simply never appears.
 */
const CSS = readFileSync(join(process.cwd(), 'app', 'styles', 'motion.css'), 'utf8')

/** The stylesheet with every block comment removed, so prose cannot satisfy an assertion. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** The body of the one `@supports (animation-timeline: view())` block, braces balanced. */
function supportsBlock(): string {
  const start = CODE.indexOf('@supports (animation-timeline: view())')
  expect(start).toBeGreaterThan(-1)
  let depth = 0
  for (let i = CODE.indexOf('{', start); i < CODE.length; i += 1) {
    if (CODE[i] === '{') depth += 1
    if (CODE[i] === '}') {
      depth -= 1
      if (depth === 0) return CODE.slice(start, i + 1)
    }
  }
  throw new Error('unbalanced @supports block')
}

describe('the scroll motion layer', () => {
  it('declares no animation outside the @supports gate', () => {
    // The whole safety argument: a browser with no scroll timeline must find no animation at all,
    // not an animation it cannot drive.
    const outside = CODE.replace(supportsBlock(), '')
    expect(outside).not.toMatch(/animation:\s*rv-/)
    expect(outside).not.toMatch(/animation-name:/)
  })

  it('gates the animated rules behind an explicit no-preference query', () => {
    expect(supportsBlock()).toContain('prefers-reduced-motion: no-preference')
  })

  it('suppresses itself under reduced motion rather than relying on the base.css floor', () => {
    expect(CODE).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    const reduce = CODE.slice(CODE.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/))
    expect(reduce).toContain('animation: none')
    expect(reduce).toContain('animation-timeline: none')
  })

  it('animates only compositor properties', () => {
    // §4.2: motion never animates a layout property. A keyframe touching height, margin or top
    // would be a reflow per frame on a band the size of the viewport.
    const keyframes = [...CODE.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)].map((m) => m[1])
    expect(keyframes.length).toBeGreaterThan(0)
    for (const body of keyframes) {
      for (const property of ['height', 'width', 'margin', 'padding', 'top', 'left', 'inset']) {
        expect(body).not.toMatch(new RegExp(`\\b${property}\\s*:`))
      }
    }
  })

  /**
   * THE ONE THIS FILE EXISTS FOR NOW, AND IT WAS FOUND IN A BROWSER RATHER THAN HERE.
   *
   * `rv-rise` used to fade 0 -> 1 alongside the rise. `animation-fill-mode: both` on a `view()`
   * timeline holds a band at its `from` keyframe until it enters, so on any long page exactly one
   * band is part way through the range at any moment — and while it is, every colour inside it
   * composites with whatever sits behind the section. Contrast became a function of SCROLL
   * POSITION.
   *
   * That is not a theory. `/large-format` at 390px failed axe's `color-contrast` at SERIOUS with
   * its `category-intro` heading measured at `opacity: 0.184` — 1.82:1 against a required 3:1 —
   * while the same band opaque is 17.55:1. Nothing about the band was wrong and no colour could
   * have fixed it; the page had simply got taller, which moved a different band into the range.
   *
   * So: no keyframe in this stylesheet may touch `opacity`. It is asserted over ALL keyframes
   * rather than over `rv-rise` by name, because the failure mode is the property, not the animation
   * — a new keyframe added later would carry it just the same, and the band does not fail loudly.
   */
  it('animates no opacity at all, because a partly-faded band fails contrast mid-scroll', () => {
    const keyframes = [...CODE.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)].map((m) => m[1])
    expect(keyframes.length).toBeGreaterThan(0)
    for (const body of keyframes) {
      expect(body).not.toMatch(/\bopacity\s*:/)
    }
  })

  it('exempts the first band on a page, which holds the LCP element', () => {
    expect(CODE).toMatch(/main\s*>\s*section:first-of-type\.rv-reveal/)
  })

  it('never lets a band and its own children both travel', () => {
    expect(supportsBlock()).toMatch(/\.rv-reveal:has\(\.rv-reveal-group\)/)
  })

  it('takes every duration and easing from a token', () => {
    // `check-tokens.mjs` covers arbitrary values in class names; this covers raw CSS, where a
    // hand-written `600ms` or a bespoke cubic-bezier would otherwise pass unnoticed.
    // `animation: none` is a suppression, not an animation, and has nothing to take from a token.
    const animations = [...CODE.matchAll(/animation:\s*([^;]+);/g)]
      .map((match) => (match[1] ?? '').trim())
      .filter((value) => value !== 'none')
    expect(animations.length).toBeGreaterThan(0)
    for (const value of animations) {
      expect(value).toMatch(/var\(--rv-duration-/)
      expect(value).toMatch(/var\(--rv-ease-/)
    }
    expect(CODE).not.toMatch(/cubic-bezier\(/)
  })

  it('is imported into the base layer, where base.css is', () => {
    const globals = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')
    expect(globals).toContain("@import './styles/motion.css' layer(base);")
  })
})
