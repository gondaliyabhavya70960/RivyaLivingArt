import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { MetricModule } from '@/lib/analytics/metrics'
import type { AnalyticsSnapshotRow } from '@/lib/supabase/schemas/analytics'

/**
 * The UNAVAILABLE tile — Phase 37. Renders the named reason, never a zero, a dash or a placeholder,
 * and says in a fixed sentence that the reason is a work item. The reason text is the row's own
 * (`unavailable_reason`, CHECKed non-null), composed by the metric or the availability resolver.
 */
export function MetricUnavailable({
  metric,
  row,
}: {
  readonly metric: MetricModule
  readonly row: AnalyticsSnapshotRow
}) {
  return (
    <Surface
      level={1}
      className="h-full p-4"
      data-metric-tile={metric.id}
      data-metric-availability="UNAVAILABLE"
    >
      <Stack gap={2}>
        <div className="flex items-start justify-between gap-2">
          <Text size="2xs" uppercase tone="tertiary">
            {t(metric.labelKey)}
          </Text>
          <Badge tone="warning">{t('studio.analytics.unavailable')}</Badge>
        </div>
        <Text size="xs" tone="secondary">
          {t('studio.analytics.unavailableLead')}
        </Text>
        <Text size="sm" data-metric-reason={metric.id}>
          {row.unavailable_reason ?? ''}
        </Text>
        <Text size="xs" tone="tertiary">
          {t('studio.analytics.workItem')}
        </Text>
        <details className="text-xs">
          <summary className="text-ink-secondary cursor-pointer">
            {t('studio.analytics.definition')}
          </summary>
          <Text size="xs" tone="secondary" className="mt-1" data-metric-definition={metric.id}>
            {metric.definition}
          </Text>
        </details>
      </Stack>
    </Surface>
  )
}
