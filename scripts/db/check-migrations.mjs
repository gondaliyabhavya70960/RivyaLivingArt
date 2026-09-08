#!/usr/bin/env node
/**
 * db:check-migrations — two rules about what a migration may contain.
 *
 * RULE 1: NO CONTENT ROWS IN MIGRATIONS.
 * A migration carries structure; a seed carries content. The difference matters because a row
 * inserted by a migration can never be owner-edited safely: the next `db:reset` recreates it
 * exactly as written, silently discarding whatever an editor changed. The seed runner exists
 * precisely to avoid that, and it only works if content goes through it.
 *
 * RULE 2: MIGRATIONS ARE FORWARD-ONLY AND NUMBERED WITHOUT GAPS OR DUPLICATES.
 * A duplicate number means two developers wrote 0009 independently and one will be applied
 * before the other on some machines and after it on others.
 *
 * An insert a migration genuinely needs — a reference value that is part of the structure rather
 * than content — is allowed with an explicit marker on the line before it:
 *
 *     -- check-migrations: allow-insert (reason)
 *     insert into ...
 *
 * The marker is required to carry a reason, so the exception is argued rather than merely taken.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'supabase/migrations'
const ALLOW_MARKER = /--\s*check-migrations:\s*allow-insert\s*\((.+)\)/

/** Strip SQL comments, so a comment mentioning `insert into` does not trip the check. Line
 *  positions are preserved by keeping newlines. */
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const problems = []

// --- rule 2: numbering ---
const numbers = []
for (const file of files) {
  const match = file.match(/^(\d{4})_[a-z0-9_]+\.sql$/)
  if (!match) {
    problems.push(`${file}: name must be NNNN_lower_snake_case.sql`)
    continue
  }
  numbers.push({ file, n: Number(match[1]) })
}

const seen = new Map()
for (const { file, n } of numbers) {
  if (seen.has(n)) {
    problems.push(
      `duplicate migration number ${String(n).padStart(4, '0')}: ${seen.get(n)} and ${file}`,
    )
  }
  seen.set(n, file)
}

/**
 * Every migration number must be ALLOCATED in DATA_MODEL.md §12.
 *
 * This replaces a "numbers must be dense from 0001" rule, which was wrong. Numbering is allocated
 * in per-phase blocks — Phase 05 takes `0020`, Phase 08 `0050`, Phase 14 `0120`–`0122` — so the
 * gaps between blocks are the design, and the old rule would have failed every phase from 05
 * onward. It passed only because Phases 01-04 happened to fill 0001-0012 densely.
 *
 * What actually matters is that a number was allocated before it was used. Two migrations landing
 * on one number from different branches is a merge conflict D5 expects to be resolved by
 * renumbering; a migration numbered outside its phase's block silently reorders the apply sequence
 * relative to what every phase document says. Reading the register makes both visible, and has the
 * side effect that adding a migration without recording it in §12 fails the build — which is the
 * documentation contract this project keeps trying to enforce by hand.
 */
const REGISTER = 'docs/architecture/DATA_MODEL.md'
const allocated = new Set()
{
  const doc = readFileSync(REGISTER, 'utf8')
  const start = doc.indexOf('## 12. Table register')
  if (start === -1) {
    problems.push(`${REGISTER}: could not find "## 12. Table register" — the migration register`)
  } else {
    // §12 runs to the next top-level heading. Both forms of allocation appear inside it: a range in
    // the Phase 03 sub-heading, and one cell per row in the "by arrival" table.
    const nextHeading = doc.indexOf('\n## ', start + 4)
    const section = doc.slice(start, nextHeading === -1 ? undefined : nextHeading)

    // `0120`–`0122` (en dash, as the document is written) and bare `0020`.
    for (const [, from, to] of section.matchAll(/`(\d{4})`\s*[–-]\s*`(\d{4})`/g)) {
      for (let n = Number(from); n <= Number(to); n += 1) allocated.add(n)
    }
    for (const [, one] of section.matchAll(/`(\d{4})`/g)) allocated.add(Number(one))
  }
}

if (allocated.size > 0) {
  for (const { file, n } of numbers) {
    if (!allocated.has(n)) {
      problems.push(
        `${file}: migration number ${String(n).padStart(4, '0')} is not allocated in ` +
          `${REGISTER} §12. Add it to the register (which phase creates it, and what it does) ` +
          `before adding the file — the register is what stops two phases claiming one number.`,
      )
    }
  }
}

// --- rule 1: no content inserts ---
for (const file of files) {
  const raw = readFileSync(join(DIR, file), 'utf8')
  const rawLines = raw.split('\n')
  const lines = stripSqlComments(raw).split('\n')

  lines.forEach((line, index) => {
    if (!/\binsert\s+into\b/i.test(line)) return

    // Look back up to three lines for the marker, so it can sit above a comment block.
    const window = rawLines.slice(Math.max(0, index - 3), index).join('\n')
    const allowed = ALLOW_MARKER.exec(window)
    if (allowed && allowed[1]?.trim()) return

    problems.push(
      `${file}:${index + 1}: insert into — content belongs in content/seed/**, not a migration.\n` +
        `      If this is structural reference data, mark it:\n` +
        `      -- check-migrations: allow-insert (why this is structure, not content)`,
    )
  })
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} migration problem(s):\n`)
  for (const p of problems) console.error(`    ${p}`)
  console.error('')
  process.exit(1)
}

const highest = numbers.reduce((max, entry) => (entry.n > max ? entry.n : max), 0)
console.log(
  `✓ ${files.length} migrations up to ${String(highest).padStart(4, '0')}: every number allocated ` +
    `in DATA_MODEL §12, none duplicated, no content inserts`,
)
