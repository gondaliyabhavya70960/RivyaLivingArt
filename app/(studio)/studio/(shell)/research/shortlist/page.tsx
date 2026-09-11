import type { Route } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { PageHeader } from '@/components/studio/PageHeader'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { ResearchBulkPreview } from '@/components/studio/research/BulkPreview'
import { PipelineBulkBar } from '@/components/studio/research/PipelineBulkBar'
import { RowActionBar } from '@/components/studio/research/RowActionBar'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { loadBulkOperations, operationsFor } from '@/lib/bulk/registry'
import { readBulkPreview } from '@/lib/bulk/run'
import { listTags, listTagsForProducts } from '@/lib/supabase/repositories/research/review'
import {
  countStaleEntries,
  listOpenShortlistEntries,
  type ShortlistRow,
} from '@/lib/supabase/repositories/research/shortlist'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

import {
  confirmAction,
  rejectAction,
  returnToReviewAction,
  shortlistAction,
} from '../changes/actions'
import { applyResearchBulkAction, previewResearchBulkAction } from '../bulk-actions'

/**
 * /studio/research/shortlist — the open entries, oldest first.
 *
 * THE ENTRY IS THE ROW HERE, NOT THE PRODUCT. Each line is a `research_shortlist_entries` row
 * that is still open: who shortlisted it, why, the score as it stood when they did (captured, not
 * re-read — a shortlist made on a score of 71 stays a shortlist made on 71), the tags, and how
 * long it has waited. Sorted by age by default because a shortlist nobody prunes is a graveyard,
 * and the research dashboard counts the entries open longer than sixty days for the same reason.
 *
 * FOUR THINGS A MERCHANDISER DOES FROM HERE, each the movement table's row: Confirm (with the
 * decision note it requires), Send back to review (closes the entry with a reason), Reject (a
 * disposition — the stage stays SHORTLISTED, proving the two columns are orthogonal), and the bulk
 * bar over the same rows with the Phase 24 engine's preview, typed count and undo.
 */
export const metadata = studioMetadata('/studio/research/shortlist')

const BASE_PATH = '/studio/research/shortlist'

const one = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? ''

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

function readCapture(value: unknown): { score: number | null; confidence: number | null } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { score: null, confidence: null }
  }
  const record = value as Record<string, unknown>
  return {
    score: typeof record['score'] === 'number' ? record['score'] : null,
    confidence: typeof record['confidence'] === 'number' ? record['confidence'] : null,
  }
}

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('research.read')
  const params = await searchParams
  const client = await createClient()

  const sourceParam = one(params.source)
  const ageParam = Number.parseInt(one(params.age), 10)
  const minAgeDays = Number.isFinite(ageParam) && ageParam > 0 ? ageParam : 0

  await loadBulkOperations()

  const [entries, sources, tags, stale] = await Promise.all([
    listOpenShortlistEntries(client),
    listResearchSources(client),
    listTags(client),
    countStaleEntries(client, 60),
  ])

  const cutoff = new Date().getTime() - minAgeDays * 86_400_000
  const rows = entries.filter(
    (entry) =>
      (!UUID.test(sourceParam) || entry.source_id === sourceParam) &&
      (minAgeDays === 0 || new Date(entry.opened_at).getTime() <= cutoff),
  )

  const productIds = rows.map((entry) => entry.research_product_id)
  const productTags = await listTagsForProducts(client, productIds)
  const tagLabel = new Map(tags.map((tag) => [tag.id, tag.label]))
  const tagsByProduct = new Map<string, string[]>()
  for (const link of productTags) {
    const list = tagsByProduct.get(link.research_product_id) ?? []
    list.push(tagLabel.get(link.tag_id) ?? link.tag_id)
    tagsByProduct.set(link.research_product_id, list)
  }
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))

  const canConfirm = roleHasPermission(session.role, 'research.confirm')
  const canDestroy = roleHasPermission(session.role, 'destructive.execute')
  const canBulk = roleHasPermission(session.role, 'bulk.execute') && canConfirm

  const currentFilters: Record<string, string> = {
    ...(UUID.test(sourceParam) ? { source: sourceParam } : {}),
    ...(minAgeDays > 0 ? { age: String(minAgeDays) } : {}),
  }
  const filtersQuery = new URLSearchParams(currentFilters).toString()
  const withFilters = (extra: Record<string, string>): string => {
    const search = new URLSearchParams(currentFilters)
    for (const [key, value] of Object.entries(extra)) search.set(key, value)
    const query = search.toString()
    return query === '' ? BASE_PATH : `${BASE_PATH}?${query}`
  }

  const operationId = one(params.operation)
  const preview =
    canBulk && operationId !== ''
      ? await readBulkPreview(operationId, { userId: session.userId, role: session.role })
      : null

  if (preview !== null) {
    return (
      <StudioPage path={BASE_PATH}>
        <ResearchBulkPreview
          kind={preview.kind}
          operationId={preview.operationId}
          confirmationToken={preview.confirmationToken}
          isDestructive={preview.isDestructive}
          rows={preview.items.map((item) => ({
            entityId: item.entityId,
            outcome: item.outcome,
            ...(item.reason === undefined ? {} : { reason: item.reason }),
            ...(item.rule === undefined ? {} : { rule: item.rule }),
            ...(item.label === undefined ? {} : { label: item.label }),
          }))}
          willApply={preview.counts.willApply}
          surface={BASE_PATH}
          backHref={filtersQuery === '' ? BASE_PATH : `${BASE_PATH}?${filtersQuery}`}
          applyAction={applyResearchBulkAction}
        />
      </StudioPage>
    )
  }

  const rowParam = one(params.row)
  const openRow = UUID.test(rowParam)
    ? (rows.find((entry) => entry.research_product_id === rowParam) ?? null)
    : null

  const columns: readonly Column<ShortlistRow>[] = [
    ...(canBulk
      ? [
          {
            id: 'select',
            header: t('studio.research.selectRow'),
            cell: (row: ShortlistRow) => (
              <input
                type="checkbox"
                name="selection"
                value={row.research_product_id}
                aria-label={row.title_normalized ?? row.research_product_id}
                data-select-row={row.research_product_id}
              />
            ),
          },
        ]
      : []),
    {
      id: 'row',
      header: t('studio.research.slColRow'),
      cell: (row) => (
        <Stack gap={1}>
          <Text size="sm" className="break-words">
            {row.title_normalized ?? row.research_product_id}
          </Text>
          <Text size="xs" tone="secondary">
            {sourceNames.get(row.source_id) ?? row.source_id}
            {row.disposition === 'NONE' ? '' : ` · ${row.disposition}`}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'score',
      header: t('studio.research.slColScore'),
      numeric: true,
      cell: (row) => {
        const captured = readCapture(row.captured)
        return (
          <Text size="sm" tone={captured.score === null ? 'secondary' : 'primary'}>
            {captured.score === null
              ? t('studio.research.slNotScored')
              : `${String(captured.score)}${captured.confidence === null ? '' : ` · ${String(Math.round(captured.confidence * 100))} %`}`}
          </Text>
        )
      },
    },
    {
      id: 'age',
      header: t('studio.research.slColAge'),
      cell: (row) => <RelativeTime value={row.opened_at} />,
    },
    {
      id: 'tags',
      header: t('studio.research.slColTags'),
      cell: (row) => (
        <Cluster gap={1}>
          {(tagsByProduct.get(row.research_product_id) ?? []).map((label) => (
            <Badge key={label} tone="neutral">
              {label}
            </Badge>
          ))}
        </Cluster>
      ),
    },
    {
      id: 'reason',
      header: t('studio.research.slColReason'),
      cell: (row) => (
        <Text size="sm" className="break-words" data-entry-reason={row.id}>
          {row.reason}
        </Text>
      ),
    },
    {
      id: 'open',
      header: t('studio.research.openRow'),
      cell: (row) => (
        <Link
          href={withFilters({ row: row.research_product_id }) as Route}
          className="text-sm underline underline-offset-4"
          data-open-row={row.research_product_id}
        >
          {t('studio.research.openRow')}
        </Link>
      ),
    },
  ]

  const table = (
    <DataTable
      caption={t('studio.research.slHeading')}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      empty={{
        reason: 'empty',
        heading: t('studio.research.slEmpty'),
        body: t('studio.research.slEmptyBody'),
      }}
    />
  )

  const operations = operationsFor('research_product').map((operation) => ({
    kind: operation.kind,
    isDestructive: typeof operation.isDestructive === 'function' ? true : operation.isDestructive,
    available: operation.available !== false,
  }))

  return (
    <StudioPage path={BASE_PATH}>
      <Stack gap={6}>
        <Text size="sm" tone="secondary" data-shortlist-intro="">
          {t('studio.research.slIntro')}
        </Text>

        <Surface level={1} className="p-6" data-shortlist-stale={String(stale)}>
          <Stack gap={1}>
            <PageHeader level={2} title={t('studio.research.slStaleHeading')} />
            <Text size="sm">{String(stale)}</Text>
            <Text size="xs" tone="secondary">
              {t('studio.research.slStaleBody')}
            </Text>
          </Stack>
        </Surface>

        <form method="get">
          <Cluster gap={3} align="end">
            <label className="flex min-w-40 flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.filterSource')}
              </Text>
              <Select name="source" defaultValue={sourceParam}>
                <option value="">{t('studio.research.filterAll')}</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-40 flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.slFilterAge')}
              </Text>
              <Input
                name="age"
                type="number"
                min={0}
                defaultValue={minAgeDays === 0 ? '' : String(minAgeDays)}
              />
            </label>
            <Button type="submit" variant="secondary">
              {t('studio.research.apply')}
            </Button>
          </Cluster>
        </form>

        {openRow === null ? null : (
          <Stack gap={4}>
            <RowActionBar
              productId={openRow.research_product_id}
              label={openRow.title_normalized ?? openRow.research_product_id}
              canConfirm={canConfirm}
              actions={{
                shortlist: shortlistAction,
                reject: rejectAction,
                confirm: confirmAction,
              }}
            />
            {canConfirm ? (
              <Surface level={2} className="p-6" data-send-back={openRow.research_product_id}>
                <ActionForm action={returnToReviewAction}>
                  <input type="hidden" name="product_id" value={openRow.research_product_id} />
                  <Stack gap={2}>
                    <label className="flex max-w-md flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.slSendBackReason')}
                      </Text>
                      <textarea
                        name="reason"
                        rows={2}
                        className="border-line bg-surface border px-3 py-2 text-sm"
                        data-send-back-reason=""
                      />
                    </label>
                    <div>
                      <Button type="submit" variant="quiet" size="sm" data-send-back-submit="">
                        {t('studio.research.slSendBack')}
                      </Button>
                    </div>
                  </Stack>
                </ActionForm>
              </Surface>
            ) : null}
          </Stack>
        )}

        {canBulk ? (
          <PipelineBulkBar
            surface={BASE_PATH}
            filters={filtersQuery}
            operations={operations}
            kinds={[
              'research.confirm',
              'research.close_entry',
              'research.reject',
              'research.set_tags',
            ]}
            tags={tags.map((tag) => ({ id: tag.id, name: tag.label }))}
            canDestroy={canDestroy}
            previewAction={previewResearchBulkAction}
          >
            {table}
          </PipelineBulkBar>
        ) : (
          <Stack gap={2}>
            {table}
            <Text size="xs" tone="secondary">
              {t('studio.research.bulkNeedsPermission')}
            </Text>
          </Stack>
        )}
      </Stack>
    </StudioPage>
  )
}
