#!/usr/bin/env node
/**
 * MOTION TOKEN GATE — a Phase 45 deliverable that was specified and never written.
 *
 * `PHASE-39-46.md` §45 lists `scripts/design/check-motion-tokens.mjs` under Deliverables and its
 * verification step 5 says what it must do: "every animation uses a declared easing and duration.
 * Add a bespoke cubic-bezier and confirm it fails." The file did not exist. `DESIGN_SYSTEM.md` §4.1
 * declares eight durations and six easings and, until this ran, nothing stopped a ninth.
 *
 * IT COVERS WHAT `check-tokens.mjs` DOES NOT, and the gap was real rather than theoretical. That
 * gate's arbitrary-value rule lists the prefixes it refuses — `bg`, `text`, `p`, `w`, `rounded`,
 * `shadow`, `z` and the rest — and `duration` and `ease` are not among them. So `duration-[300ms]`
 * and `ease-[cubic-bezier(.17,.67,.83,.67)]` compiled, rendered and passed every gate in
 * `npm run check`.
 *
 * WHY A BESPOKE CURVE IS WORTH FAILING A BUILD OVER. A duration is a number and a reader can see it
 * is wrong. An easing is a feeling: two curves that differ in the third decimal produce motion that
 * reads as two different products, and nobody reviewing a diff will catch it. §4.2 assigns each of
 * the six classes its own curve for that reason, and the moment a seventh appears the system has
 * stopped being one system.
 *
 * WHAT IT READS AS TRUTH: the `--rv-duration-*` and `--rv-ease-*` blocks of
 * `app/styles/tokens.css`. Adding a token there is the sanctioned way to widen the set, and it is a
 * one-line diff a reviewer sees.
 *
 * Exit 1 on a duration or easing that is not one of them.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const TOKENS = join(ROOT, 'app', 'styles', 'tokens.css')

/* ------------------------------------------------------------------ the declared set */

const tokensCss = readFileSync(TOKENS, 'utf8')

const declaredDurations = new Set(
  [...tokensCss.matchAll(/--rv-duration-([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => m[2].trim()),
)
const declaredEasings = new Set(
  [...tokensCss.matchAll(/--rv-ease-([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => m[2].trim()),
)

/*
 * A GATE THAT CANNOT FIND ITS OWN SUBJECT MUST FAIL, not pass. If the token block is ever renamed,
 * both sets go empty and every check below trivially succeeds — the gate would report "clean" on a
 * repository it is no longer reading. `check-video-props.mjs` self-tests for the same reason.
 */
if (declaredDurations.size === 0 || declaredEasings.size === 0) {
  console.error(
    'check-motion-tokens: found no --rv-duration-* or --rv-ease-* tokens in app/styles/tokens.css.\n' +
      'The gate cannot verify anything against an empty set — has the token block moved?',
  )
  process.exit(1)
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
  for (const name of entries) {
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
 * Comments out, and the whole reason is that this repository writes long ones.
 *
 * Several files explain the motion system in prose that quotes a curve — `check-tokens.mjs` strips
 * comments for the same reason. A gate that reads documentation as code teaches people to stop
 * documenting.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/* ------------------------------------------------------------------ the rules */

const problems = []

/** A bespoke curve, anywhere but the file that declares the six. */
const CUBIC = /cubic-bezier\s*\([^)]*\)/g

/** `duration-[…]` and `ease-[…]` — the two arbitrary values check-tokens.mjs does not list. */
const ARBITRARY_UTILITY = /\b(?:duration|ease|delay)-\[[^\]]+\]/g

/** A raw time on a motion property: `transition-duration: 300ms`, `animation-delay: .2s`. */
const RAW_TIME_PROPERTY = /\b(?:transition|animation)-(?:duration|delay)\s*:\s*([^;{}]+)[;}]/g

/** A raw time inside an `animation:` or `transition:` shorthand. */
const SHORTHAND = /\b(?:animation|transition)\s*:\s*([^;{}]+)[;}]/g

/** Every time literal in a value, e.g. `300ms`, `.2s`, `1.5s`. */
const TIME_LITERAL = /(?<![\w-])(\d*\.?\d+)(ms|s)(?![\w-])/g

/**
 * `0.01ms` IS NOT A DURATION, IT IS HOW YOU CANCEL ONE.
 *
 * The reduced-motion floor in `app/styles/base.css` sets `animation-duration: 0.01ms !important`,
 * and that number is the well-known idiom rather than a design decision: `0` would skip the
 * `animationend` event some components wait on, so the convention is a duration too short to
 * perceive but long enough to fire. Tokenising it would put a suppression in the §4.1 scale beside
 * eight real durations and invite somebody to animate at it.
 */
const SUPPRESSION = new Set(['0.01ms', '0ms', '0s'])

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file)
    const source = stripComments(readFileSync(file, 'utf8'))

    for (const match of source.matchAll(CUBIC)) {
      const curve = match[0].replace(/\s+/g, '')
      const declared = [...declaredEasings].some((value) => value.replace(/\s+/g, '') === curve)
      if (!declared && rel !== join('app', 'styles', 'tokens.css')) {
        problems.push(
          `${rel}: bespoke easing ${curve} — §4.2 declares six, and a seventh is a second design ` +
            `system. Use var(--rv-ease-…) or add the curve to app/styles/tokens.css.`,
        )
      }
    }

    for (const match of source.matchAll(ARBITRARY_UTILITY)) {
      problems.push(
        `${rel}: ${match[0]} — an arbitrary motion value. check-tokens.mjs does not list ` +
          `duration/ease/delay among its refused prefixes, which is why this gate exists. Use the ` +
          `parenthesis form, e.g. duration-(--rv-duration-base).`,
      )
    }

    for (const pattern of [RAW_TIME_PROPERTY, SHORTHAND]) {
      for (const match of source.matchAll(pattern)) {
        const value = match[1]
        /*
         * EVERY TIME LITERAL IS CHECKED, even in a value that also references a token.
         *
         * The first version of this gate skipped the whole declaration when it saw any `var(--rv-`,
         * on the reasoning that a value built from tokens is the right shape. Its own negative test
         * caught it: `animation: rv-rise 640ms var(--rv-ease-out) both` contains a token easing and
         * a hand-written duration, and it passed. A `var()` reference contributes no time literal,
         * so there is nothing for the skip to protect — it only ever hid a mistake.
         */
        for (const time of value.matchAll(TIME_LITERAL)) {
          const literal = `${time[1]}${time[2]}`
          if (declaredDurations.has(literal) || SUPPRESSION.has(literal)) continue
          problems.push(
            `${rel}: raw duration ${literal} in "${value.trim()}" — §4.1 declares eight, and ` +
              `--rv-duration-scene (900ms) is the ceiling. Use var(--rv-duration-…).`,
          )
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ motion tokens: ${String(problems.length)} problem(s):`)
  for (const problem of problems) console.error(`    ${problem}`)
  process.exit(1)
}

console.log(
  `✓ motion tokens: every easing and duration in app/ and components/ resolves to one of ` +
    `${String(declaredEasings.size)} declared curve(s) and ${String(declaredDurations.size)} declared duration(s)`,
)
