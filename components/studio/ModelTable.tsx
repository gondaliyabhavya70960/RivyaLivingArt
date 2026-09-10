import type { Route } from 'next'
import Link from 'next/link'
import * as React from 'react'

import { DataTable, type Column } from './DataTable'
import { FilterBar } from './FilterBar'
import { megabytes } from './model-findings'
import { StatusPill } from './StatusPill'
import { t } from './strings'
import { Badge } from '@/components/primitives/Badge'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The model list: what the inspector read, whether a poster exists, and where the model is shown.
 *
 * NUMBERS ARE SHOWN, NOT EDITED. Triangles and size come from the row the inspector wrote; a
 * model that predates an inspection says so rather than showing a zero. "Inspect" opens the
 * drawer through a search param, so the page stays one server render with no client fetch.
 */
export function ModelTable({
  path,
  assets,
  search,
}: {
  readonly path: string
  readonly assets: readonly MediaAsset[]
  readonly search: string
}): React.ReactElement {
  const columns: readonly Column<MediaAsset>[] = [
    {
      id: 'name',
      header: t('studio.models.col.name'),
      cell: (asset) => (
        <Stack gap={1}>
          <Text>{asset.title ?? asset.filename ?? asset.public_id}</Text>
          <Text size="sm" tone="tertiary">
            {asset.alt_text}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'format',
      header: t('studio.models.col.format'),
      cell: (asset) => (
        <Badge tone="neutral">{asset.model_format ?? t('studio.models.meta.none')}</Badge>
      ),
    },
    {
      id: 'size',
      header: t('studio.models.col.size'),
      numeric: true,
      cell: (asset) => (
        <Text size="sm">
          {asset.file_size_bytes === null
            ? t('studio.models.notInspected')
            : megabytes(asset.file_size_bytes)}
        </Text>
      ),
    },
    {
      id: 'triangles',
      header: t('studio.models.col.triangles'),
      numeric: true,
      cell: (asset) => (
        <Text size="sm">
          {asset.poly_count === null
            ? t('studio.models.notInspected')
            : asset.poly_count.toLocaleString('en-GB')}
        </Text>
      ),
    },
    {
      id: 'textures',
      header: t('studio.models.col.textures'),
      numeric: true,
      cell: (asset) => (
        <Text size="sm">
          {asset.texture_count === null ? t('studio.models.notInspected') : asset.texture_count}
        </Text>
      ),
    },
    {
      id: 'poster',
      header: t('studio.models.col.poster'),
      cell: (asset) =>
        asset.model_poster_id === null ? (
          <Badge tone="warning">{t('studio.models.posterMissing')}</Badge>
        ) : (
          <Badge tone="success">{t('studio.models.posterSet')}</Badge>
        ),
    },
    {
      id: 'association',
      header: t('studio.models.col.association'),
      cell: (asset) => (
        <Text size="sm" tone="secondary">
          {asset.associated_product_id !== null
            ? t('studio.models.associatedProduct')
            : asset.associated_project_id !== null
              ? t('studio.models.associatedProject')
              : t('studio.models.unassociated')}
        </Text>
      ),
    },
    {
      id: 'status',
      header: t('studio.models.col.status'),
      cell: (asset) => <StatusPill status={asset.status} />,
    },
    {
      id: 'inspect',
      header: t('studio.models.inspectAction'),
      cell: (asset) => (
        <Link
          href={`${path}?asset=${asset.id}` as Route}
          className="text-ink-accent underline-offset-2 hover:underline"
          data-model-inspect-link={asset.id}
        >
          {t('studio.models.inspectAction')}
        </Link>
      ),
    },
  ]

  const filtered = search.trim() !== ''

  return (
    <Stack gap={4}>
      <FilterBar
        label={t('studio.media.searchLabel')}
        action={path}
        applyLabel={t('studio.media.searchAction')}
        activeCount={filtered ? 1 : 0}
        activeLabel={t('studio.media.searchLabel')}
      >
        <Field label={t('studio.media.searchLabel')} controlId="model-search">
          <Input id="model-search" name="q" defaultValue={search} />
        </Field>
      </FilterBar>

      <DataTable
        caption={t('studio.models.list.caption')}
        columns={columns}
        rows={assets}
        rowKey={(asset) => asset.id}
        empty={
          filtered
            ? {
                reason: 'filtered',
                heading: t('studio.models.emptyFiltered.title'),
                body: t('studio.models.emptyFiltered.body'),
              }
            : {
                reason: 'empty',
                heading: t('studio.models.empty.title'),
                body: t('studio.models.empty.body'),
              }
        }
      />
    </Stack>
  )
}
