import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { Coverage } from '@/lib/scraper/analytics/coverage'

/**
 * How much of this is actually known, said before anything is drawn from it.
 *
 * FEAT §28: **do not manufacture unavailable analytics data; clearly state coverage.** Every figure
 * in this workspace is conditional on how many rows had parsable dimensions, and a chart that draws
 * the answerable rows and says nothing about the rest is not neutral — it reports a distribution
 * over a sample it does not disclose, which is the most persuasive way to be wrong.
 *
 * IT SITS ABOVE THE CHARTS, NOT IN A FOOTNOTE. A person should have read "412 rows, 190 with
 * measurements, 46 %" before they read anything drawn from those 190. That ordering is the whole
 * design of this component: it takes no chart, it renders no data, and it exists purely so that the
 * number a reader meets first is the one that qualifies everything after it.
 *
 * LOW COVERAGE IS MARKED, NOT HIDDEN. Below half, the badge changes tone — not because a low figure
 * is a failure, but because a reader skimming a page of numbers should be told which of them rest
 * on a minority of the rows.
 */

const LOW_COVERAGE = 50

export function CoverageBanner({
  coverage,
  scope,
}: {
  readonly coverage: Coverage
  /** What the rows were filtered to, in the reader's words. Rendered, so the sample is nameable. */
  readonly scope: string
}) {
  const low = coverage.pct < LOW_COVERAGE

  return (
    <Surface level={1} className="p-4" data-coverage-banner={String(coverage.pct)}>
      <Stack gap={2}>
        <Text size="sm" tone="secondary">
          {scope}
        </Text>
        <Cluster gap={3}>
          <Badge tone="neutral" data-coverage-in-scope={String(coverage.inScope)}>
            {`${String(coverage.inScope)} ${t('studio.research.coverageInScope')}`}
          </Badge>
          <Badge tone="neutral" data-coverage-parsed={String(coverage.parsed)}>
            {`${String(coverage.parsed)} ${t('studio.research.coverageMeasured')}`}
          </Badge>
          {/* THE UNKNOWN BUCKET IS ALWAYS DRAWN, including at zero. A figure that appears only
              when it is non-zero is a figure nobody learns to look for. */}
          <Badge tone="neutral" data-coverage-unknown={String(coverage.unknown)}>
            {`${String(coverage.unknown)} ${t('studio.research.coverageUnknown')}`}
          </Badge>
          <Badge tone={low ? 'warning' : 'neutral'}>{`${String(coverage.pct)}%`}</Badge>
        </Cluster>
        <Text size="xs" tone="secondary">
          {t('studio.research.coverageNote')}
        </Text>
      </Stack>
    </Surface>
  )
}
