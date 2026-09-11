import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { BandStrip } from '@/components/patterns/BandStrip'
import { BarSeries } from '@/components/patterns/BarSeries'
import { Scatter } from '@/components/patterns/Scatter'
import { PageHeader } from '@/components/studio/PageHeader'
import { CoverageBadge } from '@/components/studio/research/CoverageBadge'
import { formatMinor } from '@/components/studio/research/ParseStatePill'
import { t } from '@/components/studio/strings'
import type { AssortmentResult } from '@/lib/scraper/analytics/assortment'
import { coverageRecordSchema, type CoverageRecord } from '@/lib/scraper/analytics/coverage'
import type { DimensionsResult } from '@/lib/scraper/analytics/dimensions'
import type { PriceArchitectureResult } from '@/lib/scraper/analytics/price-architecture'
import type { AnalyticsSnapshotRow } from '@/lib/supabase/schemas/research-analytics'

/**
 * RC-323 `AnalysisPanels` — Assortment, Price architecture, Dimensions, rendered FROM SNAPSHOTS.
 *
 * NOTHING HERE COMPUTES. Each panel renders a stored payload, headed by the coverage record stored
 * beside it, so what a reader sees is what the database holds — and a second reader opening the
 * same set an hour later sees the same figures until somebody recomputes. The coverage badge is
 * REQUIRED on every panel by the prop being required; there is no way to mount one without it.
 *
 * ONE PRICE PANEL PER CURRENCY, WITH A NOTICE WHEN THERE IS MORE THAN ONE. No combined total is
 * drawn because none is stored, and none is stored because the schema has no key for one.
 */

function readCoverage(row: AnalyticsSnapshotRow): CoverageRecord | null {
  const first = row.payload.coverage[0]
  const parsed = coverageRecordSchema.safeParse(first)
  return parsed.success ? parsed.data : null
}

function PanelShell({
  heading,
  body,
  coverage,
  testId,
  children,
}: {
  readonly heading: string
  readonly body: string
  readonly coverage: CoverageRecord | null
  readonly testId: string
  readonly children: React.ReactNode
}) {
  return (
    <Surface level={1} className="p-6" data-analysis-panel={testId}>
      <Stack gap={4}>
        <PageHeader level={2} title={heading} description={body} />
        {/* FIRST, ALWAYS. The number a reader meets first is the one that qualifies the rest. */}
        {coverage === null ? null : <CoverageBadge coverage={coverage} />}
        {children}
      </Stack>
    </Surface>
  )
}

export function AssortmentPanel({
  snapshot,
  sourceNames,
}: {
  readonly snapshot: AnalyticsSnapshotRow
  readonly sourceNames: ReadonlyMap<string, string>
}) {
  const result = snapshot.payload.result as unknown as AssortmentResult
  return (
    <PanelShell
      heading={t('studio.research.assortmentHeading')}
      body={t('studio.research.assortmentBody')}
      coverage={readCoverage(snapshot)}
      testId="assortment"
    >
      <Cluster gap={3}>
        <Badge tone="neutral">{`${String(result.largeFormat.yes)} ${t('studio.research.tallyLarge')}`}</Badge>
        <Badge tone="neutral">{`${String(result.largeFormat.no)} ${t('studio.research.tallyNotLarge')}`}</Badge>
        <Badge tone="neutral">{`${String(result.largeFormat.unknown)} ${t('studio.research.tallyUnknown')}`}</Badge>
      </Cluster>
      <BarSeries
        label={t('studio.research.assortmentBySource')}
        tableCaption={t('studio.research.chartTable')}
        columns={[t('studio.research.chartLabel'), t('studio.research.chartValue')]}
        data={result.sources.map((source) => ({
          label: sourceNames.get(source.sourceId) ?? source.sourceId.slice(0, 8),
          value: source.liveCount,
        }))}
        testId="assortment-by-source"
      />
      <BarSeries
        label={t('studio.research.assortmentByCategory')}
        tableCaption={t('studio.research.chartTable')}
        columns={[t('studio.research.chartLabel'), t('studio.research.chartValue')]}
        data={result.byCategory.map((entry) => ({ label: entry.slug, value: entry.count }))}
        testId="assortment-by-category"
      />
      <Stack gap={1}>
        {result.sources.map((source) => (
          <Text
            key={source.sourceId}
            size="xs"
            tone="secondary"
            data-source-assortment={source.sourceId}
          >
            {`${sourceNames.get(source.sourceId) ?? source.sourceId}: ${String(source.liveCount)} ${t('studio.research.assortmentLive')} · ${String(source.pricedShare)}% ${t('studio.research.assortmentPriced')}`}
          </Text>
        ))}
      </Stack>
    </PanelShell>
  )
}

export function PricePanel({
  snapshot,
  multiCurrency,
}: {
  readonly snapshot: AnalyticsSnapshotRow
  readonly multiCurrency: boolean
}) {
  const result = snapshot.payload.result as unknown as PriceArchitectureResult
  const currency = snapshot.currency ?? result.currency ?? ''
  return (
    <PanelShell
      heading={`${t('studio.research.priceArchitectureHeading')} · ${currency}`}
      body={t('studio.research.priceArchitectureBody')}
      coverage={readCoverage(snapshot)}
      testId={`price-${currency}`}
    >
      {multiCurrency ? (
        <Text size="xs" tone="secondary" data-multi-currency-notice="">
          {t('studio.research.priceMultiCurrency')}
        </Text>
      ) : null}
      {result.insufficientSample ? (
        <Stack gap={1} data-insufficient-sample="">
          <Badge tone="warning">{t('studio.research.priceInsufficient')}</Badge>
          <Text size="xs" tone="secondary">
            {t('studio.research.priceInsufficientBody')}
          </Text>
        </Stack>
      ) : result.percentiles === null ? null : (
        <Cluster gap={3} data-percentiles="">
          {(
            [
              ['p10', result.percentiles.p10],
              ['p25', result.percentiles.p25],
              ['median', result.percentiles.median],
              ['p75', result.percentiles.p75],
              ['p90', result.percentiles.p90],
            ] as const
          ).map(([label, value]) => (
            <Badge key={label} tone="neutral" data-percentile={label}>
              {`${label} ${formatMinor(Math.round(value), currency) ?? String(value)}`}
            </Badge>
          ))}
        </Cluster>
      )}
      <BarSeries
        label={t('studio.research.priceHistogram')}
        tableCaption={t('studio.research.chartTable')}
        columns={[t('studio.research.chartLabel'), t('studio.research.chartValue')]}
        data={result.histogram.map((bin) => ({
          label: `${formatMinor(bin.fromMinor, currency) ?? String(bin.fromMinor)}`,
          value: bin.count,
        }))}
        testId="price-histogram"
      />
      <BandStrip
        label={`${t('studio.research.priceBands')} · ${result.bands.rule}`}
        tableCaption={t('studio.research.chartTable')}
        columns={[t('studio.research.chartLabel'), t('studio.research.chartValue')]}
        bands={result.bands.bands.map((band) => ({
          label: `${band.fromMinor === null ? '…' : (formatMinor(band.fromMinor, currency) ?? String(band.fromMinor))} – ${band.toMinor === null ? '…' : (formatMinor(band.toMinor, currency) ?? String(band.toMinor))}`,
          from:
            band.fromMinor === null
              ? ''
              : (formatMinor(band.fromMinor, currency) ?? String(band.fromMinor)),
          to: band.toMinor === null ? '' : String(band.toMinor),
          value: band.count,
        }))}
        testId="price-bands"
      />
      <Text size="xs" tone="secondary">
        {`${String(result.ranges.count)} ${t('studio.research.priceRanges')} ${result.ranges.medianWidthMinor === null ? '—' : (formatMinor(Math.round(result.ranges.medianWidthMinor), currency) ?? String(result.ranges.medianWidthMinor))}`}
      </Text>
    </PanelShell>
  )
}

export function DimensionsPanel({ snapshot }: { readonly snapshot: AnalyticsSnapshotRow }) {
  const result = snapshot.payload.result as unknown as DimensionsResult
  return (
    <PanelShell
      heading={t('studio.research.dimensionsHeading')}
      body={t('studio.research.dimensionsBody')}
      coverage={readCoverage(snapshot)}
      testId="dimensions"
    >
      <Stack gap={1} data-axes="">
        <Text size="xs" tone="secondary">
          {t('studio.research.dimensionsAxes')}
        </Text>
        {result.axes.map((axis) => (
          <Text key={axis.axis} size="xs" data-axis={axis.axis}>
            {`${axis.axis}: n=${String(axis.n)}${axis.insufficientSample ? ` · ${t('studio.research.priceInsufficient')}` : ` · p10 ${String(axis.p10)} · p50 ${String(axis.p50)} · p90 ${String(axis.p90)}`}`}
          </Text>
        ))}
      </Stack>
      <BarSeries
        label={t('studio.research.dimensionsLongest')}
        tableCaption={t('studio.research.chartTable')}
        columns={[t('studio.research.chartLabel'), t('studio.research.chartValue')]}
        data={result.longestAxis.map((bucket) => ({ label: bucket.label, value: bucket.count }))}
        testId="longest-axis"
      />
      <Text size="xs" tone="secondary" data-table-scale={String(result.tableScale.count)}>
        {`${String(result.tableScale.count)} (${String(result.tableScale.share)}%) ${t('studio.research.dimensionsTableScale')}`}
      </Text>
      <Scatter
        label={t('studio.research.dimensionsScatter')}
        tableCaption={t('studio.research.chartTable')}
        axisLabels={['width_mm', 'height_mm']}
        points={result.scatter.map((point) => ({
          id: point.id,
          x: point.widthMm,
          y: point.heightMm,
        }))}
        testId="dimension-scatter"
      />
    </PanelShell>
  )
}
