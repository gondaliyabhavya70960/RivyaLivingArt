import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { t } from '@/components/studio/strings'
import {
  VITALS_SAMPLE_RATE,
  VITALS_WINDOW_DAYS,
  vitalsSummary,
  type VitalsRouteSummary,
} from '@/lib/supabase/repositories/web-vitals'
import { VITALS_METRICS, type VitalsMetric } from '@/lib/supabase/schemas/vitals'
import { createClient } from '@/lib/supabase/server'

/**
 * Field Core Web Vitals, per route pattern — Phase 40.
 *
 * WHAT IT SHOWS AND WHAT IT REFUSES TO IMPLY. The p75 of every sample the browsers of real visitors
 * sent in the last twenty-eight days, per route pattern, per metric. It is a ten per cent sample of
 * production page views and nothing else: not every visitor, not the lab numbers, not an average.
 * The caption says so, unprompted, because a table of numbers with no caption is read as complete
 * data — and FEAT §28's rule for this whole surface is that an unavailable analytic is named rather
 * than manufactured.
 *
 * A ROUTE WITH NO SAMPLES IS ABSENT, NOT ZERO. Zero milliseconds is a measurement; "nobody has
 * loaded this route since the reporter shipped" is not, and the two must not look alike.
 *
 * THE LAB TARGETS ARE NOT REPEATED HERE. They live in `perf/budgets.json` and are rendered in
 * `docs/ops/PERFORMANCE.md`; showing them beside these figures would invite reading one as a pass
 * or fail against the other, and they measure different things — one device in a data centre
 * versus whatever a visitor is holding.
 */

/** The thresholds Google fixes, restated so a figure can be toned without a second round trip. */
const GOOD: Readonly<Record<VitalsMetric, number>> = {
  LCP: 2500,
  CLS: 0.1,
  INP: 200,
  TTFB: 800,
  FCP: 1800,
}

function format(metric: VitalsMetric, value: number): string {
  // CLS is a unitless ratio and the others are milliseconds; a "0.05 ms" would be nonsense and a
  // "1200" with no unit is a number nobody can act on.
  return metric === 'CLS' ? value.toFixed(3) : `${String(Math.round(value))} ms`
}

function tone(metric: VitalsMetric, value: number): 'primary' | 'secondary' {
  // Within Google's "good" band reads as ordinary text; outside it is quieted rather than reddened.
  // A colour alarm here would be a judgement on a sampled figure the team cannot act on directly,
  // and the route table is for noticing a pattern, not for triage.
  return value <= GOOD[metric] ? 'primary' : 'secondary'
}

async function load(): Promise<{ failed: boolean; rows: readonly VitalsRouteSummary[] }> {
  try {
    const client = await createClient()
    return { failed: false, rows: await vitalsSummary(client, { now: new Date() }) }
  } catch {
    // RLS refusing a role without `analytics.read` and the database being unreachable look the same
    // from here, and both mean the same thing to the reader: this panel has nothing to show.
    return { failed: true, rows: [] }
  }
}

export async function VitalsCard(): Promise<React.ReactElement> {
  const { failed, rows } = await load()

  if (failed) {
    return (
      <EmptyState
        reason="unreadable"
        heading={t('studio.analytics.vitals.unreadableHeading')}
        body={t('studio.analytics.vitals.unreadableBody')}
      />
    )
  }

  return (
    <section aria-labelledby="analytics-vitals" data-analytics-section="vitals">
      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={2} size="display-xs" id="analytics-vitals">
            {t('studio.analytics.vitals.heading')}
          </Heading>
          <Text size="sm" tone="secondary">
            {t('studio.analytics.vitals.intro')}
          </Text>
          <Text size="xs" tone="tertiary" data-vitals-caption="">
            {`${t('studio.analytics.vitals.caption')} ${String(Math.round(VITALS_SAMPLE_RATE * 100))}% · ${String(VITALS_WINDOW_DAYS)} ${t('studio.analytics.vitals.days')}`}
          </Text>
        </Stack>

        {rows.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.analytics.vitals.emptyHeading')}
            body={t('studio.analytics.vitals.emptyBody')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="p-2 font-medium">
                    {t('studio.analytics.vitals.route')}
                  </th>
                  {VITALS_METRICS.map((metric) => (
                    <th scope="col" key={metric} className="p-2 font-medium">
                      {metric}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.routePattern} data-vitals-route={row.routePattern}>
                    <th scope="row" className="p-2 font-normal">
                      {row.routePattern}
                    </th>
                    {VITALS_METRICS.map((metric) => {
                      const value = row.p75[metric]
                      return (
                        <td key={metric} className="p-2">
                          {value === null ? (
                            <Text size="sm" tone="tertiary">
                              —
                            </Text>
                          ) : (
                            <Text size="sm" tone={tone(metric, value)}>
                              {`${format(metric, value)} (n=${String(row.n[metric])})`}
                            </Text>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Stack>
    </section>
  )
}
