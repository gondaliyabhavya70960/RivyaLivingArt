#!/usr/bin/env node
/**
 * COMPONENT REGISTRY GATE (Phase 02)
 *
 * The registry is deliberately two-tier (COMPONENT_REGISTRY.md §2), and this gate honours
 * that rather than flattening it:
 *
 *   §5  Approved research sources — all eleven FEAT §7 sources must carry an audit outcome.
 *       NOT_YET_AUDITED is not an outcome; it is the absence of one.
 *   §6  Registry index — horizontal rows for first-party token-only primitives: five fields.
 *       A row in state BUILT must have a file on disk at the expected path.
 *   §7  Full records — vertical Field | Value tables for anything externally sourced, any
 *       Client Component, anything carrying a keyboard or ARIA contract, anything with a
 *       measurable bundle cost. All fourteen fields of §3 required.
 *
 * The point is not tidiness. An unregistered component is one whose licence nobody checked,
 * whose bundle cost nobody measured and whose keyboard model nobody described.
 *
 * Exit 1 on any violation.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const REGISTRY = join(ROOT, 'docs/design/COMPONENT_REGISTRY.md')

const FULL_RECORD_FIELDS = [
  'Registry ID',
  'Source',
  'Link',
  'Licence',
  'Dependencies',
  'Page',
  'Purpose',
  'Adaptation',
  'Mobile behaviour',
  'Performance',
  'Accessibility',
  'Reviewed on',
  'Reviewer',
  'Verdict',
]

const ACCEPTED_LICENCES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'])
/** Verdicts that legitimately carry no third-party licence. */
const NO_LICENCE_NEEDED = new Set(['REJECTED', 'PLANNED', 'PENDING_AUDIT', 'FIRST_PARTY'])
/** An audit outcome must be one of these. Absence of an outcome is a violation. */
const AUDIT_OUTCOMES = ['ADOPTED', 'ADAPTED', 'REJECTED', 'NOT_ADOPTED']

const SOURCES = [
  'threeui.com',
  'smoothui.dev',
  'magicui.design',
  'ui.unlumen.com',
  '21st.dev',
  'reactbits.dev',
  'animmasterlib.dev',
  'skiper-ui.com',
  'vengenceui.com',
  'daisyui.com',
  'originkit.dev',
]

let src
try {
  src = readFileSync(REGISTRY, 'utf8')
} catch {
  console.error(`Cannot read ${REGISTRY}. The registry is required from Phase 02 onward.`)
  process.exit(1)
}

const problems = []
const lines = src.split('\n')
const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
const clean = (v) => v.replace(/`|\*/g, '').trim()

/* ------------------------------------------------- §5: every source has an audit outcome */

for (const source of SOURCES) {
  const row = lines.find((l) => l.includes(source) && l.trim().startsWith('|'))
  if (!row) {
    problems.push(`§5: source "${source}" has no row in the approved-sources table`)
    continue
  }
  const outcome = cells(row)
    .map(clean)
    .find((c) => AUDIT_OUTCOMES.includes(c.toUpperCase()))
  if (!outcome) {
    problems.push(
      `§5: source "${source}" carries no audit outcome ` +
        `(one of ${AUDIT_OUTCOMES.join(', ')}) — "NOT_YET_AUDITED" is the absence of an outcome, ` +
        `and FEAT §7 requires one for every source, including rejections`,
    )
  }
}

/* ------------------------------------------------------------- §6: index rows + §7 records */

const seenIds = new Map()
let indexRows = 0
let fullRecords = 0

// §7 full records are vertical: a "| Field | Value |" table per component.
const recordBlocks = src.split(/^### /m).filter((b) => /^\d+\.\d+\s+RC-\d{3}/.test(b))
for (const block of recordBlocks) {
  const id = block.match(/RC-\d{3}/)?.[0] ?? '(unknown)'
  fullRecords++
  const found = new Map()
  for (const line of block.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    const [k, v] = cells(line)
    if (k && v !== undefined) found.set(clean(k), clean(v))
  }
  for (const field of FULL_RECORD_FIELDS) {
    const v = found.get(field)
    if (v === undefined) problems.push(`§7 ${id}: full record is missing the "${field}" field`)
    else if (v === '') problems.push(`§7 ${id}: field "${field}" is empty`)
  }
  const verdict = (found.get('Verdict') ?? '').toUpperCase()
  const licence = found.get('Licence') ?? ''
  if (!NO_LICENCE_NEEDED.has(verdict)) {
    const spdx = licence.split(/[\s(]/)[0]
    if (!ACCEPTED_LICENCES.has(spdx) && !/written permission/i.test(licence)) {
      problems.push(
        `§7 ${id}: licence "${licence}" is not an accepted SPDX identifier ` +
          `(${[...ACCEPTED_LICENCES].join(', ')}) and is not written permission — ` +
          `such a component must be REJECTED, not adopted`,
      )
    }
  }
  const seen = seenIds.get(id)
  if (seen) problems.push(`§7 ${id}: Registry ID is reused (also ${seen}) — IDs are never reused`)
  seenIds.set(id, '§7')
}

// The registry holds three horizontal table shapes, distinguished by their header —
// not every "| RC-### |" row is an index row. Dispatch on the header rather than on
// column position, or the rejections ledger (which has no State column) is read as a
// malformed index row.
let rejectionRows = 0
for (let i = 0; i < lines.length; i++) {
  const header = lines[i]
  const sep = lines[i + 1]
  if (!header?.trim().startsWith('|') || !sep || !/^\s*\|[\s:|-]+\|\s*$/.test(sep)) continue

  const cols = cells(header).map((c) => clean(c).toLowerCase())
  const isIndex = cols.includes('state') && cols.includes('component')
  const isRejection = cols.some((c) => c.includes('reason for rejection'))
  if (!isIndex && !isRejection) continue

  const col = (name) => cols.findIndex((c) => c.includes(name))
  for (let j = i + 2; j < lines.length; j++) {
    const row = lines[j]
    if (!row?.trim().startsWith('|')) break
    const c = cells(row).map(clean)
    if (!/^RC-\d{3}$/.test(c[0] ?? '')) continue
    const id = c[0]
    if (c.length !== cols.length) {
      problems.push(`line ${j + 1} (${id}): row has ${c.length} cells, header has ${cols.length}`)
      continue
    }

    const prior = seenIds.get(id)
    if (prior && prior !== '§7') {
      problems.push(
        `line ${j + 1}: Registry ID ${id} is reused (also ${prior}) — IDs are never reused`,
      )
    } else if (!prior) {
      seenIds.set(id, `line ${j + 1}`)
    }

    if (isRejection) {
      rejectionRows++
      // A rejection needs a reason a reviewer can act on; "Reviewed on"/"Reviewer" may
      // legitimately be unfilled ("—"/UNASSIGNED means the review has not happened, §7).
      const reason = c[col('reason for rejection')] ?? ''
      if (!reason || reason === '—') {
        problems.push(
          `line ${j + 1} (${id}): rejection has no reason — the row exists so the proposal is not re-argued`,
        )
      }
      continue
    }

    indexRows++
    const component = c[col('component')] ?? ''
    const state = c[col('state')] ?? ''
    for (const [name, v] of [
      ['Component', component],
      ['Purpose', c[col('purpose')] ?? ''],
      ['Phase', c[col('phase')] ?? ''],
      ['State', state],
    ]) {
      if (!v || v === '—' || v === '-') problems.push(`line ${j + 1} (${id}): "${name}" is empty`)
    }
    if (!/^(PLANNED|BUILT|REJECTED)$/.test(state)) {
      problems.push(`line ${j + 1} (${id}): State "${state}" must be PLANNED, BUILT or REJECTED`)
    }
    // A BUILT row must correspond to files on disk. PLANNED rows are not armed.
    //
    // One row may legitimately cover more than one export — `Reveal` + `useReducedMotion`
    // ship together, as do `ProductGallery` + `Lightbox` — so the cell is split and EVERY
    // named part must resolve. Checking only the first would let half a row be marked
    // built, which is precisely the claim this check exists to prevent.
    if (state === 'BUILT' && component) {
      for (const part of component.split('+').map((n) => n.replace(/[`<>]/g, '').trim())) {
        if (!part || !/^[A-Za-z][A-Za-z0-9]*$/.test(part)) continue
        const candidates = [
          `components/primitives/${part}/index.tsx`,
          `components/patterns/${part}/index.tsx`,
          `components/primitives/motion/${part}.tsx`,
          `components/primitives/motion/${part}.ts`,
          // Phase 21: the 3D viewer lives in its own directory so the bundle gate can name it —
          // `scripts/perf/check-bundle.mjs` refuses `components/three/**` in any first-load client
          // graph, which is only expressible when the engine has a directory of its own.
          `components/three/${part}.tsx`,
        ]
        if (!candidates.some((pth) => existsSync(join(ROOT, pth)))) {
          problems.push(
            `line ${j + 1} (${id}): state is BUILT but no file exists for "${part}" at any of: ${candidates.join(', ')}`,
          )
        }
      }
    }
  }
}

if (!indexRows && !fullRecords) problems.push('no registry entries found at all')

/* ------------------------------------------------------------------------ report */

if (problems.length) {
  console.error('Component registry violations:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(`\n${problems.length} violation(s).`)
  process.exit(1)
}
console.log(
  `component registry: clean — ${indexRows} index row(s), ${fullRecords} full record(s), ` +
    `${rejectionRows} rejection(s), ` +
    `all ${SOURCES.length} §7 sources carry an audit outcome`,
)
