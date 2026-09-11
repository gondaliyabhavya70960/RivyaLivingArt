#!/usr/bin/env node
/**
 * CONTRAST OVER THE TOKEN MATRIX (Phase 41, WCAG 2.2 §1.4.3 and §1.4.11)
 *
 * Every text token the design system permits, against every surface it is permitted on, in every
 * scheme — computed rather than eyeballed.
 *
 * WHY A SCRIPT AND NOT AXE. Axe measures what a page happened to render, so it can only fail a
 * combination somebody put on screen — a token pair that is only used on one rarely-visited route is
 * checked on the day that route is in the sweep, and a pair that is legal but unused is never
 * checked at all until somebody uses it. This reads the tokens and checks the whole matrix, so a
 * failing combination is caught when it becomes POSSIBLE rather than when it becomes visible.
 *
 * THREE SCHEMES, AND THAT IS THE HALF MOST LIKELY TO ROT. `scheme.css` carries ocean, obsidian and
 * bone, and a colour change made while looking at one of them is a change made blind to the other
 * two. Every pair is checked in all three.
 *
 * THE RATIOS ARE WCAG'S: 4.5:1 for body text, 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold) and
 * for UI boundaries and focus indicators. Disabled text is exempt by the specification itself
 * (§1.4.3 excludes "incidental" and inactive components) — it is checked and reported, never failed
 * on, because a disabled control that meets 4.5:1 does not look disabled.
 *
 * IT RESOLVES `var()` CHAINS. `--rv-ink-primary: var(--rv-color-bone)` has to be followed to a
 * literal before anything can be computed, and the chain is two or three deep in places.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SCHEME_CSS = join(ROOT, 'app', 'styles', 'scheme.css')
const TOKENS_CSS = join(ROOT, 'app', 'styles', 'tokens.css')

/**
 * The matrix: which text token is permitted on which surface, and at what ratio.
 *
 * IT IS WRITTEN OUT RATHER THAN DERIVED, because "every ink on every surface" is not the rule — ink
 * on an inverse surface is a different pair from ink on the ground, and pairing them all would
 * report combinations the design system does not permit and nobody will fix.
 */
const PAIRS = [
  // Body text, 4.5:1.
  { ink: '--rv-ink-primary', surface: '--rv-surface-ground', ratio: 4.5, what: 'body text' },
  {
    ink: '--rv-ink-primary',
    surface: '--rv-surface-raised',
    ratio: 4.5,
    what: 'body text on a card',
  },
  { ink: '--rv-ink-secondary', surface: '--rv-surface-ground', ratio: 4.5, what: 'secondary text' },
  {
    ink: '--rv-ink-secondary',
    surface: '--rv-surface-raised',
    ratio: 4.5,
    what: 'secondary text on a card',
  },
  // Tertiary is used for captions and metadata, which are body-sized in this product.
  { ink: '--rv-ink-tertiary', surface: '--rv-surface-ground', ratio: 4.5, what: 'tertiary text' },
  {
    ink: '--rv-ink-tertiary',
    surface: '--rv-surface-raised',
    ratio: 4.5,
    what: 'tertiary text on a card',
  },
  { ink: '--rv-ink-accent', surface: '--rv-surface-ground', ratio: 4.5, what: 'accent text' },
  {
    ink: '--rv-ink-on-accent',
    surface: '--rv-surface-accent',
    ratio: 4.5,
    what: 'text on an accent fill',
  },
  // UI boundaries and the focus ring, 3:1 — against BOTH adjacent surfaces, because a ring drawn at
  // an offset sits on whatever is behind the element as well as on the element itself.
  {
    ink: '--rv-focus-ring',
    surface: '--rv-surface-ground',
    ratio: 3,
    what: 'the focus ring against the page',
  },
  {
    ink: '--rv-focus-ring',
    surface: '--rv-surface-raised',
    ratio: 3,
    what: 'the focus ring against a card',
  },
]

/** Reported, never failed on: §1.4.3 excludes inactive components. */
const ADVISORY = [
  { ink: '--rv-ink-disabled', surface: '--rv-surface-ground', ratio: 4.5, what: 'disabled text' },
]

/* --- reading the tokens ----------------------------------------------------------------------- */

/**
 * Declarations grouped by the selector block they appear in.
 *
 * A SCHEME IS A SELECTOR, so the blocks are what separate ocean from obsidian from bone. The
 * matching is deliberately simple — these two files are hand-written, flat, and have no nesting.
 */
function blocksOf(source) {
  /*
   * COMMENTS GO FIRST, and the first run of this gate is why the line exists. A CSS comment can
   * contain a brace, an `@media`, or a whole worked example — `scheme.css` opens with a nine-line
   * one — so a block regex run over the raw file reads the comment as part of the next selector and
   * then fails to resolve anything inside it. Stripping is one line and removes a whole class of
   * confusing output.
   */
  const css = source.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const blocks = []
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, ' ')
    const declarations = new Map()
    for (const line of match[2].split(';')) {
      const [name, ...rest] = line.split(':')
      if (name === undefined || rest.length === 0) continue
      const key = name.trim()
      if (!key.startsWith('--')) continue
      declarations.set(key, rest.join(':').trim())
    }
    if (declarations.size > 0) blocks.push({ selector, declarations })
  }
  return blocks
}

/** Follow `var(--x)` to a literal, within one scheme's declarations plus the global palette. */
function resolve(name, scheme, palette, depth = 0) {
  if (depth > 8) return null
  const raw = scheme.get(name) ?? palette.get(name)
  if (raw === undefined) return null
  const variable = /^var\(\s*(--[A-Za-z0-9-]+)\s*(?:,[^)]*)?\)$/.exec(raw)
  if (variable !== null) return resolve(variable[1], scheme, palette, depth + 1)
  return raw
}

/* --- colour maths ----------------------------------------------------------------------------- */

function parseColour(value) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (hex !== null) {
    const digits = hex[1]
    const full =
      digits.length === 3
        ? digits
            .split('')
            .map((character) => character + character)
            .join('')
        : digits
    return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16))
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value.trim())
  if (rgb !== null) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  // `oklch()` and friends would need a full colour-space conversion; they are not used in these two
  // files, and reporting "unresolved" is better than guessing a luminance.
  return null
}

function relativeLuminance([r, g, b]) {
  const channel = (value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const light = Math.max(relativeLuminance(a), relativeLuminance(b))
  const dark = Math.min(relativeLuminance(a), relativeLuminance(b))
  return (light + 0.05) / (dark + 0.05)
}

/* --- the run ---------------------------------------------------------------------------------- */

const schemeBlocks = blocksOf(readFileSync(SCHEME_CSS, 'utf8'))
const palette = new Map()
for (const block of blocksOf(readFileSync(TOKENS_CSS, 'utf8'))) {
  for (const [name, value] of block.declarations) if (!palette.has(name)) palette.set(name, value)
}

// A scheme block is one that defines the surface ground; anything else in the file is a fragment.
const schemes = schemeBlocks.filter((block) => block.declarations.has('--rv-surface-ground'))
if (schemes.length === 0) {
  console.error('✗ contrast: no scheme block defines --rv-surface-ground — has scheme.css moved?')
  process.exit(1)
}

const failures = []
const advisories = []
const unresolved = []
let checked = 0

for (const scheme of schemes) {
  for (const { pair, advisory } of [
    ...PAIRS.map((pair) => ({ pair, advisory: false })),
    ...ADVISORY.map((pair) => ({ pair, advisory: true })),
  ]) {
    const inkValue = resolve(pair.ink, scheme.declarations, palette)
    const surfaceValue = resolve(pair.surface, scheme.declarations, palette)
    if (inkValue === null || surfaceValue === null) {
      unresolved.push(`${scheme.selector}: ${pair.ink} on ${pair.surface}`)
      continue
    }
    const ink = parseColour(inkValue)
    const surface = parseColour(surfaceValue)
    if (ink === null || surface === null) {
      unresolved.push(
        `${scheme.selector}: ${pair.ink} on ${pair.surface} (not a hex or rgb colour)`,
      )
      continue
    }

    checked += 1
    const ratio = contrast(ink, surface)
    if (ratio >= pair.ratio) continue

    const message =
      `${scheme.selector} — ${pair.what}: ${pair.ink} on ${pair.surface} is ` +
      `${ratio.toFixed(2)}:1, needs ${String(pair.ratio)}:1`
    if (advisory) advisories.push(message)
    else failures.push(message)
  }
}

if (unresolved.length > 0) {
  // A pair that cannot be resolved is not a pass. A gate that silently skips what it cannot read
  // reports green on a stylesheet it no longer understands.
  console.error(`✗ contrast: ${String(unresolved.length)} token pair(s) could not be resolved:`)
  for (const entry of unresolved.slice(0, 10)) console.error(`    ${entry}`)
  process.exit(1)
}

if (failures.length > 0) {
  console.error(`✗ contrast: ${String(failures.length)} pair(s) below their ratio:`)
  for (const failure of failures) console.error(`    ${failure}`)
  process.exit(1)
}

console.log(
  `✓ contrast: ${String(checked)} token pair(s) across ${String(schemes.length)} scheme(s) meet ` +
    'their WCAG ratio' +
    (advisories.length > 0
      ? `; ${String(advisories.length)} advisory (disabled text, which §1.4.3 exempts)`
      : ''),
)
