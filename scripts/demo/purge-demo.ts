#!/usr/bin/env node
/**
 * demo:purge — remove every row the demo seeder wrote, and put back what it changed.
 *
 * THIS IS THE COMMAND THE WHOLE `is_demo` DESIGN EXISTS TO MAKE POSSIBLE. The owner authorised
 * placeholder content on the condition that all of it is replaced at launch; a marker that could
 * not be swept in one pass would have been a promise nobody could keep. `delete from <table> where
 * is_demo` cannot match a real row, and it keeps working after an editor has renamed, re-slugged and
 * republished a demo product — which is exactly what an editor evaluating a demo catalogue does.
 *
 * ORDER MATTERS. Article pages are deleted before the articles that point at them, and every child
 * of a demo product goes with the product by cascade — `product_media`, `product_specs`,
 * `product_materials`, `product_relations`, `product_collections` and any customization binding.
 *
 * IT ALSO REVERSES THE TWO EDITS THE SEEDER MAKES TO NON-DEMO ROWS: the seven seeded categories go
 * back to DRAFT, and the ten seeded articles lose the `page_id` pointing at a body that no longer
 * exists. Leaving either behind would mean the purge had removed the demo content and left the
 * database in a state the content seed runner no longer recognised as its own.
 *
 *   npm run demo:purge
 *   npm run demo:purge -- --dry-run
 */
import pg from 'pg'

const dryRun = process.argv.includes('--dry-run')

const url = process.env['DATABASE_URL']
if (url === undefined || url === '') {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })

/**
 * Ordered. `page_sections` before `pages` is belt and braces — the foreign key cascades — but
 * `journal_articles.page_id` is `on delete set null`, so an article whose demo body is deleted keeps
 * a null page and returns to the state SEED §20 seeded it in.
 */
const TABLES = [
  'page_sections',
  'pages',
  'testimonials',
  'portfolio_projects',
  'journal_articles',
  'products',
] as const

async function main() {
  await client.connect()
  await client.query('begin')

  try {
    /*
     * UNPUBLISH BEFORE DELETING, and the failure that forced this is worth recording.
     *
     * `journal_articles.page_id` is `on delete set null`, so deleting a demo body left its article
     * PUBLISHED with no page — and `enforce_article_has_body()` refuses exactly that, aborting the
     * whole purge with `cannot be published before its body page exists`. The trigger is right: an
     * article with no body must not be on the site. So the pages are unpublished first, which
     * propagates through `sync_entity_page_status()` and returns each article to DRAFT — the state
     * SEED §20 seeded it in — before anything is removed.
     *
     * PUBLISHED -> DRAFT is a legal edge in the workflow, so this needs no special path.
     */
    const unpublished = await client.query(
      `update pages set status = 'DRAFT' where is_demo and status = 'PUBLISHED'`,
    )

    const removed: [string, number][] = []
    for (const table of TABLES) {
      const { rowCount } = await client.query(`delete from ${table} where is_demo`)
      removed.push([table, rowCount ?? 0])
    }

    // The seeder published these; a purge that left them published would leave the content seed
    // runner reading its own seven rows as "a human shipped it" forever.
    const categories = await client.query(
      `update categories set status = 'DRAFT', published_at = null
        where status = 'PUBLISHED' and seed_key is not null`,
    )

    // An article whose demo body has just been deleted already has page_id set to null by the
    // foreign key. This catches the case where the page was removed some other way.
    const articles = await client.query(
      `update journal_articles set page_id = null
        where page_id is not null and not exists (select 1 from pages p where p.id = page_id)`,
    )

    await client.query(dryRun ? 'rollback' : 'commit')

    console.log(`\ndemo content ${dryRun ? 'PLANNED (nothing removed)' : 'purged'}`)
    console.log(
      `  ${'demo pages'.padEnd(20)} ${String(unpublished.rowCount ?? 0).padStart(4)} unpublished first`,
    )
    for (const [table, count] of removed) {
      console.log(`  ${table.padEnd(20)} ${String(count).padStart(4)} removed`)
    }
    console.log(
      `  ${'categories'.padEnd(20)} ${String(categories.rowCount ?? 0).padStart(4)} returned to DRAFT`,
    )
    console.log(
      `  ${'journal_articles'.padEnd(20)} ${String(articles.rowCount ?? 0).padStart(4)} unlinked from a deleted body`,
    )
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
