import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { ActionForm } from '@/components/studio/ActionForm'
import {
  BandDistribution,
  DimensionScatter,
  GapPanel,
  LargeFormatTally,
  MaterialsByBand,
  PriceByBand,
  type ScatterPoint,
} from '@/components/studio/research/BandPanels'
import { ResearchBulkPreview } from '@/components/studio/research/BulkPreview'
import { ResearchBulkToolbar } from '@/components/studio/research/BulkToolbar'
import { CoverageBanner } from '@/components/studio/research/CoverageBanner'
import { formatMinor } from '@/components/studio/research/ParseStatePill'
import { RowActionBar } from '@/components/studio/research/RowActionBar'
import { SavedViews } from '@/components/studio/research/SavedViews'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { loadBulkOperations, operationsFor } from '@/lib/bulk/registry'
import { readBulkPreview } from '@/lib/bulk/run'
import { MAX_SELECTION } from '@/lib/bulk/types'
import {
  coverage,
  summarisePrices,
  tallyByBand,
  tallyThreeValued,
} from '@/lib/scraper/analytics/coverage'
import { SCALE_BANDS, type ScaleBand } from '@/lib/scraper/analytics/scale'
import { listTags } from '@/lib/supabase/repositories/research/review'
import { listSavedViews } from '@/lib/supabase/repositories/research/saved-views'
import { listScaleRows, type ScaleRow } from '@/lib/supabase/repositories/research/scale'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

import { confirmAction, rejectAction, shortlistAction } from '../changes/actions'
import { applyResearchBulkAction, previewResearchBulkAction } from '../bulk-actions'
import { deleteViewAction, overrideScaleAction, saveViewAction } from './actions'

/**
 * /studio/research/large-format — the workspace over the rows that are large by a stated rule.
 *
 * SEED §56 PUTS LARGE-FORMAT FURNITURE FIRST IN THE CONTENT HIERARCHY, and this gives the same
 * priority to research. What it is NOT is a market analysis: Rivya has no published products, so a
 * comparison against its own catalogue would be an artefact of an empty catalogue wearing the
 * clothes of a finding. This screen describes what has been OBSERVED and nothing more; opportunity
 * scoring is Phase 32, after there is something to compare against.
 *
 * **THE COVERAGE BANNER IS FIRST, ABOVE EVERY PANEL.** Every figure below it is conditional on how
 * many rows had parsable dimensions, and a chart that draws the answerable rows and says nothing
 * about the rest reports a distribution over a sample it does not disclose. A person should have
 * read "412 rows, 190 with measurements, 46 %" before they read anything drawn from those 190.
 *
 * IT COMPOSES RATHER THAN REIMPLEMENTS. The risk this phase carries, named in its own document, is
 * becoming a second explorer with duplicated filtering code — so the filter vocabulary here is
 * deliberately small (source, band, large-only, currency) and every richer question is the
 * explorer's, reached through a saved view. `tests/unit/coverage-reporting.test.ts` asserts that
 * this page constructs no filter predicate of its own.
 */
export const metadata = studioMetadata('/studio/research/large-format')

const one = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? ''

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const BASE_PATH = '/studio/research/large-format'

const BAND_TONE: Readonly<Record<string, 'info' | 'neutral' | 'warning'>> = {
  MONUMENTAL: 'info',
  UNKNOWN: 'warning',
}

function readDimensions(value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'number' && Number.isFinite(entry)) out[key] = entry
  }
  return out
}

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('research.read')
  const params = await searchParams
  const client = await createClient()

  const sourceParam = one(params.source)
  const bandParam = one(params.band)
  const currencyParam = one(params.currency).toUpperCase()
  const largeOnly = one(params.large) === 'true'

  const filter = {
    ...(UUID.test(sourceParam) ? { sourceId: sourceParam } : {}),
    ...((SCALE_BANDS as readonly string[]).includes(bandParam)
      ? { band: bandParam as ScaleBand }
      : {}),
    ...(/^[A-Z]{3}$/u.test(currencyParam) ? { currency: currencyParam } : {}),
    ...(largeOnly ? { largeOnly: true } : {}),
  }

  await loadBulkOperations()

  const [rows, sources, views, tags] = await Promise.all([
    listScaleRows(client, filter),
    listResearchSources(client),
    listSavedViews(client, 'large-format'),
    listTags(client),
  ])

  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))

  /*
   * COVERAGE IS COMPUTED ONCE AND PASSED TO EVERY PANEL.
   *
   * Not recomputed per panel: two panels on one screen disagreeing about the sample size is worse
   * than either being wrong on its own, and a helper that ran its own query would give each of them
   * a slightly different denominator depending on when it ran.
   */
  const parsedRows = rows.filter((row) => row.dimension_parse_state === 'PARSED')
  const scope = coverage(rows.length, parsedRows.length)

  const bandCounts = tallyByBand(
    SCALE_BANDS,
    rows.map((row) => (row.scale_band ?? null) as ScaleBand | null),
  )
  const largeTally = tallyThreeValued(rows.map((row) => row.is_large_format))

  const scatter: ScatterPoint[] = parsedRows.flatMap((row) => {
    const dimensions = readDimensions(row.dimensions_mm)
    const height = dimensions['height_mm'] ?? null
    if (row.longest_axis_mm === null || height === null) return []
    return [
      { id: row.id, longestAxisMm: row.longest_axis_mm, heightMm: height, band: row.scale_band },
    ]
  })

  const prices = summarisePrices(
    rows.map((row) => ({
      currency: row.currency,
      priceState: row.price_state,
      priceMinMinor: row.price_min_minor,
    })),
  )

  const materialCounts = (() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const token of row.material_tokens ?? []) {
        counts.set(token, (counts.get(token) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([token, count]) => ({ token, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
  })()

  const gapBands = SCALE_BANDS.map((band) => {
    const inBand = rows.filter((row) => row.scale_band === band)
    const unmeasured = inBand.filter((row) => row.dimension_parse_state !== 'PARSED').length
    return {
      band,
      rows: inBand.length,
      unknownShare: inBand.length === 0 ? 0 : Math.round((unmeasured / inBand.length) * 100),
    }
  })

  const canWrite = roleHasPermission(session.role, 'research.write')
  const canConfirm = roleHasPermission(session.role, 'research.confirm')
  const canDestroy = roleHasPermission(session.role, 'destructive.execute')

  /*
   * THE TOOLBAR NEEDS BOTH PERMISSIONS, AND THE ENGINE IS WHAT ENFORCES THAT.
   *
   * Every research operation declares `extraPermission: 'research.confirm'` on top of the
   * `bulk.execute` its Server Action checks — the Phase 04 split at the engine, because a
   * researcher operates the pipeline and does not judge its output. Rendering the toolbar only for
   * a role holding both is the courtesy; `run.ts` is the gate.
   */
  const canBulk = roleHasPermission(session.role, 'bulk.execute') && canConfirm

  const currentFilters: Record<string, string> = {
    ...(sourceParam === '' ? {} : { source: sourceParam }),
    ...(bandParam === '' ? {} : { band: bandParam }),
    ...(currencyParam === '' ? {} : { currency: currencyParam }),
    ...(largeOnly ? { large: 'true' } : {}),
  }

  const filtersQuery = new URLSearchParams(currentFilters).toString()
  const withFilters = (extra: Record<string, string>): string => {
    const search = new URLSearchParams(currentFilters)
    for (const [key, value] of Object.entries(extra)) search.set(key, value)
    const query = search.toString()
    return query === '' ? BASE_PATH : `${BASE_PATH}?${query}`
  }

  /*
   * A PREVIEW REPLACES THE WORKSPACE RATHER THAN SITTING UNDER IT, and it is recomputed on every
   * render — so a preview left open while somebody else decides those rows reports the queue as it
   * is rather than as it was.
   */
  const operationId = one(params.operation)
  const preview =
    canBulk && operationId !== ''
      ? await readBulkPreview(operationId, { userId: session.userId, role: session.role })
      : null

  if (preview !== null) {
    return (
      <StudioPage path={BASE_PATH}>
        <ResearchBulkPreview
          kind={preview.kind}
          operationId={preview.operationId}
          confirmationToken={preview.confirmationToken}
          isDestructive={preview.isDestructive}
          rows={preview.items.map((item) => ({
            entityId: item.entityId,
            outcome: item.outcome,
            ...(item.reason === undefined ? {} : { reason: item.reason }),
            ...(item.rule === undefined ? {} : { rule: item.rule }),
            ...(item.label === undefined ? {} : { label: item.label }),
          }))}
          willApply={preview.counts.willApply}
          surface={BASE_PATH}
          backHref={filtersQuery === '' ? BASE_PATH : `${BASE_PATH}?${filtersQuery}`}
          applyAction={applyResearchBulkAction}
        />
      </StudioPage>
    )
  }

  // The row a person opened the action bar for, resolved from the rows already loaded so a crafted
  // id cannot pull a row the filters exclude.
  const rowParam = one(params.row)
  const openRow = UUID.test(rowParam) ? (rows.find((entry) => entry.id === rowParam) ?? null) : null

  const columns: readonly Column<ScaleRow>[] = [
    /*
     * THE SELECTION CHECKBOX IS A SERVER-RENDERED COLUMN OF THIS TABLE, not a control the toolbar
     * island draws. `name="selection"` is the whole contract between the two: the island wraps the
     * table in a form and counts what is ticked, and with no JavaScript the boxes and the submit
     * still work. It is rendered only for a role that may act, because a checkbox that leads
     * nowhere is the broken control Phase 24's unavailable state exists to avoid.
     */
    ...(canBulk
      ? [
          {
            id: 'select',
            header: t('studio.research.selectRow'),
            cell: (row: ScaleRow) => (
              <input
                type="checkbox"
                name="selection"
                value={row.id}
                aria-label={row.title_normalized ?? row.source_url}
                data-select-row={row.id}
              />
            ),
          },
        ]
      : []),
    {
      id: 'title',
      header: t('studio.research.filterTitle'),
      cell: (row) => (
        <Text size="sm" className="break-words">
          {row.title_normalized ?? row.source_url}
        </Text>
      ),
    },
    {
      id: 'band',
      header: t('studio.research.filterBand'),
      cell: (row) => (
        <Badge tone={BAND_TONE[row.scale_band ?? 'UNKNOWN'] ?? 'neutral'}>
          {row.scale_band ?? 'UNKNOWN'}
        </Badge>
      ),
    },
    {
      id: 'large',
      header: t('studio.research.largeFormatHeading'),
      cell: (row) => (
        <Text size="sm" tone={row.is_large_format === null ? 'secondary' : 'primary'}>
          {row.is_large_format === null
            ? t('studio.research.tallyUnknown')
            : row.is_large_format
              ? t('studio.research.tallyLarge')
              : t('studio.research.tallyNotLarge')}
        </Text>
      ),
    },
    {
      id: 'longest',
      header: t('studio.research.scatterHeading'),
      numeric: true,
      cell: (row) => (
        <Text size="sm">
          {row.longest_axis_mm === null ? '—' : `${String(row.longest_axis_mm)} mm`}
        </Text>
      ),
    },
    {
      id: 'price',
      header: t('studio.research.priceByBand'),
      cell: (row) => (
        <Text size="sm">
          {formatMinor(row.price_min_minor, row.currency) ?? row.price_state ?? '—'}
        </Text>
      ),
    },
    {
      id: 'source',
      header: t('studio.research.filterSource'),
      cell: (row) => (
        <Text size="sm" tone="secondary">
          {sourceNames.get(row.source_id) ?? row.source_id}
        </Text>
      ),
    },
    {
      id: 'override',
      header: t('studio.research.filterBand'),
      cell: (row) =>
        canWrite ? (
          <ActionForm action={overrideScaleAction}>
            <input type="hidden" name="product_id" value={row.id} />
            <Cluster gap={2} align="end">
              <Select name="scale_band" defaultValue={row.scale_band ?? 'UNKNOWN'}>
                {SCALE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </Select>
              <Select
                name="is_large_format"
                defaultValue={row.is_large_format === null ? '' : String(row.is_large_format)}
              >
                {/* THREE OPTIONS, BECAUSE THE COLUMN HAS THREE VALUES. "Could not tell" is a
                    choice a person makes, not the absence of one. */}
                <option value="">{t('studio.research.tallyUnknown')}</option>
                <option value="true">{t('studio.research.tallyLarge')}</option>
                <option value="false">{t('studio.research.tallyNotLarge')}</option>
              </Select>
              <Button type="submit" variant="quiet" size="sm">
                {t('studio.research.apply')}
              </Button>
            </Cluster>
          </ActionForm>
        ) : (
          <Text size="sm" tone="secondary">
            {row.large_format_source ?? '—'}
          </Text>
        ),
    },
    {
      id: 'open',
      header: t('studio.research.openRow'),
      cell: (row) => (
        // A LINK RATHER THAN A DIALOG: the action bar is a URL, so a merchandiser can send somebody
        // the row they are asking about and the filters they were looking at it under.
        <a
          href={withFilters({ row: row.id })}
          className="text-sm underline underline-offset-4"
          data-open-row={row.id}
        >
          {t('studio.research.openRow')}
        </a>
      ),
    },
  ]

  /*
   * THE TABLE IS BUILT ONCE AND HANDED TO WHICHEVER WRAPPER APPLIES.
   *
   * A client component cannot render a Server Component, but it can render one it is handed — so
   * the rows stay server-rendered whether or not the toolbar wraps them, and there is exactly one
   * table in this file rather than one per permission branch.
   */
  const table = (
    <DataTable
      caption={t('studio.research.largeFormatHeading')}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      empty={{
        reason: 'empty',
        heading: t('studio.research.workspaceEmpty'),
        body: t('studio.research.workspaceEmptyBody'),
      }}
    />
  )

  // The engine's own register, filtered to this entity — never a list of kinds written out here,
  // which would drift the day a phase adds the sixth operation.
  const operations = operationsFor('research_product').map((operation) => ({
    kind: operation.kind,
    isDestructive: typeof operation.isDestructive === 'function' ? true : operation.isDestructive,
    available: operation.available !== false,
  }))

  return (
    <StudioPage path={BASE_PATH}>
      <Stack gap={6}>
        {/* FIRST, ALWAYS. See the header. */}
        <CoverageBanner
          coverage={scope}
          scope={
            Object.keys(currentFilters).length === 0
              ? t('studio.research.largeFormatHeading')
              : Object.entries(currentFilters)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(' · ')
          }
        />

        <form method="get">
          <Cluster gap={3} align="end">
            <label className="flex min-w-40 flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.filterSource')}
              </Text>
              <Select name="source" defaultValue={sourceParam}>
                <option value="">{t('studio.research.filterAll')}</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-40 flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.filterBand')}
              </Text>
              <Select name="band" defaultValue={bandParam}>
                <option value="">{t('studio.research.filterAll')}</option>
                {SCALE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="large" value="true" defaultChecked={largeOnly} />
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.filterLargeOnly')}
              </Text>
            </label>
            <Button type="submit" variant="secondary">
              {t('studio.research.apply')}
            </Button>
          </Cluster>
        </form>

        <SavedViews
          surface="large-format"
          views={views}
          currentFilters={currentFilters}
          currentUserId={session.userId}
          basePath="/studio/research/large-format"
          saveAction={saveViewAction}
          deleteAction={deleteViewAction}
        />

        <LargeFormatTally tally={largeTally} />
        <BandDistribution counts={bandCounts} coverage={scope} />
        <DimensionScatter points={scatter} excluded={rows.length - scatter.length} />
        <PriceByBand summary={prices} coverage={scope} />
        <MaterialsByBand counts={materialCounts} coverage={scope} />
        <GapPanel bands={gapBands} coverage={scope} />

        {openRow === null ? null : (
          <RowActionBar
            productId={openRow.id}
            label={openRow.title_normalized ?? openRow.source_url}
            canConfirm={canConfirm}
            actions={{
              shortlist: shortlistAction,
              reject: rejectAction,
              confirm: confirmAction,
            }}
          />
        )}

        {canBulk ? (
          <ResearchBulkToolbar
            surface={BASE_PATH}
            filters={filtersQuery}
            operations={operations}
            tags={tags.map((tag) => ({ id: tag.id, name: tag.label }))}
            canDestroy={canDestroy}
            maxSelection={MAX_SELECTION}
            previewAction={previewResearchBulkAction}
          >
            {table}
          </ResearchBulkToolbar>
        ) : (
          <Stack gap={2}>
            {table}
            {/* SAID RATHER THAN SHOWN AS AN ABSENCE. A missing toolbar teaches an operator that
                bulk review does not exist; this teaches them which permission it needs. */}
            <Text size="xs" tone="secondary">
              {t('studio.research.bulkNeedsPermission')}
            </Text>
          </Stack>
        )}
      </Stack>
    </StudioPage>
  )
}
