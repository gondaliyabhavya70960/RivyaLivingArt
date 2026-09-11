#!/usr/bin/env node
/**
 * THE QUARANTINE LIST IS REAL, SHORT, AND EXPLAINED — Phase 42.
 *
 * `tests/flaky.json` is the only place a flaky test may be recorded. This gate is what stops it
 * becoming a drawer:
 *
 *   AT MOST THREE ENTRIES. A fourth is not an administrative problem, it is the suite losing the
 *   trust that makes it worth running, and the response is to fix one rather than to raise the cap.
 *
 *   EVERY ENTRY NAMES A TEST THAT EXISTS. A quarantine for a test that was renamed or deleted is a
 *   row nobody will ever remove, and it makes the list look busier than the problem is.
 *
 *   EVERY ENTRY CARRIES A DATE, AN OBSERVATION AND A REASON. "Flaky" is not a reason. Without what
 *   was seen and why it is not simply fixed, the next person cannot tell whether the entry is still
 *   true — so they leave it, forever.
 *
 *   NOTHING OLDER THAN NINETY DAYS. A quarantine is a pause, not a verdict.
 *
 * IT DOES NOT READ TEST RESULTS and cannot tell whether anything actually flakes. That judgement is
 * a person's, made while looking at two runs that differed. This gate only holds the register
 * honest.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REGISTER = 'tests/flaky.json'
const MAX_ENTRIES = 3
const MAX_AGE_DAYS = 90

if (!existsSync(REGISTER)) {
  console.error(
    `✗ flaky register: ${REGISTER} is missing. An empty register is not the same as none.`,
  )
  process.exit(1)
}

let register
try {
  register = JSON.parse(readFileSync(REGISTER, 'utf8'))
} catch (error) {
  console.error(`✗ flaky register: ${REGISTER} is not valid JSON — ${error.message}`)
  process.exit(1)
}

const entries = register.quarantined
if (!Array.isArray(entries)) {
  console.error(`✗ flaky register: "quarantined" must be an array.`)
  process.exit(1)
}

const problems = []

if (entries.length > MAX_ENTRIES) {
  problems.push(
    `${entries.length} quarantined tests; the cap is ${MAX_ENTRIES}. Fix one rather than raising the cap.`,
  )
}

/** Every `it(...)` and `test(...)` title in the repository, so an entry can be matched to one. */
function testTitles() {
  const titles = new Set()
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue
      const source = readFileSync(full, 'utf8')
      for (const match of source.matchAll(/\b(?:it|test)\s*\(\s*(['"`])([^'"`]+)\1/g)) {
        titles.add(match[2])
      }
    }
  }
  for (const dir of ['tests', 'lib', 'components']) {
    if (existsSync(dir)) walk(dir)
  }
  return titles
}

const titles = entries.length > 0 ? testTitles() : new Set()
const now = Date.now()

for (const [index, entry] of entries.entries()) {
  const where = `entry ${String(index + 1)}`
  for (const field of ['title', 'quarantinedOn', 'observed', 'reason']) {
    if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
      problems.push(`${where}: "${field}" is missing. Without it nobody can act on this row.`)
    }
  }
  if (typeof entry?.title === 'string' && !titles.has(entry.title)) {
    problems.push(
      `${where}: no test is titled "${entry.title}". It was renamed or removed — delete the row.`,
    )
  }
  if (typeof entry?.quarantinedOn === 'string') {
    const when = Date.parse(entry.quarantinedOn)
    if (Number.isNaN(when)) {
      problems.push(`${where}: "quarantinedOn" is not a date.`)
    } else {
      const days = Math.floor((now - when) / 86_400_000)
      if (days > MAX_AGE_DAYS) {
        problems.push(
          `${where}: quarantined ${String(days)} days ago. A quarantine is a pause, not a verdict — fix it or delete the test.`,
        )
      }
    }
  }
  if (typeof entry?.reason === 'string' && /^flaky\.?$/i.test(entry.reason.trim())) {
    problems.push(`${where}: "flaky" is not a reason. Say what was seen and why it is not fixed.`)
  }
}

if (problems.length > 0) {
  console.error(`✗ flaky register: ${String(problems.length)} problem(s):\n`)
  for (const problem of problems) console.error(`    ${problem}`)
  process.exit(1)
}

console.log(
  entries.length === 0
    ? '✓ flaky register: nothing quarantined'
    : `✓ flaky register: ${String(entries.length)} quarantined test(s), each named, dated and explained`,
)
