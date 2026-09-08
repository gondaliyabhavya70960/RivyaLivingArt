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

const sorted = [...numbers].sort((a, b) => a.n - b.n)
sorted.forEach((entry, index) => {
  const expected = index + 1
  if (entry.n !== expected) {
    problems.push(
      `migration numbering has a gap: expected ${String(expected).padStart(4, '0')}, found ${entry.file}`,
    )
  }
})

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

console.log(
  `✓ ${files.length} migrations: numbered 0001-${String(sorted.at(-1)?.n ?? 0).padStart(4, '0')}, no content inserts`,
)
