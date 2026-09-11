import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { formatMinor } from '@/components/studio/research/ParseStatePill'
import { t } from '@/components/studio/strings'
import type { Coverage, PriceSummary, Tally } from '@/lib/scraper/analytics/coverage'
import { SCALE_BANDS, type ScaleBand } from '@/lib/scraper/analytics/scale'

/**
 * The five panels of the large-format workspace, in one module.
 *
 * ONE FILE BECAUSE THEY ARE ONE ARGUMENT, and the argument is coverage. Each of them takes a
 * `Coverage` and renders it; none of them may be used without one, which is enforced by the prop
 * being required rather than by a convention somebody remembers. Splitting five short panels across
 * five files would spread one rule over five imports and make the sixth panel, written later, the
 * one that forgets.
 *
 * NO CHART LIBRARY. These are bar rows built from `width: n%` and a table — which reads in a screen
 * reader, prints, works with no JavaScript, and cannot render a shape the data does not have. A
 * charting dependency would add a client bundle to a Studio screen whose whole job is to be read
 * carefully rather than looked at quickly.
 *
 * **NO PANEL DROPS A BUCKET TO LOOK TIDY.** Every band is drawn at zero, and the unknown bucket is
 * drawn first among the three-valued tallies. A distribution that renders only the bands with rows
 * changes shape as it fills, and the shape is what a person is reading.
 */

function Bar({
  label,
  value,
  total,
}: {
  readonly label: string
  readonly value: number
  readonly total: number
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <div className="flex items-center gap-3" data-bar={label}>
      <Text size="xs" tone="secondary" className="w-28 shrink-0">
        {label}
      </Text>
      <div className="bg-surface-sunken h-2 flex-1 rounded">
        <div className="bg-surface-accent h-2 rounded" style={{ width: `${String(pct)}%` }} />
      </div>
      <Text size="xs" className="w-16 shrink-0 text-right">
        {String(value)}
      </Text>
    </div>
  )
}

export function BandDistribution({
  counts,
  coverage,
}: {
  readonly counts: Readonly<Record<ScaleBand, number>>
  readonly coverage: Coverage
}) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  return (
    <Surface level={1} className="p-6" data-band-distribution="">
      <Stack gap={4}>
        <PageHeader level={2} title={t('studio.research.bandDistribution')} />
        <Text size="xs" tone="secondary">
          {`${String(coverage.parsed)}/${String(coverage.inScope)} ${t('studio.research.coverageMeasured')}`}
        </Text>
        <Stack gap={2}>
          {/* EVERY BAND, ALWAYS, INCLUDING UNKNOWN AND INCLUDING THE EMPTY ONES. */}
          {SCALE_BANDS.map((band) => (
            <Bar key={band} label={band} value={counts[band] ?? 0} total={total} />
          ))}
        </Stack>
      </Stack>
    </Surface>
  )
}

export function LargeFormatTally({ tally }: { readonly tally: Tally }) {
  return (
    <Surface level={1} className="p-6" data-large-format-tally="">
      <Stack gap={3}>
        <PageHeader level={2} title={t('studio.research.largeFormatHeading')} />
        <Cluster gap={3}>
          <Badge tone="neutral" data-tally-yes={String(tally.yes)}>
            {`${String(tally.yes)} ${t('studio.research.tallyLarge')}`}
          </Badge>
          <Badge tone="neutral" data-tally-no={String(tally.no)}>
            {`${String(tally.no)} ${t('studio.research.tallyNotLarge')}`}
          </Badge>
          {/* THE THIRD VALUE, RENDERED BESIDE THE OTHER TWO RATHER THAN LEFT TO SUBTRACTION.
              Nobody subtracts; they read the two numbers as the whole picture. */}
          <Badge tone="warning" data-tally-unknown={String(tally.unknown)}>
            {`${String(tally.unknown)} ${t('studio.research.tallyUnknown')}`}
          </Badge>
        </Cluster>
        <Text size="xs" tone="secondary">
          {t('studio.research.tallyNote')}
        </Text>
      </Stack>
    </Surface>
  )
}

export interface ScatterPoint {
  readonly id: string
  readonly longestAxisMm: number
  readonly heightMm: number | null
  readonly band: string | null
}

/**
 * Longest axis against height, for PARSED rows only.
 *
 * THE EXCLUDED COUNT IS STATED BENEATH IT, which is the whole reason this is a panel rather than a
 * picture. A scatter is the most persuasive chart there is — it looks like all the data — and this
 * one is drawn from the minority of rows whose pages stated measurements.
 *
 * A ROW WITH NO HEIGHT IS EXCLUDED AND COUNTED, not plotted at zero. A table plotted at the origin
 * would sit among the smallest pieces in the corpus while actually being unmeasured in that axis.
 */
export function DimensionScatter({
  points,
  excluded,
}: {
  readonly points: readonly ScatterPoint[]
  readonly excluded: number
}) {
  const maxAxis = Math.max(1, ...points.map((point) => point.longestAxisMm))
  const maxHeight = Math.max(1, ...points.map((point) => point.heightMm ?? 0))

  return (
    <Surface level={1} className="p-6" data-dimension-scatter={String(points.length)}>
      <Stack gap={3}>
        <PageHeader level={2} title={t('studio.research.scatterHeading')} />
        <div
          className="border-line relative h-64 w-full rounded border"
          role="img"
          aria-label={t('studio.research.scatterHeading')}
        >
          {points.map((point) => (
            <span
              key={point.id}
              className="bg-surface-accent absolute block h-1.5 w-1.5 rounded-full"
              style={{
                left: `${String(Math.round((point.longestAxisMm / maxAxis) * 96))}%`,
                bottom: `${String(Math.round(((point.heightMm ?? 0) / maxHeight) * 92))}%`,
              }}
              data-point={point.id}
            />
          ))}
        </div>
        <Text size="xs" tone="secondary">
          {`${String(excluded)} ${t('studio.research.scatterExcluded')}`}
        </Text>
      </Stack>
    </Surface>
  )
}

/**
 * Price by band, one group per currency, and never a combined total.
 *
 * **CURRENCIES ARE NEVER MIXED.** Phase 28's rule: no conversion exists anywhere under
 * `lib/scraper/`, because a rate is a fact about a day and inventing one would fabricate every
 * figure computed from it. There is no honest total to render, so none is rendered — and the
 * absence is stated, because a reader looking for a total should find out why there is not one.
 *
 * QUOTE-ONLY ROWS ARE THEIR OWN FIGURE. A competitor who withdraws public prices is telling us
 * something; dropping those rows would make an expensive source look cheap by removing exactly its
 * expensive half.
 */
export function PriceByBand({
  summary,
  coverage,
}: {
  readonly summary: PriceSummary
  readonly coverage: Coverage
}) {
  return (
    <Surface level={1} className="p-6" data-price-by-band="">
      <Stack gap={4}>
        <PageHeader level={2} title={t('studio.research.priceByBand')} />
        <Text size="xs" tone="secondary">
          {t('studio.research.priceNoConversion')}
        </Text>

        {summary.groups.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t('studio.research.priceNone')}
          </Text>
        ) : (
          <Stack gap={2}>
            {summary.groups.map((group) => (
              <Cluster key={group.currency} gap={3} data-price-group={group.currency}>
                <Badge tone="neutral">{group.currency}</Badge>
                <Text size="sm" tone="secondary">{`${String(group.count)} rows`}</Text>
                <Text size="sm">
                  {`${formatMinor(group.minMinor, group.currency) ?? '—'} – ${formatMinor(group.maxMinor, group.currency) ?? '—'}`}
                </Text>
                <Text size="sm" tone="secondary">
                  {`mean ${formatMinor(group.meanMinor, group.currency) ?? '—'}`}
                </Text>
              </Cluster>
            ))}
          </Stack>
        )}

        <Cluster gap={3}>
          <Badge tone="neutral" data-quote-only={String(summary.quoteOnly)}>
            {`${String(summary.quoteOnly)} ${t('studio.research.priceQuoteOnly')}`}
          </Badge>
          <Badge tone="neutral" data-unpriced={String(summary.unpriced)}>
            {`${String(summary.unpriced)} ${t('studio.research.priceUnpriced')}`}
          </Badge>
          <Text size="xs" tone="secondary">
            {`${String(coverage.parsed)}/${String(coverage.inScope)}`}
          </Text>
        </Cluster>
      </Stack>
    </Surface>
  )
}

export function MaterialsByBand({
  counts,
  coverage,
}: {
  readonly counts: readonly { readonly token: string; readonly count: number }[]
  readonly coverage: Coverage
}) {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0)
  return (
    <Surface level={1} className="p-6" data-materials-by-band="">
      <Stack gap={4}>
        <PageHeader level={2} title={t('studio.research.materialsByBand')} />
        <Text size="xs" tone="secondary">
          {`${String(coverage.parsed)}/${String(coverage.inScope)} ${t('studio.research.coverageMeasured')}`}
        </Text>
        {counts.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t('studio.research.materialsNone')}
          </Text>
        ) : (
          <Stack gap={2}>
            {counts.map((entry) => (
              <Bar key={entry.token} label={entry.token} value={entry.count} total={total} />
            ))}
          </Stack>
        )}
      </Stack>
    </Surface>
  )
}

/**
 * Where research coverage is thin.
 *
 * **IT REPORTS RESEARCH COVERAGE AND SAYS SO IN ITS HEADING.** It does not compare against Rivya's
 * catalogue, does not compute an opportunity score and does not phrase anything as a market gap.
 * Rivya has no published products yet, so any such comparison would be an artefact of an empty
 * catalogue wearing the clothes of a finding — and the person reading it would have no way to tell.
 * Opportunity scoring is Phase 32, after there is something to compare against.
 *
 * WHAT IT SAYS IS NARROW AND TRUE: these bands have few rows, or a high share of rows whose
 * dimensions could not be read. Both are statements about what Rivya has LOOKED AT.
 */
export function GapPanel({
  bands,
  coverage,
}: {
  readonly bands: readonly {
    readonly band: ScaleBand
    readonly rows: number
    readonly unknownShare: number
  }[]
  readonly coverage: Coverage
}) {
  const thin = bands.filter((entry) => entry.rows < 10 || entry.unknownShare >= 50)

  return (
    <Surface level={1} className="p-6" data-gap-panel="">
      <Stack gap={3}>
        <PageHeader level={2} title={t('studio.research.gapHeading')} />
        <Text size="xs" tone="secondary">
          {t('studio.research.gapNote')}
        </Text>
        {thin.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t('studio.research.gapNone')}
          </Text>
        ) : (
          <Stack gap={2}>
            {thin.map((entry) => (
              <Cluster key={entry.band} gap={3} data-thin-band={entry.band}>
                <Badge tone="warning">{entry.band}</Badge>
                <Text size="sm" tone="secondary">
                  {`${String(entry.rows)} rows · ${String(entry.unknownShare)}% unmeasured`}
                </Text>
              </Cluster>
            ))}
          </Stack>
        )}
        <Text size="xs" tone="secondary">
          {`${String(coverage.inScope)} ${t('studio.research.coverageInScope')}`}
        </Text>
      </Stack>
    </Surface>
  )
}
