/**
 * seo:coverage — the SEO coverage section of `docs/content/INITIAL_CONTENT_INVENTORY.md`.
 *
 * RUN BY THE INVENTORY BUILDER, NOT ON ITS OWN SCHEDULE. `scripts/content/build-content-inventory.ts`
 * calls `buildSeoCoverage(pool)` and appends the section it returns, so `content:check-inventory`
 * regenerates and diffs the two together and the document stays one deterministic artefact of
 * one seeded database. Running this file directly prints the section for a look.
 *
 * WHAT IT COMPUTES is `lib/seo/coverage.ts` over rows read with `pg`, resolved with the same
 * `resolveSeo` the site and the Studio use. Every figure is a count of rows in a named state.
 */
import pg from 'pg'

import { coverageMarkdown, coverageReport, type CoverageRow } from '../../lib/seo/coverage'
import { deriveEntitySeo, deriveSeo, resolveSeo, type SeoEntryLike } from '../../lib/seo/resolve'

type EntryRow = SeoEntryLike & {
  scope: string
  path: string | null
  entity_type: string | null
  entity_id: string | null
}

export async function buildSeoCoverage(client: pg.Client): Promise<string> {
  const entries = (
    await client.query<EntryRow>(
      `select scope, path, entity_type, entity_id, title, description, social_title,
              social_description, og_media_id, canonical_url, robots, noindex, nofollow
         from seo_entries`,
    )
  ).rows
  const global = entries.find((row) => row.scope === 'GLOBAL') ?? null
  const pathEntry = (path: string) =>
    entries.find((row) => row.scope === 'PATH' && row.path === path) ?? null
  const entityEntry = (type: string, id: string) =>
    entries.find(
      (row) => row.scope === 'ENTITY' && row.entity_type === type && row.entity_id === id,
    ) ?? null

  const pages = (
    await client.query<{ id: string; path: string; kind: string }>(
      `select id, path, kind from pages where path is not null and kind in ('PAGE', 'CATEGORY') order by path`,
    )
  ).rows
  const sections = (
    await client.query<{ page_id: string; heading: string | null; body: string | null }>(
      `select page_id, heading, body from page_sections
        where status = 'PUBLISHED' and is_visible order by page_id, position`,
    )
  ).rows
  const byPage = new Map<string, { heading: string | null; body: string | null }[]>()
  for (const section of sections) {
    byPage.set(section.page_id, [...(byPage.get(section.page_id) ?? []), section])
  }

  const categories = (
    await client.query<{
      id: string
      path: string
      name: string | null
      summary: string | null
      own_title: string | null
      own_description: string | null
    }>(
      `select id, '/collection/' || lower(slug) as path, name, description as summary,
              seo_title as own_title, seo_description as own_description from categories`,
    )
  ).rows
  const categoryByPath = new Map(categories.map((row) => [row.path, row]))

  // A CATEGORY page carries its category's own columns as the ENTITY rung and is listed once.
  const rows: CoverageRow[] = pages.map((page) => {
    const category = page.kind === 'CATEGORY' ? (categoryByPath.get(page.path) ?? null) : null
    const resolved = resolveSeo({
      entity: category === null ? null : entityEntry('categories', category.id),
      entityOwn:
        category === null
          ? null
          : { title: category.own_title, description: category.own_description },
      path: pathEntry(page.path),
      derived:
        category === null
          ? deriveSeo(byPage.get(page.id) ?? [])
          : deriveEntitySeo({ name: category.name, summary: category.summary }),
      global,
    })
    return {
      path: page.path,
      kind: 'page',
      title: resolved.title.value,
      titleLevel: resolved.title.level,
      description: resolved.description.value,
      descriptionLevel: resolved.description.level,
      ogMediaId: resolved.ogMediaId.value,
      noindex: resolved.noindex,
    }
  })

  const entities = (
    await client.query<{
      type: string
      id: string
      path: string
      name: string | null
      summary: string | null
      own_title: string | null
      own_description: string | null
    }>(`
      select 'products' as type, id, '/product/' || lower(slug) as path, title as name, summary,
             seo_title as own_title, seo_description as own_description from products
      union all
      select 'collections', id, '/collections/' || lower(slug), name, statement, null, null from collections
      union all
      select 'portfolio_projects', id, '/portfolio/' || lower(slug), title, summary, null, null from portfolio_projects
      union all
      select 'journal_articles', id, '/journal/' || lower(slug), title, excerpt, null, null from journal_articles
      order by 3
    `)
  ).rows
  for (const entity of entities) {
    const resolved = resolveSeo({
      entity: entityEntry(entity.type, entity.id),
      entityOwn: { title: entity.own_title, description: entity.own_description },
      path: pathEntry(entity.path),
      derived: deriveEntitySeo({ name: entity.name, summary: entity.summary }),
      global,
    })
    rows.push({
      path: entity.path,
      kind: 'entity',
      title: resolved.title.value,
      titleLevel: resolved.title.level,
      description: resolved.description.value,
      descriptionLevel: resolved.description.level,
      ogMediaId: resolved.ogMediaId.value,
      noindex: resolved.noindex,
    })
  }

  const keywords = (
    await client.query<{ research_status: string }>(
      'select research_status from seo_keyword_themes',
    )
  ).rows

  return coverageMarkdown(coverageReport(rows, keywords))
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL']
  if (url === undefined) throw new Error('DATABASE_URL is not set')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    process.stdout.write(await buildSeoCoverage(client))
  } finally {
    await client.end()
  }
}

if (process.argv[1]?.endsWith('build-seo-coverage.ts')) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
