import { notFound } from 'next/navigation'

import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { getBulkOperation, listBulkItems } from '@/lib/supabase/repositories/bulk'
import { createClient } from '@/lib/supabase/server'

import { UndoPanel } from './undo-panel'

/**
 * /studio/operations/audit/[operationId] — the per-item before/after viewer.
 *
 * THIS PAGE IS WHY THE AUDIT LOG STAYS READABLE. A 500-row archive writes ONE `audit_logs` row
 * carrying counts and params, and the detail lives in `bulk_operation_items` — reachable from here
 * by following the operation id. Nothing is lost and the security log does not become five hundred
 * lines about one afternoon.
 *
 * IT GATES ON `bulk.execute`, which is also what `bulk_operation_items`' RLS requires, so a role
 * that can reach this page can read the rows underneath and one that cannot gets nothing from
 * either layer.
 *
 * THE BEFORE/AFTER IS RENDERED AS JSON, deliberately, and not as a diff. A diff needs to know
 * which columns matter, and this table holds snapshots from eleven different operations across
 * three entity types — a generic diff would be a worse version of reading the object, and a
 * per-operation one would be eleven renderers for a page somebody opens twice a year.
 */
export const metadata = studioMetadata('/studio/operations/audit')

export default async function Page({ params }: { params: Promise<{ operationId: string }> }) {
  await requirePermission('bulk.execute')
  const { operationId } = await params

  const client = await createClient()
  const operation = await getBulkOperation(client, operationId)
  if (operation === null) notFound()

  const items = await listBulkItems(client, operationId)
  const counts = (operation.counts ?? {}) as Record<string, number>

  const undoable =
    operation.undone_at === null &&
    operation.undo_deadline_at !== null &&
    new Date(operation.undo_deadline_at) > new Date() &&
    (operation.status === 'SUCCEEDED' || operation.status === 'PARTIAL')

  return (
    <StudioPage path="/studio/operations/audit">
      <Stack gap={8}>
        <Surface level={1} className="p-6">
          <PageHeader level={2} title={operation.kind} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge tone={operation.status === 'SUCCEEDED' ? 'neutral' : 'danger'}>
              {operation.status}
            </Badge>
            {operation.is_destructive ? <Badge tone="danger">destructive</Badge> : null}
            {Object.entries(counts).map(([key, value]) => (
              <Badge key={key} tone="neutral">{`${key}: ${value}`}</Badge>
            ))}
          </div>
          <Text tone="secondary" className="mt-3">
            {operation.requested_at}
          </Text>
          {operation.undo_of_operation_id === null ? null : (
            <Text tone="secondary" className="mt-2">
              {/* An undo is itself an operation, so its row links back to what it reversed. */}
              <a
                href={`/studio/operations/audit/${operation.undo_of_operation_id}`}
                className="underline underline-offset-4"
              >
                {t('studio.bulk.undo')}
              </a>
            </Text>
          )}
        </Surface>

        {undoable ? (
          <UndoPanel operationId={operation.id} deadlineAt={operation.undo_deadline_at} />
        ) : null}

        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.audit.itemsHeading')} />
          <div className="mt-4 max-h-96 overflow-y-auto border border-line">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t('studio.audit.itemsHeading')}</caption>
              <thead className="sticky top-0 bg-surface-raised">
                <tr>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.bulk.columnRow')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.bulk.columnOutcome')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.bulk.columnReason')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    Before → After
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-line"
                    data-audit-item={item.entity_id}
                  >
                    <td className="p-2 font-mono text-xs">{item.entity_id}</td>
                    <td className="p-2">
                      <Badge
                        tone={
                          item.result === 'APPLIED' || item.result === 'UNDONE'
                            ? 'neutral'
                            : 'danger'
                        }
                      >
                        {item.result}
                      </Badge>
                    </td>
                    <td className="p-2 text-ink-secondary">{item.reason ?? item.error ?? ''}</td>
                    <td className="p-2">
                      <pre className="max-w-md overflow-x-auto whitespace-pre-wrap font-mono text-xs text-ink-secondary">
                        {JSON.stringify(item.before)} → {JSON.stringify(item.after)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      </Stack>
    </StudioPage>
  )
}
