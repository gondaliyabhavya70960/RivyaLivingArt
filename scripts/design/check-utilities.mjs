#!/usr/bin/env node
/**
 * DEAD-UTILITY GATE (Phase 02)
 *
 * A Tailwind utility whose name is not defined in the `@theme` block of app/globals.css
 * does not error — it produces no CSS at all. `bg-surface-raised-3` renders exactly like
 * a missing attribute, so a component silently loses its background and nothing in
 * typecheck, lint or the unit tests notices.
 *
 * This compiles the real stylesheet (app/globals.css, with the actual token layer) and
 * asserts that every class candidate used in the product resolves to a rule. It is the
 * only check in the repository that catches that failure mode.
 *
 * Exit 1 on any candidate that produces no CSS.
 */
import { compile } from 'tailwindcss'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(join(fileURLToPath(import.meta.url), '..', '..', '..'))
const TW = resolve(ROOT, 'node_modules/tailwindcss')

/* ------------------------------------------------------------------ candidate shapes */

/**
 * Two shapes, deliberately separated:
 *   PREFIXED   requires at least one "-suffix" (bg-, text-, gap-, ...). Without that rule
 *              the prose words "m", "items", "list" and "size" are read as classes.
 *   STANDALONE is complete on its own (flex, hidden, absolute, truncate, sr-only, ...).
 * A false positive here is worse than a miss: it trains people to ignore the gate.
 */
const VARIANT =
  '(?:(?:group|peer|hover|focus|focus-visible|focus-within|active|disabled|first|last|odd|even|' +
  'motion-safe|motion-reduce|sm|md|lg|xl|2xl|3xl|max-sm|max-md|max-lg|print|rtl|ltr|open|checked|' +
  'pointer-fine|pointer-coarse|any-pointer-fine|any-pointer-coarse|' +
  'aria-[a-z-]+|data-\\[[^\\]]+\\]|has-\\[[^\\]]+\\]):)*'

const PREFIXED =
  'bg|text|border|outline|ring|divide|from|via|to|fill|stroke|shadow|opacity|p|px|py|pt|pb|pl|pr|ps|pe|' +
  'm|mx|my|mt|mb|ml|mr|ms|me|space|gap|w|h|min-w|min-h|max-w|max-h|size|inset|inset-x|inset-y|top|' +
  'bottom|left|right|start|end|z|col|row|order|basis|grow|shrink|items|justify|content|self|place|' +
  'rounded|font|leading|tracking|indent|align|whitespace|break|list|decoration|cursor|pointer-events|' +
  'resize|select|appearance|transition|duration|ease|delay|animate|translate|rotate|scale|skew|origin|' +
  'overflow|object|aspect|columns|backdrop|blur|brightness|contrast|grayscale|invert|saturate|sepia|' +
  'mix-blend|will-change|touch|scroll|snap|accent|caret|placeholder|flex|grid|table|line-clamp'

const STANDALONE =
  'flex|grid|hidden|contents|block|inline|inline-block|inline-flex|absolute|relative|fixed|sticky|' +
  'static|visible|invisible|collapse|isolate|sr-only|not-sr-only|antialiased|truncate|uppercase|' +
  'lowercase|capitalize|normal-case|underline|overline|line-through|no-underline|italic|not-italic|' +
  'border|rounded|shadow|filter|transform|transition|table|container|border-collapse|border-separate'

const CANDIDATE = new RegExp(
  `^${VARIANT}(?:-?(?:${PREFIXED})(?:-[a-z0-9./%-]+)+|(?:${STANDALONE}))$`,
)

/* ------------------------------------------------------------------ collect candidates */

const SCAN = ['components', 'app']
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
      if (!SKIP.has(name)) walk(full, out)
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const candidates = new Map() // candidate -> first "file:line" that used it

for (const file of SCAN.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file)
  const source = readFileSync(file, 'utf8')
    // Strip block comments: prose explaining `text-underline-offset: 0.18em` is
    // documentation, not a class, and must not be reported as a dead utility.
    .replace(/\/\*[\s\S]*?\*\//g, '')
  source.split('\n').forEach((rawLine, i) => {
    const line = rawLine.replace(/\/\/.*$/, '')
    for (const m of line.matchAll(/(['"`])((?:[^\\\n]|\\.)*?)\1/g)) {
      const value = m[2]
      if (!value || value.length > 400) continue

      /**
       * Skip a string that is an OBJECT KEY.
       *
       * `{ 'content-type': 'application/json' }` was reported as a dead utility: `content` is a
       * real Tailwind prefix (content-center, content-between), so `content-type` matches the
       * candidate shape while being an HTTP header. This gate's own header says a false positive
       * is worse than a miss, because it trains people to ignore the gate.
       *
       * BOTH HALVES OF THE TEST ARE LOAD-BEARING. "Followed by a colon" alone also matches the
       * first branch of a ternary — `open ? 'translate-y-0 opacity-100' : 'translate-y-2'` — which
       * is where a great many real classes live. Requiring the literal to be OPENED by `{` or `,`
       * (or to start the line) excludes ternaries, whose branch is preceded by `?`.
       *
       * Measured rather than assumed: across every file this gate scans, the rule drops exactly
       * one token — `content-type` — and no other candidate is lost. A restriction to
       * `className=` lines was tried first and rejected: 161 real classes live in lookup tables
       * like Badge's tone map, and it would have gutted the gate.
       */
      const before = line.slice(0, m.index).trimEnd()
      const after = line.slice(m.index + m[0].length)
      if (/^\s*:/.test(after) && (before === '' || /[{,]$/.test(before))) continue
      for (const tok of value.split(/\s+/)) {
        if (!tok || tok.length > 60) continue
        // Arbitrary values are rejected by check-tokens.mjs; skipping them here keeps
        // one violation from being reported twice by two gates.
        if (tok.includes('[')) continue
        if (!CANDIDATE.test(tok)) continue
        if (!candidates.has(tok)) candidates.set(tok, `${rel}:${i + 1}`)
      }
    }
  })
}

/* -------------------------------------------------------------------- compile and test */

function loadStylesheet(id, base) {
  let path
  if (id === 'tailwindcss') path = resolve(TW, 'index.css')
  else if (id.startsWith('tailwindcss/')) path = resolve(TW, id.slice('tailwindcss/'.length))
  else path = resolve(base, id)
  return { path, base: dirname(path), content: readFileSync(path, 'utf8') }
}

const compiler = await compile(readFileSync(resolve(ROOT, 'app/globals.css'), 'utf8'), {
  base: resolve(ROOT, 'app'),
  loadStylesheet: async (id, base) => loadStylesheet(id, base),
  loadModule: async () => {
    throw new Error('no js plugins')
  },
})

const list = [...candidates.keys()]
const css = compiler.build(list)

const dead = []
for (const c of list) {
  // Two layers of CSS escaping have to be reproduced or the check reports false deaths:
  //
  //   1. ':', '.', '/' and '%' are backslash-escaped, so the stylesheet literally holds
  //      `.hover\:bg-surface-raised:hover`.
  //   2. A LEADING DIGIT cannot start a CSS identifier, so it becomes a hex escape with a
  //      trailing space: `2xl:gap-8` is emitted as `.\32 xl\:gap-8`.
  //
  // Missing either one reports live classes as dead — which is worse than missing a dead
  // one, because a gate that cries wolf stops being read.
  const esc = (ch) => ('.:/%'.includes(ch) ? '\\\\' + ch : ch.replace(/[*+?^${}()|[\]\\]/g, '\\$&'))

  const first = c[0] ?? ''
  const head = /[0-9]/.test(first)
    ? `\\\\3${first}\\s?` // hex escape for the leading digit, optional separating space
    : esc(first)
  const selector = head + [...c.slice(1)].map(esc).join('')

  if (!new RegExp(`\\.${selector}(?![\\w-])`).test(css)) dead.push(c)
}

if (dead.length) {
  console.error('Utility classes that generate no CSS:\n')
  for (const c of dead.sort()) console.error(`  ${c.padEnd(34)} first used at ${candidates.get(c)}`)
  console.error(
    `\n${dead.length} dead utilit${dead.length === 1 ? 'y' : 'ies'}. ` +
      `A utility not defined in the @theme block of app/globals.css produces nothing ` +
      `and fails silently — add the token or fix the name.`,
  )
  process.exit(1)
}
console.log(`utilities: clean — all ${list.length} class candidates resolve to CSS`)
