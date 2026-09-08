#!/usr/bin/env node
/**
 * db:check-types — the generated-types drift gate.
 *
 * Regenerates lib/supabase/database.types.ts from a live database and fails if the result differs
 * from what is committed.
 *
 * WHY: the committed types are what `npm run typecheck` believes about the database. If a
 * migration adds a column and nobody regenerates, TypeScript keeps insisting the column does not
 * exist — and the first place anyone finds out is a runtime error on a real row. This gate makes
 * the lie impossible to commit.
 *
 * It requires a database. That is not incidental: a drift check that can run without one would
 * be comparing the file against nothing.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'

const TARGET = 'lib/supabase/database.types.ts'
const BACKUP = `${TARGET}.check-backup`

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set.\n' +
      'db:check-types regenerates the types from a real database and diffs the result, so it\n' +
      'needs one. Point DATABASE_URL at a database with the migrations applied:\n' +
      '  npm run db:reset && npm run db:check-types\n' +
      'See docs/ops/ENVIRONMENT.md.',
  )
  process.exit(1)
}

const committed = readFileSync(TARGET, 'utf8')
copyFileSync(TARGET, BACKUP)

try {
  execFileSync('node', ['scripts/db/gen-types.mjs'], { stdio: 'ignore' })
  const regenerated = readFileSync(TARGET, 'utf8')

  if (regenerated !== committed) {
    // Restore what was committed, so a failing check never leaves the working tree modified.
    writeFileSync(TARGET, committed)

    console.error(
      `\n✗ ${TARGET} is out of date with the database.\n\n` +
        `  A migration changed the schema and the types were not regenerated, or the types were\n` +
        `  edited by hand. Either way the fix is the same:\n\n` +
        `      npm run db:reset && npm run db:types\n\n` +
        `  then commit the result.\n`,
    )
    process.exit(1)
  }

  console.log(`✓ ${TARGET} matches the database`)
} finally {
  try {
    unlinkSync(BACKUP)
  } catch {
    // Nothing to clean up.
  }
}
