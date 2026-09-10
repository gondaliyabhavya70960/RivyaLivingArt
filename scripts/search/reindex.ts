#!/usr/bin/env node
/**
 * search:reindex — rebuild `search_documents` from the source tables.
 *
 * THE INDEX IS MAINTAINED BY TRIGGERS AND THIS IS NOT PART OF THAT. One `after insert or update or
 * delete` trigger per source table keeps the index correct in real time (0211), which is the whole
 * design: a nightly rebuild would mean the index is wrong all day, and an editor who publishes a
 * piece expects to find it now. This script is the REPAIR path — after a restore, after a write
 * that went in with triggers disabled, or when the drift report below says the counts disagree.
 *
 * IT IS IDEMPOTENT AND IT REPORTS PER TYPE. `refresh_search_document` is an upsert keyed on
 * `(entity_type, entity_id)`, so running it twice produces the same rows. `--dry-run` performs no
 * write and reports what IS indexed against what SHOULD be; two consecutive dry runs report
 * identical counts, which is the drift check the phase document's verification step asks for.
 *
 * WHY THIS TALKS TO POSTGRES DIRECTLY RATHER THAN THROUGH supabase-js, and it is the same reason
 * `seed-content.ts` gives: this is an operations script in the family of a migration. It needs the
 * migration credential (`DATABASE_URL`), it calls a function granted to the owner and the service
 * role, and `lib/supabase/admin.ts` carries `import 'server-only'` — which throws outside Next,
 * exactly as it is meant to. Application reads still go through `lib/supabase/repositories/**`.
 *
 *   npx tsx scripts/search/reindex.ts --dry-run
 *   npx tsx scripts/search/reindex.ts --apply
 *   npx tsx scripts/search/reindex.ts --apply --type product
 */
import pg from 'pg'

/** Which source table each indexed type is built from. The one place that mapping is written down. */
const SOURCE_TABLE = {
  product: 'products',
  category: 'categories',
  collection: 'collections',
  portfolio_project: 'portfolio_projects',
  journal_article: 'journal_articles',
  material: 'materials',
  media_asset: 'media_assets',
  inquiry: 'inquiries',
} as const

type EntityType = keyof typeof SOURCE_TABLE
const ALL_TYPES = Object.keys(SOURCE_TABLE) as EntityType[]

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const dryRun = !apply
const typeArg = args[args.indexOf('--type') + 1]

function isEntityType(value: string | undefined): value is EntityType {
  return value !== undefined && (ALL_TYPES as readonly string[]).includes(value)
}

const types: EntityType[] = args.includes('--type') && isEntityType(typeArg) ? [typeArg] : ALL_TYPES

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
  process.exit(1)
}

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()

  console.log(`▸ ${dryRun ? 'plan' : 'apply'} · ${types.length} entity type(s)\n`)

  let drift = 0

  try {
    for (const entityType of types) {
      const table = SOURCE_TABLE[entityType]

      const source = await client.query<{ n: string }>(`select count(*)::text as n from ${table}`)
      const indexed = await client.query<{ n: string }>(
        `select count(*)::text as n from search_documents where entity_type = $1`,
        [entityType],
      )

      const sourceCount = Number(source.rows[0]?.n ?? 0)
      const indexedCount = Number(indexed.rows[0]?.n ?? 0)

      if (dryRun) {
        /*
         * A DIFFERENCE IS NOT AUTOMATICALLY DRIFT, and reporting it as such would train people to
         * ignore this. Two source types are indexed CONDITIONALLY: a collection still in concept is
         * never indexed (FEAT §9), and a row whose every title candidate is blank is not indexable
         * at all (0211). So a shortfall is reported with the reason rather than as a fault.
         */
        const conditional = entityType === 'collection' || entityType === 'media_asset'
        const differs = sourceCount !== indexedCount
        if (differs && !conditional) drift += 1
        const note = differs && conditional ? '   (some rows are indexed conditionally)' : ''
        console.log(
          `  ${entityType.padEnd(18)} source ${String(sourceCount).padStart(5)}   ` +
            `index ${String(indexedCount).padStart(5)}${note}`,
        )
        continue
      }

      const ids = await client.query<{ id: string }>(`select id from ${table}`)
      let rebuilt = 0
      for (const row of ids.rows) {
        await client.query('select public.refresh_search_document($1, $2)', [entityType, row.id])
        rebuilt += 1
      }
      console.log(`  ${entityType.padEnd(18)} rebuilt ${String(rebuilt).padStart(5)}`)
    }
  } finally {
    await client.end()
  }

  console.log('')
  if (dryRun) {
    console.log(
      drift === 0
        ? '✓ no drift between the source tables and the index'
        : `✗ ${drift} entity type(s) differ from their source — run with --apply`,
    )
    console.log('  Nothing was written.')
    if (drift > 0) process.exitCode = 1
  } else {
    console.log('✓ reindex complete')
  }
}

void main()
