import { Badge } from '@/components/primitives/Badge'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { t } from '@/components/studio/strings'
import type { SyncRunRow } from '@/lib/supabase/schemas/sheets'

/**
 * RC-337 `SheetsRunHistory` — status, rows, cells, duration, attempts and the sanitised error code
 * of each run. What it never shows is what the upstream said: a run row carries a code from a
 * fixed vocabulary and nothing else, so there is nothing to leak here.
 *
 * `flagged` marks the runs whose row count moved more than half against the previous successful
 * run — the phase document's warning badge for a filter that silently changed.
 */

const TONE: Readonly<Record<SyncRunRow['status'], 'info' | 'neutral' | 'warning'>> = {
  RUNNING: 'info',
  SUCCEEDED: 'info',
  FAILED: 'warning',
  SKIPPED: 'neutral',
}

export function SheetsRunHistory({
  runs,
  definitionNames,
  flagged,
}: {
  readonly runs: readonly SyncRunRow[]
  readonly definitionNames: ReadonlyMap<string, string>
  readonly flagged: ReadonlySet<string>
}) {
  const columns: readonly Column<SyncRunRow>[] = [
    {
      id: 'definition',
      header: t('studio.sheets.colName'),
      cell: (row) => (
        <Text size="sm">{definitionNames.get(row.definition_id) ?? row.definition_id}</Text>
      ),
    },
    {
      id: 'started',
      header: t('studio.sheets.histStarted'),
      cell: (row) => <RelativeTime value={row.started_at} />,
    },
    {
      id: 'trigger',
      header: t('studio.sheets.histTrigger'),
      cell: (row) => <Text size="sm">{row.trigger}</Text>,
    },
    {
      id: 'status',
      header: t('studio.sheets.histStatus'),
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={TONE[row.status]}>{row.status}</Badge>
          {flagged.has(row.id) ? (
            <Badge tone="warning" data-row-count-warning={row.id}>
              {t('studio.sheets.rowCountWarning')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'rows',
      header: t('studio.sheets.histRows'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.row_count)}</Text>,
    },
    {
      id: 'cells',
      header: t('studio.sheets.histCells'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.cell_count)}</Text>,
    },
    {
      id: 'attempts',
      header: t('studio.sheets.histAttempts'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.attempts)}</Text>,
    },
    {
      id: 'error',
      header: t('studio.sheets.histError'),
      cell: (row) => (
        <Text size="sm" tone="secondary" data-run-error-code={row.error_code ?? ''}>
          {row.error_code ?? '—'}
        </Text>
      ),
    },
    {
      id: 'duration',
      header: t('studio.sheets.histDuration'),
      numeric: true,
      cell: (row) => (
        <Text size="sm">{row.duration_ms === null ? '—' : `${String(row.duration_ms)} ms`}</Text>
      ),
    },
  ]

  return (
    <DataTable
      caption={t('studio.sheets.historyHeading')}
      columns={columns}
      rows={runs}
      rowKey={(row) => row.id}
      empty={{ reason: 'empty', heading: t('studio.sheets.historyEmpty'), body: '' }}
    />
  )
}
