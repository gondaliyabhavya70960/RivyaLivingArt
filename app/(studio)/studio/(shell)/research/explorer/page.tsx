import Link from 'next/link'
import type { Route } from 'next'

import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { UnavailableBulkToolbar } from '@/components/studio/bulk/UnavailableToolbar'
import { ExplorerFilters, type FilterOption } from '@/components/studio/research/ExplorerFilters'
import { ParseStatePill, formatMinor } from '@/components/studio/research/ParseStatePill'
import { ProductDrawer, type DrawerVersion } from '@/components/studio/research/ProductDrawer'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listCategories } from '@/lib/supabase/repositories/categories'
import {
  getExplorerRow,
  listExplorerRows,
  type ExplorerRow,
} from '@/lib/supabase/repositories/research/explorer'
import { listCandidatesForProduct } from '@/lib/supabase/repositories/research/match-candidates'
import { getProductVersionById } from '@/lib/supabase/repositories/research/product-versions'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { listIssuesForProduct } from '@/lib/supabase/repositories/research/validation-issues'
import { createClient } from '@/lib/supabase/server'

import {
  clearDuplicateAction,
  decideCandidateAction,
  dismissIssueAction,
  saveOverrideAction,
} from './actions'

/**
 * /studio/research/explorer — the working surface for everything the pipeline has read.
 *
 * WHAT THE PAGE SAID BESIDE WHAT RIVYA MADE OF IT, on every row, with the rule that produced each
 * value. That pairing is the phase's whole argument: a comparison table is only trustworthy if the
 * judgements behind it can be checked, and they can only be checked if the source text is on the
 * screen next to them.
 *
 * NOTHING HERE IS PUBLISHED AND NOTHING HERE IS RIVYA'S. `research_products` has no `anon` policy,
 * the public search index cannot hold a research row by constraint, and no path leads from this
 * screen to a `products` write. A row on this page is a note about somebody else's catalogue.
 *
 * FILTERS LIVE IN THE URL AND THE DRAWER IS `?row=<id>`, which is also the address
 * `refresh_research_search_document` writes into the search index — so a palette result opens the
 * row rather than the list, and a filtered view is a link somebody can send.
 *
 * A SERVER COMPONENT WITH NO CLIENT STATE. Every control here is a form; the only interactivity is
 * a native disclosure and a submit. The permission split is drawn by rendering: `research.write`
 * gets the correction form, `research.confirm` gets the duplicate decisions, and a viewer gets
 * neither — while the Server Actions check again, because a control that is not rendered is not a
 * boundary.
 */
export const metadata = studioMetadata('/studio/research/explorer')

function one(raw: string | string[] | undefined): string {
  if (raw === undefined) return ''
  const last = Array.isArray(raw) ? raw[raw.length - 1] : raw
  return last?.trim() ?? ''
}

/**
 * A filter value that has to be one of a known set.
 *
 * THE QUERY STRING IS INPUT AND `?stage=DROP` IS A THING SOMEBODY CAN TYPE. PostgREST would refuse
 * an unknown enum value with a 400 and the page would answer 500; checking against the allowlist
 * turns a hostile parameter into an ignored one, which is the right answer to a filter that names
 * nothing.
 */
function oneOf<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const value = one(raw)
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

const STAGES = [
  'RAW',
  'NORMALIZED',
  'VALIDATED',
  'MATCHED',
  'REVIEW',
  'SHORTLISTED',
  'CONFIRMED',
] as const
const DISPOSITIONS = ['NONE', 'IGNORED', 'REJECTED', 'DUPLICATE'] as const
const SEVERITIES = ['ERROR', 'WARNING', 'INFO'] as const
const PRICE_STATES = [
  'FIXED',
  'STARTING_FROM',
  'REQUEST_QUOTE',
  'PRICE_ON_REQUEST',
  'UNKNOWN',
] as const
const PARSE_STATES = ['PARSED', 'AMBIGUOUS', 'UNPARSED', 'ABSENT'] as const

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('research.read')
  const params = await searchParams
  const client = await createClient()

  const filter = {
    sourceId: one(params.source) === '' ? undefined : one(params.source),
    stage: oneOf(params.stage, STAGES),
    disposition: oneOf(params.disposition, DISPOSITIONS),
    severity: oneOf(params.severity, SEVERITIES),
    priceState: oneOf(params.price_state, PRICE_STATES),
    currency: one(params.currency) === '' ? undefined : one(params.currency).toUpperCase(),
    dimensionParseState: oneOf(params.parse_state, PARSE_STATES),
    search: one(params.q) === '' ? undefined : one(params.q),
  }

  const [rows, sources, categories] = await Promise.all([
    listExplorerRows(client, filter),
    listResearchSources(client),
    listCategories(client),
  ])

  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))

  const sourceOptions: readonly FilterOption[] = sources.map((source) => ({
    value: source.id,
    label: source.name,
  }))
  // THE CURRENCIES OFFERED ARE THE ONES SOURCES ACTUALLY DECLARE, not an ISO list. A filter offering
  // 180 codes of which two match anything is a control that hides its own useful options.
  const currencyOptions: readonly FilterOption[] = [
    ...new Set(
      sources.map((source) => source.currency).filter((code): code is string => code !== null),
    ),
  ]
    .sort()
    .map((code) => ({ value: code, label: code }))

  const selectedId = one(params.row)
  const selected = selectedId === '' ? null : await getExplorerRow(client, selectedId)

  let drawer: {
    readonly row: ExplorerRow
    readonly version: DrawerVersion | null
    readonly issues: Awaited<ReturnType<typeof listIssuesForProduct>>
    readonly candidates: Awaited<ReturnType<typeof listCandidatesForProduct>>
  } | null = null

  if (selected !== null) {
    const [issues, candidates, version] = await Promise.all([
      listIssuesForProduct(client, selected.id),
      listCandidatesForProduct(client, selected.id),
      selected.current_version_id === null
        ? Promise.resolve(null)
        : getProductVersionById(client, selected.current_version_id),
    ])
    drawer = { row: selected, version, issues, candidates }
  }

  const canWrite = roleHasPermission(session.role, 'research.write')
  const canConfirm = roleHasPermission(session.role, 'research.confirm')

  const columns: readonly Column<ExplorerRow>[] = [
    {
      id: 'title',
      header: t('studio.research.filterTitle'),
      cell: (row) => (
        <Stack gap={1}>
          <Link href={rowHref(params, row.id)} data-row-link={row.id}>
            <Text size="sm">{row.title_normalized ?? row.source_url}</Text>
          </Link>
          <Text size="xs" tone="tertiary">
            {sourceNames.get(row.source_id) ?? row.source_id}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'stage',
      header: t('studio.research.filterStage'),
      cell: (row) => (
        <Cluster gap={1}>
          <Badge tone="neutral" data-stage={row.stage}>
            {row.stage}
          </Badge>
          {row.disposition === 'NONE' ? null : (
            <Badge tone="warning" data-disposition={row.disposition}>
              {row.disposition}
            </Badge>
          )}
        </Cluster>
      ),
    },
    {
      id: 'price',
      header: t('studio.research.filterPriceState'),
      cell: (row) => (
        <Stack gap={1}>
          <Text size="sm">
            {formatMinor(row.price_min_minor, row.currency) ?? row.price_state ?? '—'}
          </Text>
          {row.price_state === 'STARTING_FROM' && row.price_max_minor !== null ? (
            <Text size="xs" tone="tertiary">
              {`to ${formatMinor(row.price_max_minor, row.currency) ?? ''}`}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      id: 'dimensions',
      header: t('studio.research.filterParseState'),
      cell: (row) => <ParseStatePill state={row.dimension_parse_state} />,
    },
    {
      id: 'category',
      header: t('studio.research.filterSource'),
      cell: (row) =>
        row.matched_category_id === null ? (
          <Badge tone="warning" data-unmatched="">
            {t('studio.research.unmatched')}
          </Badge>
        ) : (
          <Text size="sm">
            {categoryNames.get(row.matched_category_id) ?? row.matched_category_id}
          </Text>
        ),
    },
  ]

  return (
    <StudioPage path="/studio/research/explorer">
      <Stack gap={5}>
        <UnavailableBulkToolbar />
        <ExplorerFilters
          values={{
            source: one(params.source),
            stage: one(params.stage),
            severity: one(params.severity),
            priceState: one(params.price_state),
            currency: one(params.currency),
            parseState: one(params.parse_state),
            disposition: one(params.disposition),
            q: one(params.q),
          }}
          sources={sourceOptions}
          currencies={currencyOptions}
        />

        {drawer === null ? null : (
          <ProductDrawer
            row={drawer.row}
            version={drawer.version}
            issues={drawer.issues}
            candidates={drawer.candidates}
            sourceName={sourceNames.get(drawer.row.source_id) ?? drawer.row.source_id}
            categoryName={
              drawer.row.matched_category_id === null
                ? null
                : (categoryNames.get(drawer.row.matched_category_id) ?? null)
            }
            canWrite={canWrite}
            canConfirm={canConfirm}
            overrideAction={saveOverrideAction}
            dismissAction={dismissIssueAction}
            decideAction={decideCandidateAction}
            clearDuplicateAction={clearDuplicateAction}
          />
        )}

        {/* THE EMPTY STATE IS THE TABLE'S OWN, not a branch around it. `DataTable` renders it in
            the table's place, so the caption, the column headings and the reason a screen reader
            announces stay one component's business rather than two that can disagree. */}
        <DataTable
          caption={t('studio.research.explorerHeading')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={{
            reason: 'empty',
            heading: t('studio.research.noProducts'),
            body: t('studio.research.noProductsBody'),
          }}
        />
      </Stack>
    </StudioPage>
  )
}

/**
 * The current filters, plus this row.
 *
 * THE FILTERS ARE CARRIED SO THE BACK BUTTON RETURNS TO THE LIST SOMEBODY WAS LOOKING AT. Opening a
 * row from a filtered view and coming back to an unfiltered one is the small thing that makes a
 * triage screen unusable — every row opened costs the operator their place.
 */
function rowHref(params: Record<string, string | string[] | undefined>, id: string): Route {
  const query = new URLSearchParams()
  for (const key of [
    'source',
    'stage',
    'severity',
    'price_state',
    'currency',
    'parse_state',
    'disposition',
    'q',
  ]) {
    const value = one(params[key])
    if (value !== '') query.set(key, value)
  }
  query.set('row', id)
  return `/studio/research/explorer?${query.toString()}` as Route
}
