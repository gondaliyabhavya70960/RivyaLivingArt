import { BarSeries } from '@/components/patterns/BarSeries'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { CoverageBadge } from '@/components/studio/research/CoverageBadge'
import { t } from '@/components/studio/strings'
import type { MetricModule } from '@/lib/analytics/metrics'
import type { CoverageRecord } from '@/lib/scraper/analytics/coverage'
import type { AnalyticsSnapshotRow, MetricValue } from '@/lib/supabase/schemas/analytics'

import { MetricTrend } from './MetricTrend'

/**
 * One AVAILABLE tile — Phase 37: label, figure with its unit, `CoverageBadge` (n, denominator,
 * as-of), the breakdown, a bar chart with its data table where the metric carries a series, the
 * trend where two snapshots exist, and the definition in a disclosure. Every number on it is read
 * from the snapshot row; nothing is computed here.
 */

const MAX_BARS = 12

export function formatFigure(value: MetricValue): string {
  const figure = value.figure
  if (figure === null) return ''
  switch (value.unit) {
    case 'percent':
      return `${figure.toLocaleString('en-IN')}${t('studio.analytics.unitPercent')}`
    case 'mm':
      return `${figure.toLocaleString('en-IN')} ${t('studio.analytics.unitMm')}`
    case 'days':
      return `${figure.toLocaleString('en-IN')} ${t('studio.analytics.unitDays')}`
    case 'score':
      return `${figure.toLocaleString('en-IN')} ${t('studio.analytics.unitScore')}`
    case 'minor': {
      const currency = value.currency ?? null
      if (currency === null)
        return `${figure.toLocaleString('en-IN')} ${t('studio.analytics.unitMinor')}`
      try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(figure / 100)
      } catch {
        return `${(figure / 100).toLocaleString('en-IN')} ${currency}`
      }
    }
    default:
      return figure.toLocaleString('en-IN')
  }
}

function coverageOf(row: AnalyticsSnapshotRow): CoverageRecord {
  const n = row.n ?? 0
  const denominator = row.denominator ?? 0
  return {
    metricKey: row.metric_id,
    n,
    denominator,
    coveragePct: denominator === 0 ? 0 : Math.round((n / denominator) * 100),
    excludedReasons: {},
    asOf: row.computed_at,
  }
}

export function MetricTile({
  metric,
  row,
  history,
  showTrend,
}: {
  readonly metric: MetricModule
  readonly row: AnalyticsSnapshotRow
  readonly history: readonly AnalyticsSnapshotRow[]
  readonly showTrend: boolean
}) {
  const value = row.value
  const series = (value.series ?? []).slice(0, MAX_BARS)
  const groups = value.groups ?? []
  const notes = value.notes ?? []
  return (
    <Surface
      level={1}
      className="h-full p-4"
      data-metric-tile={metric.id}
      data-metric-availability="AVAILABLE"
    >
      <Stack gap={2}>
        <Text size="2xs" uppercase tone="tertiary">
          {t(metric.labelKey)}
        </Text>
        <Heading level={3} size="display-sm" data-metric-figure={metric.id}>
          {formatFigure(value)}
        </Heading>
        <CoverageBadge coverage={coverageOf(row)} />
        {groups.length === 0 ? null : (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" data-metric-groups={metric.id}>
            {groups.map((group) => (
              <div key={group.label} className="contents">
                <dt className="text-ink-secondary">{group.label}</dt>
                <dd className="m-0">{group.value.toLocaleString('en-IN')}</dd>
              </div>
            ))}
          </dl>
        )}
        {series.length === 0 ? null : (
          <BarSeries
            label={t(metric.labelKey)}
            tableCaption={t('studio.analytics.seriesCaption')}
            columns={[t('studio.analytics.seriesLabel'), t('studio.analytics.seriesValue')]}
            data={series}
            testId={`series-${metric.id}`}
          />
        )}
        {notes.length === 0 ? null : (
          <ul className="m-0 list-none p-0" data-metric-notes={metric.id}>
            {notes.map((note) => (
              <li key={note}>
                <Text size="xs" tone="secondary">
                  {note}
                </Text>
              </li>
            ))}
          </ul>
        )}
        {showTrend ? <MetricTrend metricId={metric.id} rows={history} /> : null}
        <details className="text-xs">
          <summary className="text-ink-secondary cursor-pointer">
            {t('studio.analytics.definition')}
          </summary>
          <Text size="xs" tone="secondary" className="mt-1" data-metric-definition={metric.id}>
            {metric.definition}
          </Text>
          <Text size="xs" tone="tertiary" className="mt-1">
            {`${t('studio.analytics.coverageRule')}: ${metric.coverage}`}
          </Text>
        </details>
      </Stack>
    </Surface>
  )
}
