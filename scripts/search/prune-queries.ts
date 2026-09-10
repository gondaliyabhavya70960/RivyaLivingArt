#!/usr/bin/env node
/**
 * search:prune-queries — delete `search_queries` rows older than the retention window.
 *
 * NINETY DAYS, AND THE NUMBER IS THE POINT OF THE TABLE. `search_queries` exists so the owner can
 * see what visitors looked for and did not find. It holds no IP, no user agent and no actor for a
 * public search — a CHECK constraint refuses one — so it is not a profile of anybody. But a table
 * of everything ever typed into a search box, kept forever, becomes one by accumulation. The
 * window is what stops that, and it is a job rather than a policy so that it shows up in the cron
 * output instead of being a promise in a document.
 *
 * ALSO RUN FROM THE CRON ROUTE. Phase 25's `app/api/cron/research/route.ts` performs the same
 * delete on every tick; this is the manual path and the one a person can read.
 *
 * Talks to PostgreSQL directly, for the reason `reindex.ts` and `seed-content.ts` both give: an
 * operations script uses the migration credential, not the application's client.
 *
 *   npx tsx scripts/search/prune-queries.ts            (plan)
 *   npx tsx scripts/search/prune-queries.ts --apply
 */
import pg from 'pg'

export const RETENTION_DAYS = 90

const args = process.argv.slice(2)
const apply = args.includes('--apply')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
  process.exit(1)
}

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()

  try {
    const cutoff = `now() - interval '${RETENTION_DAYS} days'`
    const { rows } = await client.query<{ n: string }>(
      `select count(*)::text as n from search_queries where occurred_at < ${cutoff}`,
    )
    const expired = Number(rows[0]?.n ?? 0)

    console.log(`▸ ${expired} row(s) older than ${RETENTION_DAYS} days`)

    if (!apply) {
      console.log('  Nothing was written. Pass --apply to delete them.')
      return
    }

    await client.query(`delete from search_queries where occurred_at < ${cutoff}`)
    console.log(`✓ pruned ${expired} row(s)`)
  } finally {
    await client.end()
  }
}

void main()
