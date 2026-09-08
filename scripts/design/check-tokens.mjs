#!/usr/bin/env node
/**
 * TOKEN DISCIPLINE GATE (Phase 02)
 *
 * Three checks, all of which must pass:
 *
 *   1. No colour literal outside app/styles/**. A hex, rgb()/rgba() or CSS named colour
 *      anywhere in app/ or components/ means a value escaped the token layer.
 *   2. No arbitrary-value Tailwind class (p-[13px], text-[#fff], gap-[7px]). The spacing
 *      scale is bridged to --rv-space-1; an arbitrary value bypasses it.
 *   3. The neutral ramp in tokens.css is RE-DERIVED from the rule in DESIGN_SYSTEM.md §2.2 —
 *      ten OKLab-interpolated steps between obsidian and bone — and compared byte for byte.
 *      Nobody hand-picks an eleventh grey.
 *
 * Exit 1 on any violation. Run in CI and before any page work begins.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const TOKENS = join(ROOT, 'app/styles/tokens.css')

/* ------------------------------------------------------------------ colour space */

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}
const hexToLinear = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255))
}
const linearToOklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
const oklabToHex = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return '#' + rgb.map((c) => linearToSrgb(c).toString(16).padStart(2, '0')).join('')
}

/* ------------------------------------------------------------------ file walk */

const SCAN_DIRS = ['app', 'components', 'lib']
const SKIP = new Set(['node_modules', '.next', 'styles'])

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      // app/styles is the one place a colour literal is permitted.
      if (SKIP.has(name)) continue
      walk(full, out)
    } else if (/\.(tsx?|css|mjs)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const problems = []

/* ---------------------------------------------- 1 + 2: literals and arbitrary values */

// Named colours that would actually change a rendered pixel. `transparent`, `currentColor`
// and `inherit` are keywords, not values, and are allowed.
const NAMED =
  /(^|[^-\w])(white|black|red|blue|green|yellow|orange|purple|pink|gray|grey|silver|gold|navy|teal|olive|maroon|lime|aqua|fuchsia)([^-\w]|$)/i
const HEX = /#[0-9a-fA-F]{3,8}\b/
const RGB = /\brgba?\s*\(/
const ARBITRARY =
  /\b(?:bg|text|border|p|px|py|pt|pb|pl|pr|m|mx|my|gap|w|h|size|top|left|right|bottom|inset|rounded|shadow|z)-\[[^\]]+\]/

/**
 * `utility-[--var]` is a silent invalid-CSS producer, and the nastiest bug this file catches.
 *
 * In Tailwind 4 the bracket form is an arbitrary VALUE, so `duration-[--rv-duration-fast]`
 * compiles to `transition-duration: --rv-duration-fast` — invalid CSS the browser drops. The
 * result is no transition at all, reported by nothing: not typecheck, not lint, not the unit
 * tests, and not check-utilities, which skips arbitrary values by design so one violation is
 * not reported by two gates. The variable reference is the parenthesis form,
 * `duration-(--rv-duration-fast)`, which compiles to `var(--rv-duration-fast)`.
 *
 * It was present in nine components at once, which is why it is a gate and not a review note.
 */
const BRACKET_VAR = /[a-z-]+-\[--[a-zA-Z0-9-]+\]/

for (const file of SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file)
  if (rel.split(sep).slice(0, 2).join('/') === 'app/styles') continue
  readFileSync(file, 'utf8')
    // Strip BLOCK comments across lines before scanning. A component that explains why it
    // avoids `px-[...]` must not be reported for the arbitrary value it is warning about,
    // and a comment quoting a hex to justify a token decision is documentation, not a
    // literal. Stripping only single-line comments misses both.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .forEach((line, i) => {
      const where = `${rel}:${i + 1}`
      const code = line.replace(/\/\/.*$/, '')
      if (HEX.test(code)) problems.push(`${where}  colour literal (hex) outside app/styles/`)
      if (RGB.test(code)) problems.push(`${where}  colour literal (rgb) outside app/styles/`)
      if (NAMED.test(code) && /class(Name)?\s*[=:]/.test(code))
        problems.push(`${where}  CSS named colour in a class attribute`)
      const arb = code.match(ARBITRARY)
      if (arb)
        problems.push(`${where}  arbitrary Tailwind value ${arb[0]} bypasses the token scale`)
      const bracketVar = code.match(BRACKET_VAR)
      if (bracketVar) {
        const fixed = bracketVar[0].replace('[', '(').replace(']', ')')
        problems.push(
          `${where}  ${bracketVar[0]} is an arbitrary value, not a variable reference — it ` +
            `compiles to invalid CSS the browser drops silently. Use ${fixed}`,
        )
      }
    })
}

/* ------------------------------------------------------- 3: re-derive the neutral ramp */

const tokensSrc = readFileSync(TOKENS, 'utf8')
const readToken = (name) => {
  const m = tokensSrc.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`))
  return m ? m[1].toLowerCase() : null
}

const obsidian = readToken('--rv-color-obsidian')
const bone = readToken('--rv-color-bone')
if (!obsidian || !bone) {
  problems.push(
    'tokens.css  --rv-color-obsidian or --rv-color-bone is missing or not a 6-digit hex',
  )
} else {
  const a = linearToOklab(hexToLinear(obsidian))
  const b = linearToOklab(hexToLinear(bone))
  const steps = [900, 800, 700, 600, 500, 400, 300, 200, 100, 50]
  steps.forEach((step, i) => {
    const t = i / 9
    const derived = oklabToHex([0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t))
    const declared = readToken(`--rv-neutral-${step}`)
    if (declared === null) {
      problems.push(`tokens.css  --rv-neutral-${step} is missing`)
    } else if (declared !== derived) {
      problems.push(
        `tokens.css  --rv-neutral-${step} is ${declared} but the OKLab rule derives ${derived} ` +
          `— the ramp is generated, not chosen (DESIGN_SYSTEM §2.2)`,
      )
    }
  })
}

/* ------------------------------------------------------------------ report */

if (problems.length) {
  console.error('Token discipline violations:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(`\n${problems.length} violation(s).`)
  process.exit(1)
}
console.log(
  'token discipline: clean — no colour literals outside app/styles/, no arbitrary values, neutral ramp re-derives exactly',
)
