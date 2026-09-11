import Link from 'next/link'

import { Text } from '@/components/primitives/Text'
import { DataTable } from '@/components/studio/DataTable'
import { StatusPill } from '@/components/studio/StatusPill'
import { t, type StudioStringKey } from '@/components/studio/strings'
import type { StudioEntityRow } from '@/lib/seo/studio-resolution'
import type { SeoEntityType } from '@/lib/supabase/repositories/seo'

import { LevelBadge } from './LevelBadge'
import { seoTabHref } from './SeoTabs'

const TYPE_LABEL: Readonly<Record<SeoEntityType, StudioStringKey>> = {
  products: 'studio.seo.entities.products',
  categories: 'studio.seo.entities.categories',
  collections: 'studio.seo.entities.collections',
  portfolio_projects: 'studio.seo.entities.projects',
  journal_articles: 'studio.seo.entities.articles',
}

/** The Entities tab — products, categories, collections, projects and articles, filterable to "using derived metadata". */
export function EntitiesTable({
  rows,
  derivedOnly,
}: {
  readonly rows: readonly StudioEntityRow[]
  readonly derivedOnly: boolean
}) {
  const shown = derivedOnly
    ? rows.filter(
        (row) =>
          row.resolved.title.level === 'DERIVED' || row.resolved.description.level === 'DERIVED',
      )
    : rows
  return (
    <div className="grid gap-3" data-seo-entities="">
      <div className="flex flex-wrap gap-4">
        <Link
          href={seoTabHref('entities')}
          aria-current={derivedOnly ? undefined : 'true'}
          className="underline underline-offset-4"
        >
          <Text as="span" size="sm">
            {t('studio.seo.entities.all')}
          </Text>
        </Link>
        <Link
          href={seoTabHref('entities', { derived: '1' })}
          aria-current={derivedOnly ? 'true' : undefined}
          className="underline underline-offset-4"
          data-seo-derived-filter=""
        >
          <Text as="span" size="sm">
            {t('studio.seo.entities.derivedOnly')}
          </Text>
        </Link>
      </div>
      <DataTable
        caption={t('studio.seo.entities.caption')}
        rows={shown}
        rowKey={(row) => `${row.type}:${row.id}`}
        empty={{
          reason: 'empty',
          heading: t('studio.seo.entities.emptyHeading'),
          body: t('studio.seo.entities.emptyBody'),
        }}
        columns={[
          {
            id: 'entity',
            header: t('studio.seo.col.entity'),
            cell: (row) => (
              <span className="grid">
                <Link
                  href={seoTabHref('entities', { entity_type: row.type, entity_id: row.id })}
                  className="underline underline-offset-4"
                  data-seo-entity={`${row.type}:${row.id}`}
                >
                  {row.name ?? row.slug}
                </Link>
                <Text as="span" size="xs" tone="tertiary">
                  {t(TYPE_LABEL[row.type])} · {row.path}
                </Text>
              </span>
            ),
          },
          {
            id: 'title',
            header: t('studio.seo.col.title'),
            cell: (row) => (
              <span className="flex flex-wrap items-center gap-2">
                <Text as="span" size="sm">
                  {row.resolved.title.value ?? '—'}
                </Text>
                <LevelBadge level={row.resolved.title.level} />
              </span>
            ),
          },
          {
            id: 'description',
            header: t('studio.seo.col.description'),
            cell: (row) => <LevelBadge level={row.resolved.description.level} />,
          },
          {
            id: 'status',
            header: t('studio.seo.col.status'),
            cell: (row) => <StatusPill status={row.status as never} />,
          },
        ]}
      />
    </div>
  )
}
