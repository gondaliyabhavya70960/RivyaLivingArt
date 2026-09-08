#!/usr/bin/env tsx
import { writeFileSync } from 'node:fs'

import pg from 'pg'

import { seedModules } from '../../content/seed/index'

/**
 * Generate `docs/content/INITIAL_CONTENT_INVENTORY.md` — SEED §54's audit table.
 *
 * IT READS THE DATABASE, NOT THE MODULES, and the difference is the whole point. A generator that
 * walked `content/seed/**` would report what the seed INTENDED; §54 asks what is actually there,
 * which is the only version of the question worth answering after a run that skipped rows, or
 * against an environment where the seed has never been applied. The modules are consulted for one
 * thing only: which records were deferred, because those have no row to read.
 *
 * §54's target is "100% of intended launch copy mapped to Studio editing controls", so the Studio
 * location column is not decoration — it is the column the target is measured on. Every row gets
 * one, derived from what the row IS rather than hand-maintained per record.
 *
 * COMMITTED AND REGENERATED. `npm run content:check-inventory` regenerates and diffs, so a seed
 * that changed what is in the database and did not update this file fails the build — the same
 * shape as `media:check-status` and for the same reason: a generated document that silently stops
 * describing reality is worse than no document.
 */

const OUT = 'docs/content/INITIAL_CONTENT_INVENTORY.md'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
  process.exit(1)
}

type Row = {
  page: string
  section: string
  field: string
  seeded: string
  editable: string
  studio: string
  verify: string
  media: string
  seo: string
  status: string
}

const client = new pg.Client({ connectionString })

/** `|` would break the table, and a newline inside a cell breaks it worse. */
function cell(value: string | null): string {
  if (value === null || value === '') return '—'
  return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
}

async function main(): Promise<number> {
  await client.connect()

  const rows: Row[] = []

  // --- pages and their sections ---------------------------------------------------------------
  const sections = await client.query<{
    page_title: string
    path: string | null
    seed_key: string | null
    block_type: string
    position: number
    status: string
    owner_verification: string
    page_slug: string
    fields: Record<string, string | null>
    media_desktop: string | null
    media_mobile: string | null
  }>(`
    select p.title as page_title, p.path, s.seed_key, s.block_type, s.position, s.status,
           s.owner_verification, p.slug as page_slug,
           jsonb_build_object(
             'eyebrow', s.eyebrow, 'heading', s.heading, 'body', s.body,
             'supporting', s.supporting, 'cta_label', s.cta_label
           ) as fields,
           dm.rivya_asset_id as media_desktop, mm.rivya_asset_id as media_mobile
      from page_sections s
      join pages p on p.id = s.page_id
      left join media_assets dm on dm.id = s.media_desktop_id
      left join media_assets mm on mm.id = s.media_mobile_id
     where s.seed_key is not null
     order by p.path nulls last, s.position
  `)

  for (const s of sections.rows) {
    const written = Object.entries(s.fields).filter(([, v]) => v !== null && v !== '')
    const media = s.media_desktop ?? s.media_mobile ?? null
    // A section with no copy field set still gets a row: §54's target is about coverage, and a
    // section that seeded nothing is exactly what a coverage audit needs to show.
    const fieldList = written.length === 0 ? [['(no copy fields)', null] as const] : written

    for (const [field] of fieldList) {
      rows.push({
        page: cell(s.path ?? s.page_title),
        section: cell(s.seed_key?.replace('section:', '') ?? s.block_type),
        field: cell(field),
        seeded: 'Yes',
        editable: 'Yes',
        // THE SLUG, NOT THE UUID. `[pageId]` resolves either — `resolveStudioPage` looks a
        // non-uuid up by slug — and a uuid changes on every `db:reset`, which would make this
        // generated, committed, diff-checked file differ on every fresh database. A document that
        // cannot be regenerated identically is one the check gate has to be turned off for.
        studio: `/studio/content/pages/${s.page_slug}`,
        verify: s.owner_verification === 'OWNER_VERIFICATION_REQUIRED' ? 'Yes' : 'No',
        media: cell(media),
        seo: '—',
        status: s.status,
      })
    }
  }

  // --- the standalone tables --------------------------------------------------------------------
  const simple: readonly [string, string, string, string][] = [
    ['global_content', "group_key || '.' || key", 'Global content', '/studio/content/pages/global'],
    ['navigation_items', "menu || ' · ' || label", 'Navigation', '/studio/content/navigation'],
    ['faqs', 'question', 'FAQ', '/studio/content/faqs'],
    ['seo_entries', "scope || coalesce(' ' || path, '')", 'SEO', '/studio/content/seo'],
  ]

  for (const [table, label, pageLabel, studio] of simple) {
    const result = await client.query<{
      seed_key: string
      label: string
      status: string
      owner_verification: string
    }>(
      `select seed_key, ${label} as label, status, owner_verification
         from ${table} where seed_key is not null order by seed_key`,
    )
    for (const r of result.rows) {
      rows.push({
        page: pageLabel,
        section: cell(r.seed_key),
        field: cell(r.label),
        seeded: 'Yes',
        editable: 'Yes',
        studio,
        verify: r.owner_verification === 'OWNER_VERIFICATION_REQUIRED' ? 'Yes' : 'No',
        media: '—',
        seo: table === 'seo_entries' ? r.status : '—',
        status: r.status,
      })
    }
  }

  // --- the deferred ------------------------------------------------------------------------------
  //
  // Listed because §54 asks what is SEEDED, and "authored, not yet written" is a distinct answer
  // from both "seeded" and "missing". A reader auditing coverage needs to see these or they will
  // read the absence as a gap in the copy rather than a gap in the schema.
  const deferred = seedModules
    .flatMap((m) => m.records)
    .filter((r) => r.requiresTables !== undefined)

  for (const record of deferred) {
    rows.push({
      page: record.table === 'customization_forms' ? 'Commissions' : 'Journal',
      section: cell(record.seedKey),
      field: cell(String(record.fields.title ?? record.fields.name ?? '')),
      seeded: 'Deferred',
      editable: 'Not yet',
      studio: record.table === 'customization_forms' ? 'Phase 19' : 'Phase 18',
      verify: record.fields.owner_verification === 'OWNER_VERIFICATION_REQUIRED' ? 'Yes' : 'No',
      media: '—',
      seo: '—',
      status: String(record.fields.status ?? 'DRAFT'),
    })
  }

  // Read before the connection closes: everything the seed wrote, by key. Used by the
  // precondition check below, which is the last thing to run before the file is written.
  const present = await client.query<{ seed_key: string }>(`
    select seed_key from pages            where seed_key is not null
    union all
    select seed_key from page_sections    where seed_key is not null
    union all
    select seed_key from global_content   where seed_key is not null
    union all
    select seed_key from navigation_items where seed_key is not null
    union all
    select seed_key from seo_entries      where seed_key is not null
    union all
    select seed_key from faqs             where seed_key is not null
    union all
    select seed_key from categories       where seed_key is not null
  `)
  const seededKeys = new Set(present.rows.map((r) => r.seed_key))

  await client.end()

  const flagged = rows.filter((r) => r.verify === 'Yes').length
  const deferredCount = rows.filter((r) => r.seeded === 'Deferred').length
  const withMedia = rows.filter((r) => r.media !== '—').length

  const md = [
    '# Initial content inventory',
    '',
    '> GENERATED by `npm run content:inventory`. Do not edit by hand — `content:check-inventory`',
    '> regenerates this file and fails the build on a diff, so a hand edit is reverted rather than kept.',
    '',
    'SEED §54’s audit of what the content seed actually put in the database, read from the',
    'database rather than from the seed modules. Its target is §54’s: **100% of intended launch',
    'copy mapped to a Studio editing control.**',
    '',
    `- **${String(rows.length)}** rows audited`,
    `- **${String(flagged)}** await owner verification and cannot be published until it is given`,
    `- **${String(deferredCount)}** are authored and deferred to a later phase’s tables`,
    `- **${String(withMedia)}** carry a bound media asset`,
    '',
    'Every row that is seeded is editable: the sections through the page editor, the standalone',
    'tables through their own Studio surface. A `Deferred` row has no database row yet and names',
    'the phase that creates its table.',
    '',
    '| Page | Section | Field | Seeded? | Editable? | Studio location | Verification needed? | Media asset ID | SEO status | Publication status |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.page} | ${r.section} | ${r.field} | ${r.seeded} | ${r.editable} | \`${r.studio}\` | ${r.verify} | ${r.media} | ${r.seo} | ${r.status} |`,
    ),
    '',
  ].join('\n')

  /**
   * REFUSE TO WRITE FROM A DATABASE THAT IS NOT FULLY SEEDED.
   *
   * This file is committed and diff-checked, and it is generated from the DATABASE rather than
   * from the modules — deliberately, because what an editor can actually change is a property of
   * the rows, not of the source. The cost is that it faithfully records whatever state the
   * database happens to be in, and `npm run test` leaves it in a damaged one: the RLS and
   * repository suites delete seeded rows as part of their own fixtures. Running the generator
   * after the tests produced an inventory with 143 rows missing, which looked exactly like a
   * generated file and passed every gate around it.
   *
   * So the generator asserts its own precondition. Every non-deferred record the modules declare
   * must be present; anything missing means the database is not the seeded one, and the honest
   * answer is to refuse rather than to write a smaller truth.
   */
  const expected = seedModules.flatMap((module) =>
    module.records.filter((record) => (record.requiresTables ?? []).length === 0),
  )
  const missing = expected.filter((record) => !seededKeys.has(record.seedKey))
  if (missing.length > 0) {
    console.error(
      `\ncontent:inventory refused: ${String(missing.length)} of ${String(expected.length)} seeded records are absent from the database.\n` +
        'The inventory is generated from rows, so writing it now would record a damaged state as\n' +
        'though it were the seed. `npm run test` deletes seeded rows — re-seed before generating:\n\n' +
        '    npm run db:reset && npm run seed:content && npm run content:inventory\n\n' +
        `First missing: ${missing
          .slice(0, 5)
          .map((record) => record.seedKey)
          .join(', ')}\n`,
    )
    return 1
  }

  writeFileSync(OUT, md)
  console.log(
    `✓ ${OUT}: ${String(rows.length)} rows, ${String(flagged)} awaiting verification, ${String(deferredCount)} deferred`,
  )
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch(async (error) => {
    console.error('\ncontent:inventory failed\n', error)
    try {
      await client.end()
    } catch {
      // already closed
    }
    process.exit(1)
  })
