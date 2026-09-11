import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { CoverageRecord } from '@/lib/scraper/analytics/coverage'

/**
 * RC-316 `CoverageBadge` — `n / denominator · coverage % · as of`, on every analytic figure.
 *
 * REUSED BY PHASES 32, 33 AND 37. It takes the coverage RECORD rather than three numbers, so a
 * panel cannot render a figure whose exclusions it forgot to mention: the reasons are drawn from
 * the same object the percentage is.
 *
 * LOW COVERAGE IS MARKED, NOT HIDDEN. Below half the badge changes tone, for the reason
 * `CoverageBanner` gives: a reader skimming a page of numbers should be told which of them rest on
 * a minority of the rows.
 */
const LOW_COVERAGE = 50

export function CoverageBadge({ coverage }: { readonly coverage: CoverageRecord }) {
  const low = coverage.coveragePct < LOW_COVERAGE
  const excluded = Object.entries(coverage.excludedReasons).filter(([, count]) => (count ?? 0) > 0)
  return (
    <Cluster gap={2} data-coverage-badge={coverage.metricKey} data-coverage-n={String(coverage.n)}>
      <Badge tone="neutral" data-coverage-denominator={String(coverage.denominator)}>
        {`${String(coverage.n)} ${t('studio.research.coverageOf')} ${String(coverage.denominator)}`}
      </Badge>
      <Badge tone={low ? 'warning' : 'neutral'}>{`${String(coverage.coveragePct)}%`}</Badge>
      <Text size="xs" tone="secondary" as="span">
        {`${t('studio.research.coverageAsOf')} ${coverage.asOf.slice(0, 10)}`}
      </Text>
      {excluded.length === 0 ? null : (
        <Text size="xs" tone="secondary" as="span" data-coverage-excluded="">
          {`${t('studio.research.coverageExcluded')}: ${excluded
            .map(([reason, count]) => `${reason} ${String(count)}`)
            .join(' · ')}`}
        </Text>
      )}
    </Cluster>
  )
}
