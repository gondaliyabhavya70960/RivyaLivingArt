import { Sparkline } from '@/components/patterns/Sparkline'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { AnalyticsSnapshotRow, ChartDatumRow } from '@/lib/supabase/schemas/analytics'

/**
 * A trend needs two snapshots — Phase 37, and the rule is a function so a test can hold it.
 * Only AVAILABLE rows with a figure count; an UNAVAILABLE day is a gap, not a zero.
 */
export function trendPoints(
  rows: readonly AnalyticsSnapshotRow[],
): readonly ChartDatumRow[] | null {
  const points = rows
    .filter((row) => row.availability === 'AVAILABLE' && row.value.figure !== null)
    .sort((a, b) => a.as_of.localeCompare(b.as_of))
    .map((row) => ({ label: row.as_of, value: row.value.figure ?? 0 }))
  return points.length >= 2 ? points : null
}

export function MetricTrend({
  metricId,
  rows,
}: {
  readonly metricId: string
  readonly rows: readonly AnalyticsSnapshotRow[]
}) {
  const points = trendPoints(rows)
  if (points === null) {
    return (
      <Text size="xs" tone="tertiary" data-metric-trend={metricId} data-metric-trend-points="0">
        {t('studio.analytics.trendSingle')}
      </Text>
    )
  }
  return (
    <div data-metric-trend={metricId} data-metric-trend-points={String(points.length)}>
      <Sparkline
        label={t('studio.analytics.trendLabel')}
        tableCaption={t('studio.analytics.trendCaption')}
        columns={[t('studio.analytics.trendDate'), t('studio.analytics.trendFigure')]}
        data={points}
        testId={`trend-${metricId}`}
      />
    </div>
  )
}
