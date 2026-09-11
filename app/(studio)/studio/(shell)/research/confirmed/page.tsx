import type { Route } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
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
import { StartProductDialog } from '@/components/studio/research/StartProductDialog'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { loadBulkOperations, operationsFor } from '@/lib/bulk/registry'
import { readBulkPreview } from '@/lib/bulk/run'
import { isEnabled } from '@/lib/flags'
import { listCategoriesForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { listTags } from '@/lib/supabase/repositories/research/review'
import {
  listConfirmations,
  resolveStartedProducts,
  type ConfirmedRow,
} from '@/lib/supabase/repositories/research/shortlist'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

import { archiveDecisionAction, shortlistAction } from '../changes/actions'
import { applyResearchBulkAction, previewResearchBulkAction } from '../bulk-actions'
import { startProductFromConfirmation } from './actions'

/**
 * /studio/research/confirmed — research decisions, and the one bridge.
 *
 * EVERY ROW IS LABELLED A RESEARCH DECISION, because the failure this screen must not cause is
 * a reader taking a list of "confirmed" competitor rows for a catalogue somebody approved. What
 * is listed is the decision note, who made it, the brief it cites, whether a person has started
 * a Rivya product from it — a LINK to that product, resolved by the research repository with a
 * second query and never a join — and the archive action.
 *
 * THE BRIDGE DIALOG IS THE ONLY PLACE IN THE STUDIO WHERE A RESEARCH SCREEN CAN CREATE A
 * CATALOGUE ROW. It starts an EMPTY draft — slug and category chosen by the person, a placeholder
 * title, price on request, nothing else — behind `catalog.write`, the seeded acknowledgement, and
 * the `research_product_bridge` flag, which ships off. Off, the button is disabled with the reason.
 */
export const metadata = studioMetadata('/studio/research/confirmed')

const BASE_PATH = '/studio/research/confirmed'
const PRODUCT_PATH = '/studio/catalog/products'

const one = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? ''

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('research.read')
  const params = await searchParams
  const client = await createClient()

  const includeArchived = one(params.archived) === 'true'
  const sourceParam = one(params.source)

  await loadBulkOperations()

  const [confirmations, sources, tags, categories, bridgeOn] = await Promise.all([
    listConfirmations(client, { includeArchived }),
    listResearchSources(client),
    listTags(client),
    listCategoriesForStudio(client),
    isEnabled('research_product_bridge'),
  ])

  const rows = confirmations.filter(
    (row) => !UUID.test(sourceParam) || row.source_id === sourceParam,
  )
  const started = await resolveStartedProducts(
    client,
    rows.map((row) => row.created_product_id ?? ''),
  )
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))

  const canConfirm = roleHasPermission(session.role, 'research.confirm')
  const canWriteCatalog = roleHasPermission(session.role, 'catalog.write')
  const canDestroy = roleHasPermission(session.role, 'destructive.execute')
  const canBulk = roleHasPermission(session.role, 'bulk.execute') && canConfirm

  const currentFilters: Record<string, string> = {
    ...(UUID.test(sourceParam) ? { source: sourceParam } : {}),
    ...(includeArchived ? { archived: 'true' } : {}),
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
  const openRow = UUID.test(rowParam) ? (rows.find((row) => row.id === rowParam) ?? null) : null

  /** Why the bridge cannot run for this decision, or null when it can. */
  const bridgeDisabledReason = (row: ConfirmedRow): string | null => {
    if (!bridgeOn) return t('studio.research.bridgeFlagOff')
    if (!canWriteCatalog) return t('studio.research.bridgeNeedsPermission')
    if (row.archived_at !== null || row.stage !== 'CONFIRMED') {
      return t('studio.research.bridgeNotAvailable')
    }
    if (row.created_product_id !== null) return t('studio.research.bridgeAlreadyStarted')
    return null
  }

  const columns: readonly Column<ConfirmedRow>[] = [
    ...(canBulk
      ? [
          {
            id: 'select',
            header: t('studio.research.selectRow'),
            cell: (row: ConfirmedRow) => (
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
      header: t('studio.research.cfColRow'),
      cell: (row) => (
        <Stack gap={1}>
          <Cluster gap={2}>
            <Badge tone="neutral">{t('studio.research.cfDecisionLabel')}</Badge>
            {row.archived_at === null ? (
              <Badge tone="info">{t('studio.research.cfLive')}</Badge>
            ) : (
              <Badge tone="warning">{t('studio.research.cfArchived')}</Badge>
            )}
          </Cluster>
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
      id: 'note',
      header: t('studio.research.cfColNote'),
      cell: (row) => (
        <Text size="sm" className="break-words" data-decision-note-text={row.id}>
          {row.decision_note}
        </Text>
      ),
    },
    {
      id: 'by',
      header: t('studio.research.cfColConfirmedBy'),
      cell: (row) => (
        <Stack gap={0}>
          <RelativeTime value={row.confirmed_at} />
          <Text size="xs" tone="secondary">
            {row.confirmed_by}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'brief',
      header: t('studio.research.cfColBrief'),
      cell: (row) =>
        row.brief_id === null ? (
          <Text size="xs" tone="secondary">
            {t('studio.research.cfNoBrief')}
          </Text>
        ) : (
          <Link
            href={`/studio/research/opportunities/direction/${row.brief_id}` as Route}
            className="text-sm underline underline-offset-4"
          >
            {row.brief_id.slice(0, 8)}
          </Link>
        ),
    },
    {
      id: 'product',
      header: t('studio.research.cfColProduct'),
      cell: (row) => {
        if (row.created_product_id === null) {
          return (
            <Text size="xs" tone="secondary" data-product-state="none">
              {t('studio.research.cfProductNone')}
            </Text>
          )
        }
        const product = started.get(row.created_product_id)
        if (product === undefined) {
          return (
            <Text size="xs" tone="secondary" data-product-state="missing">
              {t('studio.research.cfProductMissing')}
            </Text>
          )
        }
        // A LINK, NOT A JOIN. The id was resolved by the research repository with a second query.
        return (
          <Link
            href={`${PRODUCT_PATH}/${product.id}` as Route}
            className="text-sm underline underline-offset-4"
            data-product-state="started"
            data-started-product={product.id}
          >
            {product.title ?? product.slug} · {product.status}
          </Link>
        )
      },
    },
    {
      id: 'open',
      header: t('studio.research.openRow'),
      cell: (row) => (
        <Link
          href={withFilters({ row: row.id }) as Route}
          className="text-sm underline underline-offset-4"
          data-open-row={row.id}
        >
          {t('studio.research.openRow')}
        </Link>
      ),
    },
  ]

  const table = (
    <DataTable
      caption={t('studio.research.cfHeading')}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      empty={{
        reason: 'empty',
        heading: t('studio.research.cfEmpty'),
        body: t('studio.research.cfEmptyBody'),
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
        <Text size="sm" tone="secondary" data-confirmed-intro="">
          {t('studio.research.cfIntro')}
        </Text>

        <form method="get">
          <Cluster gap={3} align="end">
            <label className="flex min-w-40 flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.filterSource')}
              </Text>
              <select
                name="source"
                defaultValue={sourceParam}
                className="border-line bg-surface border px-3 py-2 text-sm"
              >
                <option value="">{t('studio.research.filterAll')}</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="archived"
                value="true"
                defaultChecked={includeArchived}
              />
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.cfIncludeArchived')}
              </Text>
            </label>
            <Button type="submit" variant="secondary">
              {t('studio.research.apply')}
            </Button>
          </Cluster>
        </form>

        {openRow === null ? null : (
          <Surface level={2} className="p-6" data-decision-actions={openRow.id}>
            <Stack gap={4}>
              <PageHeader level={2} title={t('studio.research.cfDecisionLabel')} />
              <Text size="sm" className="break-words">
                {openRow.title_normalized ?? openRow.research_product_id}
              </Text>

              <StartProductDialog
                confirmationId={openRow.id}
                categories={categories.map((category) => ({
                  id: category.id,
                  name: category.name,
                }))}
                disabledReason={bridgeDisabledReason(openRow)}
                action={startProductFromConfirmation}
                productHref={(productId) => `${PRODUCT_PATH}/${productId}`}
                labels={{
                  button: t('studio.research.bridgeButton'),
                  title: t('studio.research.bridgeTitle'),
                  intro: t('studio.research.bridgeIntro'),
                  slug: t('studio.research.bridgeSlug'),
                  slugHelp: t('studio.research.bridgeSlugHelp'),
                  category: t('studio.research.bridgeCategory'),
                  acknowledge: t('studio.research.bridgeAcknowledge'),
                  submit: t('studio.research.bridgeSubmit'),
                  cancel: t('studio.research.bridgeCancel'),
                  close: t('studio.research.bridgeClose'),
                  started: t('studio.research.bridgeStarted'),
                  openProduct: t('studio.research.cfProductOpen'),
                }}
              />

              {canConfirm && openRow.archived_at === null ? (
                <Cluster gap={6} align="start">
                  <ActionForm action={archiveDecisionAction}>
                    <input type="hidden" name="product_id" value={openRow.research_product_id} />
                    <Stack gap={2}>
                      <label className="flex max-w-md flex-col gap-1">
                        <Text size="xs" tone="secondary" as="span">
                          {t('studio.research.cfArchiveReason')}
                        </Text>
                        <textarea
                          name="reason"
                          rows={2}
                          className="border-line bg-surface border px-3 py-2 text-sm"
                          data-archive-reason=""
                        />
                      </label>
                      <div>
                        <Button type="submit" variant="quiet" size="sm" data-archive-submit="">
                          {t('studio.research.cfArchive')}
                        </Button>
                      </div>
                    </Stack>
                  </ActionForm>

                  <ActionForm action={shortlistAction}>
                    <input type="hidden" name="product_id" value={openRow.research_product_id} />
                    <Stack gap={2}>
                      <label className="flex max-w-md flex-col gap-1">
                        <Text size="xs" tone="secondary" as="span">
                          {t('studio.research.cfReopenReason')}
                        </Text>
                        <textarea
                          name="reason"
                          rows={2}
                          className="border-line bg-surface border px-3 py-2 text-sm"
                          data-reopen-reason=""
                        />
                      </label>
                      <div>
                        <Button type="submit" variant="quiet" size="sm" data-reopen-submit="">
                          {t('studio.research.cfReopen')}
                        </Button>
                      </div>
                    </Stack>
                  </ActionForm>
                </Cluster>
              ) : null}
            </Stack>
          </Surface>
        )}

        {canBulk ? (
          <PipelineBulkBar
            surface={BASE_PATH}
            filters={filtersQuery}
            operations={operations}
            kinds={['research.archive_confirmation', 'research.reject', 'research.set_tags']}
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
