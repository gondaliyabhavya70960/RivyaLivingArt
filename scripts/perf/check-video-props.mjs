#!/usr/bin/env node
/**
 * VIDEO PROPS GATE (Phase 06)
 *
 * COMPONENT_REGISTRY RC-233: "Autoplay is a runtime decision behind the DESIGN_SYSTEM.md §4.3
 * gates and is never an `autoplay` attribute in markup — `scripts/perf/check-video-props.mjs`
 * fails CI on one." DESIGN_SYSTEM §10.1 adds the rest: every `<video>` carries a poster,
 * `preload="none"`, `muted` and `playsInline`.
 *
 * WHY `autoplay` AS AN ATTRIBUTE IS THE ONE THAT MATTERS. The browser acts on it before any of the
 * product's conditions can be consulted — the motion preference, the duration ceiling, Data Saver.
 * A `<video autoplay>` that is corrected a moment later by JavaScript has already begun fetching,
 * so the correction saves nothing. The attribute is not a default to override; it is the decision,
 * taken by the wrong party.
 *
 * IT CHECKS THE ELEMENT, NOT THE COMPONENT. `MediaVideo` is the only component permitted to emit a
 * `<video>` (§10.1) — so this scans for the ELEMENT anywhere in the tree, which catches both a
 * `<video>` smuggled into some other component and a regression inside `MediaVideo` itself. A gate
 * that only checked `MediaVideo`'s call sites would miss the case the rule exists for.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const OWNER = 'components/patterns/MediaVideo/'

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '*.tsx'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)
  // Test files assert on the rendered element; they do not author one.
  .filter((file) => !file.endsWith('.test.tsx'))

/** Each `<video ...>` element in JSX, opening tag only, across lines. */
const VIDEO = /<video(\s[^>]*?)?\/?>/gs
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
let elements = 0
let ownerElements = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (!/<video[\s/>]/.test(source)) continue

  for (const match of codeMatches(source, VIDEO, '<video')) {
    elements += 1
    if (file.startsWith(OWNER)) ownerElements += 1
    const props = codeProps(match, source)
    const line = source.slice(0, match.index).split('\n').length
    const at = `${file}:${line}`

    // §10.1: only MediaVideo may emit one.
    if (!file.startsWith(OWNER)) {
      problems.push(`${at} — a <video> outside ${OWNER}; only MediaVideo may emit one (§10.1)`)
      continue
    }

    // The attribute, in any of its JSX spellings. `autoPlay={cond}` is caught too: the point is
    // that the decision must not be in the markup at all, whatever value it takes.
    if (/\bauto[Pp]lay\b/.test(props)) {
      problems.push(`${at} — an \`autoplay\` attribute in markup (RC-233); play() imperatively`)
    }
    if (!/\bposter\s*=/.test(props)) {
      problems.push(`${at} — no \`poster\`; a video without one paints nothing until it decodes`)
    }
    if (!/\bpreload\s*=\s*(?:"none"|\{\s*['"]none['"]\s*\})/.test(props)) {
      problems.push(`${at} — \`preload\` is not "none"`)
    }
    if (!/\bmuted\b/.test(props)) {
      problems.push(`${at} — no \`muted\`; an unmuted inline video cannot autoplay at all`)
    }
    if (!/\bplaysInline\b/.test(props)) {
      problems.push(`${at} — no \`playsInline\`; iOS takes the video full-screen on play`)
    }
  }
}

if (problems.length > 0) {
  console.error(
    `✗ ${problems.length} problem(s) with <video> markup:\n` +
      problems.map((p) => `    ${p}`).join('\n'),
  )
  process.exit(1)
}

// The gate must be able to fail. With no <video> anywhere it would pass while proving nothing, so
// the one legitimate element is asserted to exist.
if (ownerElements === 0) {
  console.error(
    `✗ no <video> element found in ${OWNER}.\n` +
      '  Either MediaVideo was renamed, or this gate is checking a rule nothing can break.',
  )
  process.exit(1)
}

console.log(
  `✓ video props: ${elements} <video> element(s), all inside ${OWNER}, each with a poster, ` +
    'preload="none", muted, playsInline, and no autoplay attribute',
)
