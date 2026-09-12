#!/usr/bin/env node
/**
 * `sizes` BREAKPOINT GATE (Phase 45)
 *
 * An `<img sizes>` string is a PROMISE ABOUT THE LAYOUT, and the browser believes it before it has
 * any layout to check it against — it picks a derivative from `srcset` while the CSS is still
 * arriving. A promise that names a width where the layout does not actually change is therefore not
 * a cosmetic slip: it makes the browser fetch the wrong file, every time, for every visitor.
 *
 * THIS PROJECT HAS CUSTOM BREAKPOINTS AND TAILWIND'S DEFAULTS ARE NOT AMONG THEM. §5.2 fixes them
 * at the FEAT §45 QA widths — sm 430, md 768, lg 1024, xl 1280, 2xl 1440, 3xl 1920 — and the
 * declaration lives in the `@theme` block of `app/globals.css` as `--breakpoint-*`. Tailwind's own
 * defaults (640, 768, 1024, 1280, 1536) overlap in three places and differ in two, and 640 is the
 * one that hurts: it is the width every tutorial and every generated snippet writes, and `sm:` here
 * means 430.
 *
 * Phase 45 found SEVENTEEN `sizes` strings across fifteen files declaring `(min-width: 640px)` in a
 * product whose grids all switch at `sm:grid-cols-2`, i.e. at 430. Between 430 and 640 the layout
 * was already two-up while every one of those strings still claimed `100vw`, so the browser fetched
 * a derivative about twice as wide as the box — on the catalogue card, the article card, the
 * category grid and eleven more. Nothing in the repository could have caught it: `check-tokens.mjs`
 * reads classes, `check-utilities.mjs` compiles them, and a `sizes` value is an ordinary string.
 *
 * WHAT IS LEGAL. Every `(min-width: N)` inside a `sizes` attribute must name a declared breakpoint.
 * Nothing else is examined: the vw/px value on the right of the condition is a layout judgement
 * this script cannot make, and a `sizes` with no media query at all (a fixed `80px` thumbnail) is
 * exactly right and is left alone.
 *
 * Exit 1 on any undeclared width.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const ROOTS = ['app', 'components', 'lib']
const EXTENSIONS = ['.tsx', '.ts']

/** Widths declared in the `@theme` block, in px. Read, never hardcoded — one home per value. */
function declaredBreakpoints() {
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
  const widths = new Map()
  for (const match of css.matchAll(/--breakpoint-([\w]+):\s*([\d.]+)(rem|px)\s*;/gu)) {
    const [, name, value, unit] = match
    widths.set(name, unit === 'rem' ? Math.round(Number(value) * 16) : Number(value))
  }
  return widths
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXTENSIONS.some((extension) => entry.endsWith(extension))) out.push(full)
  }
  return out
}

const breakpoints = declaredBreakpoints()
if (breakpoints.size === 0) {
  console.error('✗ sizes: no --breakpoint-* declarations found in app/globals.css')
  process.exit(1)
}
const allowed = new Set(breakpoints.values())

/*
 * A `sizes` value, however it is written: a JSX string attribute, a default parameter, or an entry
 * in a lookup table. All three shapes exist in this repository, so the match is on the KEY rather
 * than on the JSX, and the value may be single- or double-quoted.
 */
const SIZES = /\bsizes\s*[:=]\s*['"]([^'"]+)['"]/gu
const MIN_WIDTH = /\(\s*min-width:\s*(\d+)px\s*\)/gu

const failures = []
let checked = 0

for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(SIZES)) {
      checked += 1
      const value = match[1]
      const line = source.slice(0, match.index).split('\n').length
      for (const width of value.matchAll(MIN_WIDTH)) {
        const px = Number(width[1])
        if (allowed.has(px)) continue
        const nearest = [...breakpoints.entries()]
          .map(([name, w]) => ({ name, w, d: Math.abs(w - px) }))
          .sort((a, b) => a.d - b.d)[0]
        failures.push(
          `${relative(ROOT, file)}:${String(line)} — sizes declares (min-width: ${String(px)}px), ` +
            `which is not a breakpoint. Nearest is ${nearest.name} at ${String(nearest.w)}px`,
        )
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ sizes: ${String(failures.length)} undeclared breakpoint(s)`)
  for (const failure of failures) console.error(`  ${failure}`)
  console.error(
    `\n  Declared: ${[...breakpoints.entries()].map(([n, w]) => `${n} ${String(w)}`).join(', ')}`,
  )
  process.exit(1)
}

console.log(
  `✓ sizes: ${String(checked)} sizes value(s); every min-width names one of ` +
    `${String(allowed.size)} declared breakpoints`,
)
