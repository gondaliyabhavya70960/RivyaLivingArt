import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { listPages } from '@/lib/supabase/repositories/cms'
import {
  listDerivableSections,
  listSeoEntries,
  listSeoEntities,
  type SeoEntitySummary,
  type SeoEntityType,
} from '@/lib/supabase/repositories/seo'
import type { SeoEntry } from '@/lib/supabase/schemas'

import type { CoverageRow } from './coverage'
import { deriveEntitySeo, deriveSeo, resolveSeo, type ResolvedSeo } from './resolve'

type Client = SupabaseClient<Database>

/**
 * The Studio's view of the ladder — every page and every entity resolved with the SAME function
 * the public site uses (`resolveSeo`), so what the Pages and Entities tabs print beside a field
 * is what a crawler will read, level for level.
 *
 * READ AS THE SESSION, so a DRAFT row an editor is working on shows up here while the public site
 * still resolves without it. The level column says which rung answered; the row's status says
 * whether the public site can see that rung yet.
 */

export type StudioPageRow = {
  readonly pageId: string
  readonly path: string
  readonly kind: string
  readonly pageTitle: string
  readonly status: string
  readonly entry: SeoEntry | null
  readonly resolved: ResolvedSeo
}

export type StudioEntityRow = SeoEntitySummary & {
  readonly entry: SeoEntry | null
  readonly pathEntry: SeoEntry | null
  readonly resolved: ResolvedSeo
}

export type StudioResolution = {
  readonly global: SeoEntry | null
  readonly pages: readonly StudioPageRow[]
  readonly entities: readonly StudioEntityRow[]
  readonly entries: readonly SeoEntry[]
}

function entryKey(scope: string, a: string | null, b: string | null): string {
  return `${scope}:${a ?? ''}:${b ?? ''}`
}

export async function resolveForStudio(client: Client): Promise<StudioResolution> {
  const [entries, pages, sections, entities] = await Promise.all([
    listSeoEntries(client),
    listPages(client),
    listDerivableSections(client),
    listSeoEntities(client),
  ])

  const global = entries.find((entry) => entry.scope === 'GLOBAL') ?? null
  const byKey = new Map<string, SeoEntry>()
  for (const entry of entries) {
    if (entry.scope === 'PATH') byKey.set(entryKey('PATH', entry.path, null), entry)
    if (entry.scope === 'ENTITY') {
      byKey.set(entryKey('ENTITY', entry.entity_type, entry.entity_id), entry)
    }
  }
  const pathEntry = (path: string): SeoEntry | null =>
    byKey.get(entryKey('PATH', path, null)) ?? null
  const entityEntry = (type: SeoEntityType, id: string): SeoEntry | null =>
    byKey.get(entryKey('ENTITY', type, id)) ?? null

  // The DERIVED rung for a page: its live sections, in order — the same reduction the public
  // site performs on what it renders.
  const sectionsByPage = new Map<string, { heading: string | null; body: string | null }[]>()
  for (const section of sections) {
    if (section.status !== 'PUBLISHED' || !section.is_visible) continue
    sectionsByPage.set(section.page_id, [
      ...(sectionsByPage.get(section.page_id) ?? []),
      { heading: section.heading, body: section.body },
    ])
  }

  /*
   * A CATEGORY PAGE IS THE CATEGORY'S ADDRESS. `/collection/furniture` is one `pages` row (the
   * blocks) and one `categories` row (the name, the description, `seo_title`, `seo_description`),
   * and a crawler sees one page. So the category's own columns are that page's ENTITY rung, the
   * page is listed once, under Pages, and categories do not appear again under Entities.
   */
  const categoryByPath = new Map(
    entities
      .filter((entity) => entity.type === 'categories')
      .map((entity) => [entity.path, entity]),
  )

  const pageRows: StudioPageRow[] = pages
    .filter((page) => page.path !== null && (page.kind === 'PAGE' || page.kind === 'CATEGORY'))
    .map((page) => {
      const path = page.path as string
      const entry = pathEntry(path)
      const category = page.kind === 'CATEGORY' ? (categoryByPath.get(path) ?? null) : null
      return {
        pageId: page.id,
        path,
        kind: page.kind,
        pageTitle: page.title,
        status: page.status,
        entry,
        resolved: resolveSeo({
          entity: category === null ? null : entityEntry('categories', category.id),
          entityOwn:
            category === null
              ? null
              : { title: category.ownTitle, description: category.ownDescription },
          path: entry,
          derived:
            category === null
              ? deriveSeo(sectionsByPage.get(page.id) ?? [])
              : deriveEntitySeo({ name: category.name, summary: category.summary }),
          global,
        }),
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))

  const entityRows: StudioEntityRow[] = entities
    .filter((entity) => entity.type !== 'categories')
    .map((entity) => {
      const entry = entityEntry(entity.type, entity.id)
      const pageRow = pathEntry(entity.path)
      return {
        ...entity,
        entry,
        pathEntry: pageRow,
        resolved: resolveSeo({
          entity: entry,
          entityOwn: { title: entity.ownTitle, description: entity.ownDescription },
          path: pageRow,
          derived: deriveEntitySeo({ name: entity.name, summary: entity.summary }),
          global,
        }),
      }
    })

  return { global, pages: pageRows, entities: entityRows, entries }
}

/** The resolution flattened to what the coverage arithmetic reads. */
export function coverageRows(resolution: StudioResolution): CoverageRow[] {
  return [
    ...resolution.pages.map((row) => ({
      path: row.path,
      kind: 'page' as const,
      title: row.resolved.title.value,
      titleLevel: row.resolved.title.level,
      description: row.resolved.description.value,
      descriptionLevel: row.resolved.description.level,
      ogMediaId: row.resolved.ogMediaId.value,
      noindex: row.resolved.noindex,
    })),
    ...resolution.entities.map((row) => ({
      path: row.path,
      kind: 'entity' as const,
      title: row.resolved.title.value,
      titleLevel: row.resolved.title.level,
      description: row.resolved.description.value,
      descriptionLevel: row.resolved.description.level,
      ogMediaId: row.resolved.ogMediaId.value,
      noindex: row.resolved.noindex,
    })),
  ]
}
