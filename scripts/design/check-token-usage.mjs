#!/usr/bin/env node
/**
 * TOKEN USAGE GATE — a Phase 45 deliverable that was specified and never written.
 *
 * `PHASE-39-46.md` §45 lists `scripts/design/check-token-usage.mjs` under Deliverables — "reports
 * raw values used where a token exists; fails on new ones" — and its verification step 6 says "no
 * new raw value where a token exists". Its risk table says what the gate is actually for: *per-route
 * overrides accumulate and the design system stops being one*, mitigated by "a change expressible
 * only as a route override is treated as a wrong token".
 *
 * WHAT "WHERE A TOKEN EXISTS" MEANS HERE, and it is the whole design. The naive reading — flag a
 * literal that happens to equal some token's value — produces advice nobody should take. `1rem`
 * equals `--rv-text-base`, so `margin-bottom: 1rem` would be told to use a FONT SIZE token for a
 * margin. So the check is keyed on the PROPERTY, not the value: each token family declares the CSS
 * properties it governs, and any literal in one of those properties is a raw value, whether or not
 * a token happens to carry that exact number. `padding-block: 13px` is the failure this catches and
 * a value-equality check never would — 13px is not on the scale, which is precisely the problem.
 *
 * WHY IT COVERS WHAT THE OTHER GATES DO NOT. `check-tokens.mjs` reads Tailwind CLASSES: it refuses
 * `p-[13px]` and a colour literal. Neither rule reaches a stylesheet or a `style={{ }}` object, and
 * both are where an override goes once the class form is blocked. `app/styles/base.css` and a
 * per-route `page.css` are ordinary CSS, and nothing read them until this ran.
 *
 * WHAT IT DELIBERATELY LEAVES ALONE, each because another gate owns it:
 *
 *   colour                 check-tokens.mjs — hex, rgb() and named colours outside app/styles/**
 *   duration and easing    check-motion-tokens.mjs — the declared duration and easing token sets
 *   breakpoints in sizes   check-sizes-breakpoints.mjs — `(min-width: N)` inside a `sizes` string
 *
 * Two reports, one exit code: the raw values it found, and the exemptions it granted. An exemption
 * that is not printed is an exemption that hides, so both lists are always shown.
 *
 * Exit 1 on any raw value in a governed property.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const TOKENS = join(ROOT, 'app', 'styles', 'tokens.css')

/* ------------------------------------------------------------------ the governed properties */

/**
 * Token family → the CSS properties that family is the scale for.
 *
 * A property appears under exactly one family. `line-height` is `--rv-leading-*` and nothing else,
 * so the message the gate prints can name the family a value should have come from rather than
 * shrugging at "a token".
 *
 * `--rv-bp-*`, `--rv-color-*`, `--rv-neutral-*`, `--rv-duration-*`, `--rv-ease-*`, `--rv-motion-*`,
 * `--rv-3d-*`, `--rv-grid-*`, `--rv-section-*`, `--rv-font-*`, `--rv-focus-*`, `--rv-media-*`,
 * `--rv-hero-*` and `--rv-gutter` are absent on purpose: the first five are another gate's (see the
 * header), and the rest are COMPONENT tokens — one home, one consumer — rather than a scale a
 * second declaration could drift from.
 */
const FAMILIES = {
  space: [
    'padding',
    'padding-block',
    'padding-block-start',
    'padding-block-end',
    'padding-inline',
    'padding-inline-start',
    'padding-inline-end',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'margin',
    'margin-block',
    'margin-block-start',
    'margin-block-end',
    'margin-inline',
    'margin-inline-start',
    'margin-inline-end',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'gap',
    'row-gap',
    'column-gap',
    'scroll-margin',
    'scroll-margin-block-start',
    'scroll-padding',
    'scroll-padding-block-start',
  ],
  text: ['font-size'],
  leading: ['line-height'],
  tracking: ['letter-spacing'],
  radius: [
    'border-radius',
    'border-start-start-radius',
    'border-start-end-radius',
    'border-end-start-radius',
    'border-end-end-radius',
  ],
  border: [
    'border-width',
    'border-block-width',
    'border-inline-width',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'outline-width',
    'text-decoration-thickness',
  ],
  shadow: ['box-shadow'],
  weight: ['font-weight'],
  z: ['z-index'],
}

/** property → the family that governs it. */
const GOVERNED = new Map()
for (const [family, properties] of Object.entries(FAMILIES)) {
  for (const property of properties) GOVERNED.set(property, family)
}

/**
 * The tokens each family actually declares, read from tokens.css rather than assumed.
 *
 * Used only to name the alternatives in the failure message — the gate does not need them to
 * decide, but a message that says "use one of --rv-space-1 … --rv-space-24" is one somebody can act
 * on without opening another file.
 */
function declaredTokens() {
  const css = readFileSync(TOKENS, 'utf8')
  const byFamily = new Map()
  for (const family of Object.keys(FAMILIES)) {
    const names = [...css.matchAll(new RegExp(`(--rv-${family}-[a-z0-9-]+)\\s*:`, 'g'))].map(
      (match) => match[1],
    )
    byFamily.set(family, names)
  }
  return byFamily
}

const TOKENS_BY_FAMILY = declaredTokens()

/*
 * A GATE THAT CANNOT FIND ITS OWN SUBJECT MUST FAIL, not pass — the rule `check-motion-tokens.mjs`
 * and `check-video-props.mjs` already follow. If the token block is renamed or moved, every family
 * comes back empty and the advice below degrades to "use a token" with no token to name.
 */
const emptyFamilies = [...TOKENS_BY_FAMILY].filter(([, names]) => names.length === 0)
if (emptyFamilies.length > 0) {
  console.error(
    `check-token-usage: found no tokens for ${emptyFamilies.map(([f]) => f).join(', ')} in app/styles/tokens.css.\n` +
      'The gate cannot name an alternative it cannot read — has the token block moved?',
  )
  process.exit(1)
}

/* ------------------------------------------------------------------ what is not a raw value */

/**
 * Values that are legal in a governed property without a token.
 *
 * `0` has no unit and no scale position — it is the absence of the thing, not a step on the ladder,
 * and `padding: var(--rv-space-0)` reads worse than `padding: 0` for no gain. The keywords are CSS
 * defaults. The percentages and `auto` are layout relationships rather than lengths: `margin-inline:
 * auto` centres, it does not measure.
 */
const LEGAL = /^(0|0px|auto|none|inherit|initial|unset|revert|normal|100%|50%|0%)$/

/** A value carrying no digit cannot be a raw length. `currentColor`, `bold`, `inset` and friends. */
const hasNumber = (value) => /[0-9]/.test(value)

/**
 * A value that contains no raw length, however it is assembled.
 *
 * `calc(var(--rv-space-3) + env(safe-area-inset-bottom, 0px))` and
 * `clamp(var(--rv-space-4), 2vw, var(--rv-space-8))` are the shapes a real layout needs, and both
 * carry digits. What makes them legal is that every LENGTH in them is an indirection: a custom
 * property, or an environment value the device supplies. The bare numbers left over are
 * multipliers, and the viewport units are relationships to a viewport no scale can predict.
 *
 * `env()` COUNTS AS AN INDIRECTION, AND ITS FALLBACK COUNTS WITH IT. The safe-area inset is a
 * number the phone chooses; `0px` is what to use on a device that has no notch, not a spacing
 * decision. A first version of this stripped only `var()`, and flagged the sticky submit row's
 * padding — which is exactly right in form and exactly wrong in substance.
 *
 * A BARE NUMBER IS ONLY A FACTOR INSIDE ARITHMETIC. `calc(… * -1)` is a direction, but
 * `font-weight: 600`, `line-height: 1.5` and `z-index: 40` are unitless values that ARE the thing
 * their token declares, so outside a math function a bare number is as raw as `13px`.
 */
const INDIRECTION = /\b(?:var|env)\(\s*[a-zA-Z0-9-]+\s*(?:,[^()]*)?\)/g
const RELATIVE_UNIT =
  /-?\d*\.?\d+(svh|svw|lvh|lvw|dvh|dvw|vh|vw|vmin|vmax|cqw|cqh|cqi|cqb|%|fr|ch|ex)/g
const ZERO = /\b0(px|rem|em)?\b/g
const MATH = /\b(?:calc|clamp|min|max|round)\(/

function noRawLength(value) {
  let rest = value.replace(INDIRECTION, ' ').replace(RELATIVE_UNIT, ' ').replace(ZERO, ' ')
  if (MATH.test(value)) rest = rest.replace(/-?\d*\.?\d+(?![a-z%])/gi, ' ')
  return !/\d/.test(rest.replace(/\b(?:calc|clamp|min|max|round)\b/g, ' '))
}

/* ------------------------------------------------------------------ file walk */

const SCAN_DIRS = ['app', 'components']
const SKIP = new Set(['node_modules', '.next'])

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries.sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (SKIP.has(name)) continue
      walk(full, out)
    } else if (/\.(tsx?|css)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Files the gate does not read, each for a reason that is about the file rather than its contents.
 *
 * `tokens.css` IS the scale: a gate that refused literals there would refuse the declaration of
 * every token it exists to enforce.
 *
 * A PRINT STYLESHEET IS A DIFFERENT MEDIUM. `print.css` measures a sheet of A4 in millimetres and
 * sets type in points, because that is what a printer understands and what `@page` accepts. The
 * screen scale is px and rem on a viewport that has no edges; forcing a page that does have edges
 * onto it would not make the system more coherent, it would make the brief print wrong. The
 * exemption is by filename and is printed on every run, so a second print stylesheet appearing
 * somewhere unexpected shows up in the report rather than passing quietly.
 */
const EXEMPT_FILES = [
  { match: (path) => path === 'app/styles/tokens.css', why: 'declares the scale' },
  {
    match: (path) => path.endsWith('print.css'),
    why: 'print medium: mm and pt, not the screen scale',
  },
]

/* ------------------------------------------------------------------ extraction */

/** Line number for a character offset, 1-based. */
function lineAt(text, offset) {
  let line = 1
  for (let i = 0; i < offset; i += 1) if (text[i] === '\n') line += 1
  return line
}

/**
 * Declarations in a stylesheet, skipping any at-rule block whose medium is not the screen.
 *
 * `@page` and `@media print` are the same exemption as `print.css` and for the same reason; a
 * stylesheet that carries one block of print rules should not have to become a second file to say
 * so. Depth is tracked rather than matched, because the skipped block may nest.
 */
function cssDeclarations(text) {
  const out = []
  let depth = 0
  let printDepth = null
  text.split('\n').forEach((line, index) => {
    const opensPrint = /@(page|media[^;{]*\bprint\b)/.test(line)
    if (opensPrint && printDepth === null) printDepth = depth
    if (printDepth === null) {
      const match = /^\s*([a-z-]+)\s*:\s*([^;{}]+);/.exec(line)
      if (match !== null) out.push({ line: index + 1, property: match[1], value: match[2].trim() })
    }
    depth += (line.match(/\{/g) ?? []).length
    depth -= (line.match(/\}/g) ?? []).length
    if (printDepth !== null && depth <= printDepth) printDepth = null
  })
  return out
}

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/**
 * Declarations inside a `style={{ … }}` expression, and nowhere else in the file.
 *
 * SCOPING TO THE EXPRESSION IS NOT FUSSINESS. A first version matched `name: 'value'` anywhere and
 * flagged `const CELL_CLASS = { gap: 'bg-state-warning/15' }` in the scheduling page — an object
 * whose key happens to be a CSS property name and whose value is a Tailwind class. Every such hit
 * is noise, and a gate that cries wolf gets suppressed rather than fixed.
 */
function inlineStyleDeclarations(text) {
  const out = []
  const opener = /style=\{\{/g
  let match
  while ((match = opener.exec(text)) !== null) {
    let depth = 2
    let i = match.index + match[0].length
    const start = i
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth += 1
      else if (text[i] === '}') depth -= 1
      i += 1
    }
    const body = text.slice(start, i - 2)
    for (const entry of body.matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*:\s*'([^']*)'/g)) {
      out.push({
        line: lineAt(text, start + entry.index),
        property: kebab(entry[1]),
        value: entry[2].trim(),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ the sweep */

const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)))
const raw = []
const exempted = []
let declarationsRead = 0

for (const file of files) {
  const path = relative(ROOT, file).split('\\').join('/')
  const exemption = EXEMPT_FILES.find((rule) => rule.match(path))
  if (exemption !== undefined) {
    exempted.push({ path, why: exemption.why })
    continue
  }

  const text = readFileSync(file, 'utf8')
  const declarations = file.endsWith('.css') ? cssDeclarations(text) : inlineStyleDeclarations(text)

  for (const declaration of declarations) {
    const family = GOVERNED.get(declaration.property)
    if (family === undefined) continue
    declarationsRead += 1
    const { value } = declaration
    if (LEGAL.test(value)) continue
    if (!hasNumber(value)) continue
    if (noRawLength(value)) continue
    raw.push({ path, family, ...declaration })
  }
}

/* ------------------------------------------------------------------ report */

if (exempted.length > 0) {
  console.log(`check-token-usage: ${exempted.length} file(s) exempt`)
  for (const { path, why } of exempted) console.log(`  ${path} — ${why}`)
  console.log('')
}

if (raw.length === 0) {
  console.log(
    `check-token-usage: clean — ${declarationsRead} declaration(s) in ${GOVERNED.size} governed properties, every length a token.`,
  )
  process.exit(0)
}

console.error(`check-token-usage: ${raw.length} raw value(s) where a token governs the property\n`)
for (const hit of raw) {
  const names = TOKENS_BY_FAMILY.get(hit.family)
  const range = names.length > 2 ? `${names[0]} … ${names[names.length - 1]}` : names.join(', ')
  console.error(`  ${hit.path}:${hit.line}`)
  console.error(`    ${hit.property}: ${hit.value}`)
  console.error(`    --rv-${hit.family}-* governs ${hit.property}; use one of ${range}`)
}
console.error(
  '\nA value that no token can express is a token the scale is missing — add it to' +
    '\napp/styles/tokens.css, where a reviewer sees it, rather than inline where nobody does.',
)
process.exit(1)
