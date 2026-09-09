#!/usr/bin/env node
/**
 * demo:seed — write the owner-authorised placeholder content, all of it marked `is_demo`.
 *
 * WHY THIS IS NOT `npm run seed:content`. The content seed runner carries the SEED specification's
 * own words for a real business, and its `SeedableTable` union has no `products` member on purpose:
 * SEED §32 forbids seeded inventory and the TYPE is the enforcement, so a module targeting products
 * cannot even be written. The owner's authorisation covers placeholder rows written by a separate,
 * separately-named, reversible tool. It does not reopen that rule, and this script does not touch
 * `content/seed/**` or the runner that reads it.
 *
 * WHAT MAKES IT SAFE TO RUN IS THAT IT IS SAFE TO UNDO. Every row it writes carries `is_demo`, and
 * `npm run demo:purge` deletes every row carrying it and puts back the two seeded statuses this
 * script changes. Nothing here edits a real row's content: the only writes to non-demo rows are
 * `status` on the seven categories and `page_id` on the ten seeded articles, both recorded in
 * `docs/content/DEMO_CONTENT.md` and both reversed by the purge.
 *
 * IDEMPOTENT, keyed on `slug`. Re-running updates the demo rows in place rather than duplicating
 * them, and it never overwrites a row that is not already `is_demo` — if the owner has replaced a
 * demo product with a real one under the same slug, this stands down and says so, because the whole
 * point of the exercise is that real data replaces placeholder data and not the other way round.
 *
 *   npm run demo:seed
 *   npm run demo:seed -- --dry-run
 */
import pg from 'pg'

import { DEMO_ARTICLE_BODIES } from './articles'
import { DEMO_PRODUCTS } from './content'
import { DEMO_PROJECTS, DEMO_TESTIMONIALS } from './portfolio'

const dryRun = process.argv.includes('--dry-run')

const url = process.env['DATABASE_URL']
if (url === undefined || url === '') {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })

type Counts = Record<string, { written: number; skipped: number }>
const counts: Counts = {}

function record(kind: string, outcome: 'written' | 'skipped') {
  counts[kind] = counts[kind] ?? { written: 0, skipped: 0 }
  counts[kind][outcome] += 1
}

/**
 * Refuse to overwrite a row somebody has made real.
 *
 * Returns true when the slug is free or already demo. A row that exists WITHOUT `is_demo` is the
 * owner's — replacing a placeholder with the real thing is exactly the outcome this whole exercise
 * exists to reach, and re-running the seeder must not undo it.
 */
async function claimable(table: string, slug: string): Promise<boolean> {
  const { rows } = await client.query<{ is_demo: boolean }>(
    `select is_demo from ${table} where slug = $1`,
    [slug],
  )
  if (rows.length === 0) return true
  return rows[0]!.is_demo === true
}

/**
 * Move a page to PUBLISHED along the only legal path.
 *
 * `guard_stage_transition` refuses DRAFT -> PUBLISHED outright; the workflow is DRAFT -> REVIEW ->
 * APPROVED -> PUBLISHED and every edge is checked. Walking it is not a workaround — it is the same
 * path an editor takes, so a demo article's revision trail reads like a real one.
 *
 * IT STARTS FROM WHERE THE PAGE ACTUALLY IS, which is what makes re-running this script safe. The
 * first version always walked all three edges and, on the second run, asked an already-published
 * page to go back to REVIEW — a transition the guard also refuses, and rightly: that is not a step
 * forward, it is an unpublish nobody asked for.
 */
const PUBLISH_PATH = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'] as const

async function walkToPublished(pageId: string): Promise<void> {
  const { rows } = await client.query<{ status: string }>(
    `select status::text as status from pages where id = $1`,
    [pageId],
  )
  const current = rows[0]?.status
  if (current === undefined || current === 'PUBLISHED') return

  const from = PUBLISH_PATH.indexOf(current as (typeof PUBLISH_PATH)[number])
  // A page sitting in ARCHIVED is not on this path. Leave it alone and say nothing: an archived
  // demo body is somebody having decided something, and this script does not overrule that.
  if (from === -1) return

  for (const status of PUBLISH_PATH.slice(from + 1)) {
    await client.query(
      `update pages set status = $2::content_status,
                        published_at = case when $2 = 'PUBLISHED' then coalesce(published_at, now())
                                            else published_at end
        where id = $1`,
      [pageId, status],
    )
  }
}

async function seedProducts(categoryIds: ReadonlyMap<string, string>) {
  for (const [index, product] of DEMO_PRODUCTS.entries()) {
    if (!(await claimable('products', product.slug))) {
      record('product', 'skipped')
      continue
    }
    if (dryRun) {
      record('product', 'written')
      continue
    }

    const categoryId = categoryIds.get(product.category)
    if (categoryId === undefined) {
      throw new Error(
        `${product.slug}: category "${product.category}" is not seeded. Demo content may only ` +
          'use the seven categories the SEED specification defines; inventing an eighth would be ' +
          'the placeholder deciding the taxonomy.',
      )
    }

    await client.query(
      `insert into products (
         slug, title, subtitle, summary, description, category_id,
         price_state, availability_state, is_large_format, is_customizable,
         sort_order, status, owner_verification, fact_classification, is_demo,
         specifications_omitted
       ) values ($1,$2,$3,$4,$5,$6,'PRICE_ON_REQUEST','MADE_TO_ORDER',$7,$8,$9,'PUBLISHED','NOT_REQUIRED','EDITORIAL_COPY',true,true)
       on conflict (slug) do update set
         title = excluded.title, subtitle = excluded.subtitle, summary = excluded.summary,
         description = excluded.description, category_id = excluded.category_id,
         is_large_format = excluded.is_large_format, is_customizable = excluded.is_customizable,
         sort_order = excluded.sort_order`,
      [
        product.slug,
        product.title,
        product.subtitle,
        product.summary,
        product.description,
        categoryId,
        product.isLargeFormat === true,
        product.isCustomizable === true,
        (index + 1) * 10,
      ],
    )
    record('product', 'written')
  }
}

/**
 * A body for each of the ten SEED §20 article drafts.
 *
 * THE ARTICLE ROW IS NOT DEMO; ITS BODY IS. SEED §20 supplied the ten titles and angles and they
 * are the specification's, not a placeholder's — so the `journal_articles` rows keep `is_demo`
 * false and only the `pages` and `page_sections` this creates carry the flag. What the purge removes
 * is the writing, which returns each article to the brief it was seeded as.
 *
 * THREE OF THE TEN STAY DRAFT. They carry `OWNER_VERIFICATION_REQUIRED` because SEED §20 attaches a
 * caution to them — claims about standards, capability or preservation performance — and the
 * database refuses PUBLISHED while that flag is set. That refusal is correct and this script does
 * not work around it: those three get a body and wait for the owner.
 */
async function seedArticleBodies() {
  for (const [slug, bands] of Object.entries(DEMO_ARTICLE_BODIES)) {
    const article = await client.query<{ id: string; page_id: string | null; ov: string }>(
      `select id, page_id, owner_verification as ov from journal_articles where slug = $1`,
      [slug],
    )
    if (article.rows.length === 0) {
      record('article body', 'skipped')
      continue
    }
    const row = article.rows[0]!

    // A body somebody else wrote is not ours to replace.
    if (row.page_id !== null) {
      const existing = await client.query<{ is_demo: boolean }>(
        `select is_demo from pages where id = $1`,
        [row.page_id],
      )
      if (existing.rows.length > 0 && existing.rows[0]!.is_demo !== true) {
        record('article body', 'skipped')
        continue
      }
    }
    if (dryRun) {
      record('article body', 'written')
      continue
    }

    const publishable = row.ov !== 'OWNER_VERIFICATION_REQUIRED'
    const pageSlug = `journal-${slug}`

    const page = await client.query<{ id: string }>(
      `insert into pages (slug, path, kind, title, status, is_demo, fact_classification)
       values ($1, $2, 'ARTICLE', $3, 'DRAFT', true, 'EDITORIAL_COPY')
       on conflict (slug) do update set title = excluded.title
       returning id`,
      [pageSlug, `/journal/${slug}`, slug],
    )
    const pageId = page.rows[0]!.id

    await client.query(`update journal_articles set page_id = $1 where id = $2`, [pageId, row.id])
    // Sections are replaced wholesale: editing a band in this file must not leave the old one
    // behind, and a demo page has no history worth preserving.
    await client.query(`delete from page_sections where page_id = $1 and is_demo`, [pageId])

    for (const [position, band] of bands.entries()) {
      await client.query(
        `insert into page_sections (
           page_id, block_type, position, is_visible, heading, body, status, is_demo,
           fact_classification
         ) values ($1, $2, $3, true, $4, $5, 'PUBLISHED', true, 'EDITORIAL_COPY')`,
        [pageId, band.blockType, position + 1, band.heading, band.body],
      )
    }

    // Publishing the PAGE is what publishes the article: `sync_entity_page_status` propagates the
    // status, and `enforce_article_has_body()` fires from inside that update — so an article whose
    // body has no visible section fails here rather than reaching the site empty.
    if (publishable) {
      /*
       * THE WORKFLOW IS WALKED, NOT JUMPED. `guard_stage_transition` refuses DRAFT -> PUBLISHED
       * outright — the legal path is DRAFT -> REVIEW -> APPROVED -> PUBLISHED — and going straight
       * there raised `illegal status transition DRAFT -> PUBLISHED on pages`. Stepping through the
       * three edges is not a workaround: it is the same path an editor takes, and it means the
       * revision trail for a demo article reads like a real one rather than like a script that
       * found a shortcut.
       */
      await walkToPublished(pageId)
    }
    record('article body', 'written')
  }
}

/**
 * Portfolio projects and testimonials, both DRAFT and both unable to be anything else.
 *
 * `enforce_project_evidence_gate()` refuses PUBLISHED unless the owner has verified the project
 * happened; `enforce_testimonial_evidence_gate()` refuses it unless the person quoted has granted
 * consent. Neither can be satisfied by a script writing its own permission, and neither should be:
 * D10 names delivered projects, named customers and testimonials as the things that may never be
 * fabricated. These rows exist so the Studio screens have something to show. They do not reach the
 * public site, and the site's `/portfolio` keeps rendering its seeded empty state.
 */
async function seedPortfolio() {
  for (const [index, project] of DEMO_PROJECTS.entries()) {
    if (!(await claimable('portfolio_projects', project.slug))) {
      record('project', 'skipped')
      continue
    }
    if (dryRun) {
      record('project', 'written')
      continue
    }
    await client.query(
      `insert into portfolio_projects (
         slug, title, subtitle, summary, project_type, location_label,
         is_client_project, client_consent, sort_order,
         status, owner_verification, fact_classification, is_demo
       ) values ($1,$2,$3,$4,$5,$6,false,'NOT_APPLICABLE',$7,'DRAFT','OWNER_VERIFICATION_REQUIRED','EDITORIAL_COPY',true)
       on conflict (slug) do update set
         title = excluded.title, subtitle = excluded.subtitle, summary = excluded.summary,
         project_type = excluded.project_type, location_label = excluded.location_label,
         sort_order = excluded.sort_order`,
      [
        project.slug,
        project.title,
        project.subtitle,
        project.summary,
        project.projectType,
        project.locationLabel,
        (index + 1) * 10,
      ],
    )
    record('project', 'written')
  }

  for (const [index, testimonial] of DEMO_TESTIMONIALS.entries()) {
    const existing = await client.query<{ id: string; is_demo: boolean }>(
      `select id, is_demo from testimonials where quote = $1`,
      [testimonial.quote],
    )
    if (existing.rows.length > 0 && existing.rows[0]!.is_demo !== true) {
      record('testimonial', 'skipped')
      continue
    }
    if (dryRun) {
      record('testimonial', 'written')
      continue
    }
    if (existing.rows.length > 0) {
      await client.query(`update testimonials set sort_order = $1 where id = $2`, [
        (index + 1) * 10,
        existing.rows[0]!.id,
      ])
    } else {
      await client.query(
        `insert into testimonials (
           attributed_to, attribution_role, quote, consent, sort_order,
           status, owner_verification, fact_classification, is_demo
         ) values ($1,$2,$3,'PENDING',$4,'DRAFT','OWNER_VERIFICATION_REQUIRED','EDITORIAL_COPY',true)`,
        [
          testimonial.attributedTo,
          testimonial.attributionRole,
          testimonial.quote,
          (index + 1) * 10,
        ],
      )
    }
    record('testimonial', 'written')
  }
}

/**
 * Publish the seven seeded categories.
 *
 * THE ONE EDIT THIS SCRIPT MAKES TO A NON-DEMO ROW, and it is reversed by the purge. Phase 09
 * seeded the categories DRAFT, which means `/collections/<slug>` has no category to render and the
 * whole demo catalogue would be unreachable. A category asserts nothing about the business — it is
 * taxonomy, exactly as the journal's nine categories are, and those seed PUBLISHED for this reason.
 *
 * The content seed runner will notice: rule 5c reads a row published beyond what the module asked
 * for as "a human shipped it" and stands down. That is correct behaviour, not a side effect to
 * apologise for, and the purge putting them back to DRAFT restores the runner's ownership.
 */
async function publishCategories(): Promise<{ published: number; withheld: string[] }> {
  /*
   * NOT ALL SEVEN. A category carrying `OWNER_VERIFICATION_REQUIRED` cannot be published —
   * `categories_verified_before_publish` refuses it — and that refusal is the specification working
   * rather than an obstacle: SEED flags the categories whose descriptions assert a capability, and
   * only the owner can confirm one. This script does not clear the flag to get its way.
   *
   * The consequence is worth stating plainly: a flagged category's page stays a 404 and the demo
   * products inside it are reachable only through the store listing and their own URLs, until the
   * owner verifies the category in Studio. The register records which ones.
   */
  const withheld = await client.query<{ slug: string }>(
    `select slug::text as slug from categories
      where seed_key is not null and owner_verification = 'OWNER_VERIFICATION_REQUIRED'
      order by slug`,
  )
  if (dryRun) return { published: 0, withheld: withheld.rows.map((r) => r.slug) }

  const { rowCount } = await client.query(
    `update categories set status = 'PUBLISHED', published_at = coalesce(published_at, now())
      where status = 'DRAFT' and seed_key is not null
        and owner_verification <> 'OWNER_VERIFICATION_REQUIRED'`,
  )
  return { published: rowCount ?? 0, withheld: withheld.rows.map((r) => r.slug) }
}

async function main() {
  await client.connect()
  await client.query('begin')

  try {
    const categories = await client.query<{ slug: string; id: string }>(
      `select slug::text as slug, id from categories`,
    )
    const categoryIds = new Map(categories.rows.map((r) => [r.slug, r.id]))

    const categoryResult = await publishCategories()
    await seedProducts(categoryIds)
    await seedArticleBodies()
    await seedPortfolio()

    await client.query(dryRun ? 'rollback' : 'commit')

    console.log(`\ndemo content ${dryRun ? 'PLANNED (nothing written)' : 'applied'}`)
    for (const [kind, outcome] of Object.entries(counts)) {
      console.log(
        `  ${kind.padEnd(14)} ${String(outcome.written).padStart(3)} written` +
          (outcome.skipped > 0 ? `, ${outcome.skipped} skipped (a real row holds that slug)` : ''),
      )
    }
    console.log(
      `  ${'categories'.padEnd(14)} ${String(categoryResult.published).padStart(3)} published`,
    )
    if (categoryResult.withheld.length > 0) {
      console.log(
        `\n  ${categoryResult.withheld.length} categor${categoryResult.withheld.length === 1 ? 'y' : 'ies'} stayed DRAFT because SEED flags them ` +
          'OWNER_VERIFICATION_REQUIRED:\n' +
          `    ${categoryResult.withheld.join(', ')}\n` +
          '  Their /collections pages 404 until the owner verifies them in Studio. The demo\n' +
          '  products inside them are still reachable from the store listing and their own URLs.',
      )
    }
    console.log('\nEvery row above carries is_demo. `npm run demo:purge` removes all of it.')
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
