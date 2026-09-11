import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { PageHeader } from '@/components/studio/PageHeader'
import { HealthPill } from '@/components/studio/research/HealthPill'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { t } from '@/components/studio/strings'
import type { SourceHealth } from '@/lib/supabase/repositories/research/source-health'

/**
 * RC-324 `SourceCoveragePanel` — per source: captured, priced, parsed, and the health the run
 * history reports. Mounted on `/studio/research/dashboard`.
 *
 * HEALTH IS READ FROM PHASE 26'S VIEW, NOT RECOMPUTED HERE. Two definitions of "healthy" on one
 * dashboard would disagree within a phase; this panel renames columns and draws them.
 */
export interface SourceCoverageEntry {
  readonly sourceId: string
  readonly name: string
  readonly captured: number
  readonly priced: number
  readonly parsed: number
  readonly health: SourceHealth | null
}

export function SourceCoveragePanel({
  entries,
}: {
  readonly entries: readonly SourceCoverageEntry[]
}) {
  const pct = (part: number, whole: number): string =>
    whole === 0 ? '0%' : `${String(Math.round((part / whole) * 100))}%`
  const columns: readonly Column<SourceCoverageEntry>[] = [
    {
      id: 'source',
      header: t('studio.research.filterSource'),
      cell: (row) => <Text size="sm">{row.name}</Text>,
    },
    {
      id: 'captured',
      header: t('studio.research.sourceCoverageCaptured'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.captured)}</Text>,
    },
    {
      id: 'priced',
      header: t('studio.research.sourceCoveragePriced'),
      numeric: true,
      cell: (row) => (
        <Text size="sm">{`${String(row.priced)} (${pct(row.priced, row.captured)})`}</Text>
      ),
    },
    {
      id: 'parsed',
      header: t('studio.research.sourceCoverageParsed'),
      numeric: true,
      cell: (row) => (
        <Text size="sm">{`${String(row.parsed)} (${pct(row.parsed, row.captured)})`}</Text>
      ),
    },
    {
      id: 'lastRun',
      header: t('studio.research.sourceCoverageLastRun'),
      cell: (row) =>
        row.health?.lastRunAt ? (
          <Text size="sm" tone="secondary">
            <RelativeTime value={row.health.lastRunAt} />
            {row.health.lastRunStatus === null ? '' : ` · ${row.health.lastRunStatus}`}
          </Text>
        ) : (
          <Text size="sm" tone="secondary">
            —
          </Text>
        ),
    },
    {
      id: 'success',
      header: t('studio.research.sourceCoverageSuccess'),
      numeric: true,
      cell: (row) => (
        <Text size="sm">
          {row.health?.successRate7d === null || row.health?.successRate7d === undefined
            ? '—'
            : `${String(Math.round(row.health.successRate7d * 100))}%`}
        </Text>
      ),
    },
    {
      id: 'health',
      header: t('studio.research.healthHeading'),
      cell: (row) =>
        row.health === null ? (
          <Badge tone="neutral">—</Badge>
        ) : (
          <HealthPill health={row.health.health} />
        ),
    },
  ]
  return (
    <Surface level={1} className="p-6" data-source-coverage-panel="">
      <Stack gap={4}>
        <PageHeader
          level={2}
          title={t('studio.research.sourceCoverageHeading')}
          description={t('studio.research.sourceCoverageBody')}
        />
        <DataTable
          caption={t('studio.research.sourceCoverageHeading')}
          columns={columns}
          rows={entries}
          rowKey={(row) => row.sourceId}
          empty={{
            reason: 'empty',
            heading: t('studio.research.sourceCoverageEmpty'),
            body: t('studio.research.noSourcesBody'),
          }}
        />
      </Stack>
    </Surface>
  )
}
