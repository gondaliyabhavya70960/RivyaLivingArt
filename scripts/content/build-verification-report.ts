#!/usr/bin/env tsx
import pg from 'pg'

import {
  readVerificationBacklog,
  type VerificationBacklog,
} from '../../lib/cms/verification-backlog'

import { writeContentInventory } from './build-content-inventory'

/**
 * content:verification-report — THE OWNER-VERIFICATION BACKLOG (Phase 46), and gate 13 of
 * `scripts/ops/preflight.ts`, where it is named "owner verifications blocking a publish".
 *
 * WHAT IT HANDS THE OWNER. Every row in the database still carrying
 * `owner_verification = OWNER_VERIFICATION_REQUIRED`, grouped by the surface it appears on, with the
 * Studio screen that resolves it and one sentence saying what they are being asked to confirm.
 * Phase 08's check constraints and evidence triggers refuse to publish those rows, so this is a
 * PUBLICATION BLOCKER RATHER THAN A WISH LIST — which is the only reason it is worth generating.
 * Where a table has no such gate the report says so, per table, instead of implying one.
 *
 * IT WRITES INTO THE INVENTORY, AND THAT IS WHY IT CALLS THE OTHER GENERATOR.
 * `docs/content/INITIAL_CONTENT_INVENTORY.md` is written WHOLESALE by
 * `scripts/content/build-content-inventory.ts`, and `npm run content:check-inventory` regenerates
 * and diffs it. A script that APPENDED a section to that file would have its work erased by the next
 * run of the other generator — silently, in the one document Phase 46 hands to the owner. So there
 * is exactly one writer: `writeContentInventory()` composes the inventory, the SEO coverage section
 * and this backlog in a single pass, and this entry point calls it. Run either generator, in either
 * order, any number of times: the file is byte-identical and the backlog survives.
 *
 * WHAT IT READS IS DECLARED ELSEWHERE. `lib/cms/verification-backlog.ts` holds the twenty-two
 * surfaces, the SQL built from them, the confirmation sentences, the shaping and the Markdown. This
 * file is the `pg` half: a script has no session, so it reads with `pg` on `DATABASE_URL`, exactly
 * as `scripts/seo/build-seo-coverage.ts` does. The `/studio` overview card reads the same surfaces
 * through PostgREST as the signed-in user (`lib/supabase/repositories/verifications.ts`), so the
 * card's number and this document's number come from one declaration and cannot drift apart.
 *
 * IT REFUSES TO WRITE RATHER THAN UNDERSTATE THE BACKLOG. If this database carries
 * `owner_verification` on a table the declaration does not know, that table's flagged rows would be
 * missing from the document and nobody could tell. The run fails and names the table.
 *
 * IT PRINTS COUNTS, NEVER THE COPY. The seeded sentences belong in the document, where the owner
 * reads them; a preflight gate that dumps forty rows of unconfirmed prose into a terminal is one
 * nobody reads twice.
 *
 * NO ROW IS PUBLISHED, EDITED OR VERIFIED HERE. Phase 46 hands the owner the list; only the owner
 * can clear it (D10).
 */

/**
 * The `pg` caller, typed.
 *
 * Exported because the backlog has two audiences and one of them is not a document, and because a
 * caller should not have to know that `pg.Client` happens to satisfy `SqlReader` structurally. The
 * reader itself, the SQL and the shaping live in `lib/cms/verification-backlog.ts`; two independent
 * answers to "how many verifications are outstanding" would disagree the first time one changed.
 */
export function readBacklog(client: pg.Client): Promise<VerificationBacklog> {
  return readVerificationBacklog(client)
}

function report(backlog: VerificationBacklog): void {
  console.log(
    `\nowner verifications outstanding: ${String(backlog.total)} row(s) across ` +
      `${String(backlog.groups.length)} surface(s)\n`,
  )
  for (const group of backlog.groups) {
    const where = group.studio.length === 0 ? '(no Studio screen)' : group.studio.join(' ')
    console.log(`  ${String(group.rows.length).padStart(4)}  ${group.surface}  →  ${where}`)
  }
  if (backlog.ungated.length > 0) {
    console.log(
      `\n  note: no database gate refuses a publish on ${backlog.ungated.join(', ')} — the flag ` +
        'there records the requirement and nothing enforces it.',
    )
  }
  if (backlog.publishedAnyway > 0) {
    console.log(
      `\n  note: ${String(backlog.publishedAnyway)} flagged row(s) are PUBLISHED, which is ` +
        'possible only where the table carries no gate. Check the ungated tables above.',
    )
  }
}

async function main(): Promise<number> {
  // The generator this file imports refuses the same variable at module scope, so in practice that
  // refusal is the one a reader sees. This check stands anyway: this entry point owns its own
  // precondition rather than depending on where the other one happens to put its.
  const connectionString = process.env['DATABASE_URL']
  if (connectionString === undefined || connectionString === '') {
    console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
    return 1
  }

  const client = new pg.Client({ connectionString })
  await client.connect()
  let backlog: VerificationBacklog
  try {
    backlog = await readBacklog(client)
  } finally {
    await client.end()
  }
  report(backlog)

  // ONE WRITER. See the header: the inventory generator composes every section of the document,
  // this one included, so the file is identical whichever entry point produced it.
  return writeContentInventory()
}

if (process.argv[1]?.endsWith('build-verification-report.ts') === true) {
  main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error('\ncontent:verification-report failed\n', error)
      process.exit(1)
    })
}
