import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { t } from '@/components/studio/strings'
import { METRICS, type MetricModule } from '@/lib/analytics/metrics'
import { roleHasPermission, type Role } from '@/lib/auth/permissions'
import { isEnabled } from '@/lib/flags'
import {
  listAnalyticsSeries,
  listLatestAnalyticsSnapshots,
} from '@/lib/supabase/repositories/analytics'
import type { AnalyticsSnapshotRow } from '@/lib/supabase/schemas/analytics'
import { createClient } from '@/lib/supabase/server'

import { MetricTile } from './MetricTile'
import { MetricUnavailable } from './MetricUnavailable'

/**
 * The Analytics tab — Phase 37, filling what Phase 05 stubbed.
 *
 * READS SNAPSHOTS, COMPUTES NOTHING. Two sections: "This studio" (metrics 1–8, every role) and
 * "The market" (metrics 9–18), rendered only for a role holding `research.read` AND while
 * `advanced_analytics` is on — and even then only from the rows RLS returned, so an editor's
 * request never carries a competitive row to be hidden. A metric with no snapshot row is absent
 * rather than shown as zero; a row that is UNAVAILABLE renders its reason.
 *
 * The one sentence the phase document insists on sits at the top of the first section: traffic
 * analytics are not connected.
 */

const TREND_DAYS = 30

interface Loaded {
  readonly failed: boolean
  readonly latest: readonly AnalyticsSnapshotRow[]
  readonly history: ReadonlyMap<string, readonly AnalyticsSnapshotRow[]>
}

async function load(): Promise<Loaded> {
  try {
    const client = await createClient()
    const [latest, series] = await Promise.all([
      listLatestAnalyticsSnapshots(client),
      listAnalyticsSeries(client, TREND_DAYS),
    ])
    const history = new Map<string, AnalyticsSnapshotRow[]>()
    for (const row of series) {
      const list = history.get(row.metric_id) ?? []
      list.push(row)
      history.set(row.metric_id, list)
    }
    return { failed: false, latest, history }
  } catch {
    return { failed: true, latest: [], history: new Map() }
  }
}

function Section({
  id,
  heading,
  intro,
  note,
  metrics,
  rows,
  history,
  showTrend,
}: {
  readonly id: 'studio' | 'market'
  readonly heading: string
  readonly intro: string
  readonly note: string | null
  readonly metrics: readonly MetricModule[]
  readonly rows: ReadonlyMap<string, AnalyticsSnapshotRow>
  readonly history: ReadonlyMap<string, readonly AnalyticsSnapshotRow[]>
  readonly showTrend: boolean
}) {
  const present = metrics.filter((metric) => rows.has(metric.id))
  if (present.length === 0) return null
  const asOf = present
    .map((metric) => rows.get(metric.id)?.as_of ?? '')
    .reduce((latest, date) => (date > latest ? date : latest), '')
  return (
    <section aria-labelledby={`analytics-${id}`} data-analytics-section={id}>
      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={2} size="display-xs" id={`analytics-${id}`}>
            {heading}
          </Heading>
          <Text size="sm" tone="secondary">
            {intro}
          </Text>
          {note === null ? null : (
            <Text size="sm" data-analytics-traffic-note="">
              {note}
            </Text>
          )}
          <Text size="xs" tone="tertiary">
            {`${t('studio.analytics.asOf')} ${asOf}`}
          </Text>
        </Stack>
        <ul className="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {present.map((metric) => {
            const row = rows.get(metric.id)
            if (row === undefined) return null
            return (
              <li key={metric.id}>
                {row.availability === 'AVAILABLE' ? (
                  <MetricTile
                    metric={metric}
                    row={row}
                    history={history.get(metric.id) ?? []}
                    showTrend={showTrend}
                  />
                ) : (
                  <MetricUnavailable metric={metric} row={row} />
                )}
              </li>
            )
          })}
        </ul>
      </Stack>
    </section>
  )
}

export async function AnalyticsTab({ role }: { readonly role: Role }) {
  const [loaded, advanced] = await Promise.all([load(), isEnabled('advanced_analytics')])

  if (loaded.failed) {
    return (
      <EmptyState
        reason="unreadable"
        heading={t('studio.analytics.unreadableHeading')}
        body={t('studio.analytics.unreadableBody')}
      />
    )
  }
  if (loaded.latest.length === 0) {
    return (
      <EmptyState
        reason="empty"
        heading={t('studio.analytics.noSnapshotHeading')}
        body={t('studio.analytics.noSnapshotBody')}
      />
    )
  }

  const rows = new Map(loaded.latest.map((row) => [row.metric_id, row]))
  const canSeeMarket = roleHasPermission(role, 'research.read')
  const studio = METRICS.filter((metric) => metric.dimension === 'FIRST_PARTY')
  const market = METRICS.filter((metric) => metric.dimension === 'COMPETITIVE')

  return (
    <Stack gap={8} data-analytics-tab="">
      <Section
        id="studio"
        heading={t('studio.analytics.studioSection')}
        intro={t('studio.analytics.studioIntro')}
        note={t('studio.analytics.trafficNote')}
        metrics={studio}
        rows={rows}
        history={loaded.history}
        showTrend={advanced}
      />
      {canSeeMarket && advanced ? (
        <Section
          id="market"
          heading={t('studio.analytics.marketSection')}
          intro={t('studio.analytics.marketIntro')}
          note={null}
          metrics={market}
          rows={rows}
          history={loaded.history}
          showTrend
        />
      ) : null}
      <Text size="xs" tone="tertiary">
        {t('studio.analytics.exportHint')}
      </Text>
    </Stack>
  )
}
