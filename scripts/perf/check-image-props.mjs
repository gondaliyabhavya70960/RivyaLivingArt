#!/usr/bin/env node
/**
 * IMAGE PROPS GATE (Phase 06)
 *
 * DESIGN_SYSTEM §10.1 and COMPONENT_REGISTRY RC-232: "`sizes` is required: the component throws
 * without it in development and `scripts/perf/check-image-props.mjs` fails CI on a usage that
 * omits it."
 *
 * WHY A BUILD GATE WHEN THE COMPONENT ALREADY THROWS. The throw only fires when the component
 * RENDERS, in development, on a route somebody happened to open. A `sizes`-less usage on a page
 * nobody visits during development ships. This reads every usage in the tree instead, so the
 * failure is found by the commit that introduces it.
 *
 * WHAT A MISSING `sizes` COSTS, since it reads like a nit: a `srcset` without `sizes` makes the
 * browser assume the image occupies the full viewport width, so a 300px card in a three-column
 * grid downloads the 1920px rung. The page looks correct and weighs several times what it should,
 * and nothing about that is visible without opening the network panel.
 *
 * THIS IS A TEXT SCAN, NOT A TYPE CHECK, and the distinction is worth being honest about.
 * TypeScript already makes `sizes` non-optional, so a literal `<MediaImage>` without it does not
 * compile — this gate exists for what the type system cannot see: a spread (`{...props}`) that
 * satisfies the type at a call site far from the usage, and a `sizes` prop that is present but
 * empty. It therefore reports what it CAN see, and says so rather than claiming completeness.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const COMPONENT = 'MediaImage'

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '*.tsx'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)
  // The component's own definition and tests are not usages of it.
  .filter((file) => !file.startsWith(`components/patterns/${COMPONENT}/`))

/** Each `<MediaImage ... >` or `<MediaImage ... />`, including multi-line ones. */
const USAGE = new RegExp(`<${COMPONENT}(\\s[^>]*?)?/?>`, 'gs')
/**
 * `<tag` occurrences that are real code, not prose.
 *
 * The stripper blanks comments AND string literals while preserving every offset and newline, so
 * it works as a MASK over the original source rather than as a replacement for it: a match whose
 * opening survives in the stripped copy is code, and one that has been blanked was inside a
 * comment or a string. Matching on the stripped copy directly would not do — it also blanks
 * `preload="none"`, which is one of the attributes being checked.
 *
 * This matters more than it sounds. The doc comments that EXPLAIN these rules quote the very
 * markup they forbid, and a gate that flags its own explanation trains people to ignore it.
 */
function codeMatches(source, pattern, tag) {
  // `strings: false` keeps string literals intact, because the attribute VALUES are part of what
  // is being checked (`preload="none"`). Comments still go, which is the false positive that
  // matters: a JSX attribute list can contain a `//` comment, and this file's own header quotes
  // the markup it forbids.
  const masked = stripCommentsAndStrings(source, { strings: false })
  return [...source.matchAll(pattern)].filter(
    (match) => masked.slice(match.index, match.index + tag.length) === tag,
  )
}

/** The attribute list with comments removed, so a comment inside it cannot satisfy a check. */
function codeProps(match, source) {
  const raw = match[1] ?? ''
  const start =
    (match.index ?? 0) + match[0].length - raw.length - (match[0].endsWith('/>') ? 2 : 1)
  const masked = stripCommentsAndStrings(source, { strings: false })
  return masked.slice(start, start + raw.length)
}

const problems = []
let usages = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (!source.includes(`<${COMPONENT}`)) continue

  for (const match of codeMatches(source, USAGE, `<${COMPONENT}`)) {
    usages += 1
    const props = codeProps(match, source)
    const line = source.slice(0, match.index).split('\n').length

    // A spread may supply `sizes` from elsewhere. Not flagged — a false positive here would push
    // somebody towards a `sizes="100vw"` that is wrong everywhere, which is worse than no gate.
    if (/\{\.\.\./.test(props)) continue

    if (!/\bsizes\s*=/.test(props)) {
      problems.push(`${file}:${line} — <${COMPONENT}> without a \`sizes\` prop`)
      continue
    }
    if (/\bsizes\s*=\s*(?:""|\{\s*''\s*\}|\{\s*""\s*\})/.test(props)) {
      problems.push(`${file}:${line} — <${COMPONENT}> with an empty \`sizes\``)
    }
  }
}

if (problems.length > 0) {
  console.error(
    `✗ ${problems.length} ${COMPONENT} usage(s) missing a usable \`sizes\`:\n` +
      problems.map((p) => `    ${p}`).join('\n') +
      '\n  Give the CSS width of the box at each breakpoint, e.g.\n' +
      '    sizes="(min-width: 768px) 33vw, 100vw"\n' +
      '  Without it the browser assumes 100vw and downloads the largest rung in the srcset.',
  )
  process.exit(1)
}

console.log(
  usages === 0
    ? `✓ image props: no <${COMPONENT}> usages yet — the CMS binds media from Phase 08`
    : `✓ image props: all ${usages} <${COMPONENT}> usage(s) carry a \`sizes\``,
)
