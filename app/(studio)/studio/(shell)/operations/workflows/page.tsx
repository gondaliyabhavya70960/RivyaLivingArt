import Link from 'next/link'
import type { Route } from 'next'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listWorkflowRuns } from '@/lib/supabase/repositories/system-logs'
import type { WorkflowRunRow } from '@/lib/supabase/schemas/system-logs'
import { createClient } from '@/lib/supabase/server'

/**
 * `/studio/operations/workflows` — Phase 38. Every long-running job in one list, read from
 * `workflow_runs_v` (five run tables, no sixth). Each row links to its log lines by
 * `workflow_run_id`. The view is security-invoker, so each table's own policy decides what a
 * reader sees; the page requires `operations.logs.read`.
 */
export const metadata = studioMetadata('/studio/operations/workflows')
export const dynamic = 'force-dynamic'

const COLUMNS: readonly Column<WorkflowRunRow>[] = [
  {
    id: 'kind',
    header: t('studio.workflows.colKind'),
    cell: (row) => (
      <Text as="span" size="sm" data-workflow-kind={row.kind}>
        {row.kind}
      </Text>
    ),
  },
  {
    id: 'scope',
    header: t('studio.workflows.colScope'),
    cell: (row) => (
      <Text as="span" size="xs" tone="secondary" className="break-all">
        {row.scope ?? ''}
      </Text>
    ),
  },
  {
    id: 'status',
    header: t('studio.workflows.colStatus'),
    cell: (row) => (
      <Text as="span" size="xs">
        {row.status ?? ''}
      </Text>
    ),
  },
  {
    id: 'started',
    header: t('studio.workflows.colStarted'),
    cell: (row) => (
      <Text as="span" size="xs" tone="secondary">
        {(row.started_at ?? '').replace('T', ' ').slice(0, 19)}
      </Text>
    ),
  },
  {
    id: 'finished',
    header: t('studio.workflows.colFinished'),
    cell: (row) => (
      <Text as="span" size="xs" tone="secondary">
        {(row.finished_at ?? '').replace('T', ' ').slice(0, 19)}
      </Text>
    ),
  },
  {
    id: 'logs',
    header: t('studio.workflows.colLogs'),
    cell: (row) => (
      <Link
        href={`/studio/operations/logs?run=${row.id}` as Route}
        className="underline underline-offset-4"
      >
        <Text as="span" size="xs">
          {t('studio.workflows.viewLogs')}
        </Text>
      </Link>
    ),
  },
]

export default async function Page() {
  await requirePermission('operations.logs.read')
  const rows = await listWorkflowRuns(await createClient(), 100)
  return (
    <StudioPage path="/studio/operations/workflows">
      <Stack gap={4}>
        <Text size="sm" tone="secondary">
          {t('studio.workflows.intro')}
        </Text>
        <DataTable
          caption={t('studio.workflows.tableCaption')}
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => `${row.kind}:${row.id}`}
          empty={{
            reason: 'empty',
            heading: t('studio.workflows.emptyHeading'),
            body: t('studio.workflows.emptyBody'),
          }}
        />
      </Stack>
    </StudioPage>
  )
}
