import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { operationsFor, loadBulkOperations } from '@/lib/bulk/registry'
import { readBulkPreview } from '@/lib/bulk/run'
import { MAX_SELECTION } from '@/lib/bulk/types'
import { listBulkOperations } from '@/lib/supabase/repositories/bulk'
import { listProductsForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { createClient } from '@/lib/supabase/server'

import { BulkPreviewPanel } from './preview'
import { BulkWorkspace } from './workspace'

/**
 * /studio/catalog/bulk — the product bulk surface.
 *
 * IT GATES ON `bulk.execute` AND SHOWS WHAT THE ROLE MAY DO, NOT EVERYTHING. A merchandiser holds
 * `bulk.execute` and not `destructive.execute`, so archive and unpublish are rendered as
 * unavailable rather than hidden: a control that is simply absent teaches an operator that the
 * feature does not exist, and one that is present and explains itself teaches them who to ask.
 * The engine refuses either way — the interface is the courtesy, `run.ts` is the gate.
 *
 * THE PRODUCT LIST IS THE WHOLE CATALOGUE, unpaginated, and that is correct at this size: there is
 * no product in the database yet and the phase's cap is five hundred. When the catalogue outgrows
 * one page this becomes the Phase 14 filtered list with "select all matching filter", which is
 * what the phase document describes and what `MAX_SELECTION` exists to bound.
 */
export const metadata = studioMetadata('/studio/catalog/bulk')

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('bulk.execute')
  await loadBulkOperations()

  const params = await searchParams
  const rawOperation = params['operation']
  const operationId = (Array.isArray(rawOperation) ? rawOperation[0] : rawOperation) ?? null

  const client = await createClient()
  const [products, recent] = await Promise.all([
    listProductsForStudio(client),
    listBulkOperations(client, 10),
  ])

  const canDestroy = roleHasPermission(session.role, 'destructive.execute')

  const operations = operationsFor('product').map((operation) => ({
    kind: operation.kind,
    isDestructive: typeof operation.isDestructive === 'function' ? true : operation.isDestructive,
    available: operation.available !== false,
  }))

  /*
   * A PREVIEW REPLACES THE SELECTION SURFACE RATHER THAN SITTING BESIDE IT. The operator has
   * finished selecting; what they need now is to read. Recomputed on every render, so a preview
   * left open for ten minutes reports the catalogue as it is rather than as it was.
   */
  const preview =
    operationId === null
      ? null
      : await readBulkPreview(operationId, { userId: session.userId, role: session.role })

  if (preview !== null) {
    return (
      <StudioPage path="/studio/catalog/bulk">
        <BulkPreviewPanel
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
        />
      </StudioPage>
    )
  }

  return (
    <StudioPage path="/studio/catalog/bulk">
      <Stack gap={8}>
        {products.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.bulk.noSelection')}
            body={t('studio.bulk.noSelectionBody')}
          />
        ) : (
          <BulkWorkspace
            products={products.map((product) => ({
              id: product.id,
              label: product.title ?? product.slug,
              status: product.status,
            }))}
            operations={operations}
            canDestroy={canDestroy}
            maxSelection={MAX_SELECTION}
            activeOperationId={null}
          />
        )}

        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.audit.itemsHeading')} />
          {recent.length === 0 ? (
            <Text tone="secondary" className="mt-3">
              {t('studio.bulk.noSelectionBody')}
            </Text>
          ) : (
            <ul className="mt-4 list-none" data-recent-operations>
              {recent.map((row) => (
                <li key={row.id} className="border-b border-line py-2 text-sm">
                  <a
                    href={`/studio/operations/audit/${row.id}`}
                    className="underline underline-offset-4"
                  >
                    {row.kind}
                  </a>
                  <span className="ml-3 text-ink-secondary">{row.status}</span>
                  <span className="ml-3 text-ink-secondary">{row.requested_at}</span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </Stack>
    </StudioPage>
  )
}
