import Link from 'next/link'

import { Text } from '@/components/primitives/Text'
import { DataTable } from '@/components/studio/DataTable'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import type { StudioPageRow } from '@/lib/seo/studio-resolution'

import { LevelBadge } from './LevelBadge'
import { seoTabHref } from './SeoTabs'

/** The Pages tab — one row per D3 path, the resolved title and description and where each came from. */
export function PagesTable({ rows }: { readonly rows: readonly StudioPageRow[] }) {
  return (
    <DataTable
      caption={t('studio.seo.pages.caption')}
      rows={rows}
      rowKey={(row) => row.pageId}
      empty={{
        reason: 'empty',
        heading: t('studio.seo.pages.emptyHeading'),
        body: t('studio.seo.pages.emptyBody'),
      }}
      columns={[
        {
          id: 'path',
          header: t('studio.seo.col.path'),
          cell: (row) => (
            <Link
              href={seoTabHref('pages', { path: row.path })}
              className="underline underline-offset-4"
              data-seo-page={row.path}
            >
              {row.path}
            </Link>
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
          cell: (row) => (
            <span className="flex flex-wrap items-center gap-2">
              <Text as="span" size="sm" tone="secondary">
                {row.resolved.description.value ?? '—'}
              </Text>
              <LevelBadge level={row.resolved.description.level} />
            </span>
          ),
        },
        {
          id: 'directive',
          header: t('studio.seo.col.directive'),
          cell: (row) =>
            `${row.resolved.noindex ? 'noindex' : 'index'}, ${row.resolved.nofollow ? 'nofollow' : 'follow'}`,
        },
        {
          id: 'entry',
          header: t('studio.seo.col.entry'),
          cell: (row) =>
            row.entry === null ? (
              <Text as="span" size="xs" tone="tertiary">
                {t('studio.seo.entry.noneYet')}
              </Text>
            ) : (
              <StatusPill status={row.entry.status} />
            ),
        },
      ]}
    />
  )
}
