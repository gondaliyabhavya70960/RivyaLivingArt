import Link from 'next/link'
import type { Route } from 'next'

import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { UnavailableBulkToolbar } from '@/components/studio/bulk/UnavailableToolbar'
import { ChangeDrawer, readable } from '@/components/studio/research/ChangeDrawer'
import { ChangeFilters } from '@/components/studio/research/ChangeFilters'
import { QueueShortcuts } from '@/components/studio/research/QueueShortcuts'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { CHANGE_FIELDS, MATERIALITIES, type ChangeField } from '@/lib/scraper/analytics/materiality'
import {
  getChange,
  listChanges,
  type ChangeRow,
} from '@/lib/supabase/repositories/research/changes'
import { getExplorerRow } from '@/lib/supabase/repositories/research/explorer'
import { listNotes, listProductTags, listTags } from '@/lib/supabase/repositories/research/review'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

import {
  addNoteAction,
  confirmAction,
  ignoreChangeAction,
  rejectAction,
  reviewChangeAction,
  shortlistAction,
  tagAction,
  undoActionAction,
} from './actions'

/**
 * /studio/research/changes — where somebody decides what a competitor's move means.
 *
 * THE DEFAULT VIEW IS MATERIAL AND UNDECIDED, which is the phase document's and is the whole
 * argument of the three-level classification. `NOISE` is recorded, never counted, and shown only to
 * somebody who asks for it by name — because a queue that reports a CDN rewriting an image URL
 * beside a 12 % price rise is a queue people stop reading, and an organisation that believes it is
 * watching its competitors while nobody reads the queue is worse off than one that knows it is not.
 *
 * A SERVER COMPONENT WITH ONE CLIENT ISLAND. Filters are a GET form, every action is a form posting
 * to a Server Action, and the only `'use client'` on the screen is `QueueShortcuts` — because this
 * is a surface somebody works through a hundred rows at a time and reaching for the mouse between
 * each one is the difference between a queue that gets cleared and one that does not.
 *
 * THE BULK TOOLBAR IS THE PHASE 24 ONE, NOW AVAILABLE. Phase 24 registered five research operations
 * against the single bulk engine with `available: false` exactly so that this phase would fill in a
 * `preview` and an `applyItem` rather than building a second bulk system. It did.
 */
export const metadata = studioMetadata('/studio/research/changes')

const one = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? ''

function oneOf<T extends string>(value: string | string[] | undefined, allowed: readonly T[]) {
  const raw = one(value)
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** The `?change=` parameter, refused before it reaches a uuid column. */
function changeParam(value: string | string[] | undefined): string | null {
  const raw = one(value)
  return UUID.test(raw) ? raw : null
}

const MATERIALITY_TONE: Readonly<Record<string, 'danger' | 'warning' | 'neutral'>> = {
  MATERIAL: 'danger',
  MINOR: 'warning',
  NOISE: 'neutral',
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
  const ageParam = one(params.age)
  const age = /^\d+$/u.test(ageParam) ? Number(ageParam) : undefined

  const filter = {
    ...(UUID.test(sourceParam) ? { sourceId: sourceParam } : {}),
    ...(oneOf<ChangeField>(params.field, CHANGE_FIELDS) === undefined
      ? {}
      : { field: oneOf<ChangeField>(params.field, CHANGE_FIELDS) }),
    ...(oneOf(params.materiality, MATERIALITIES) === undefined
      ? {}
      : { materiality: oneOf(params.materiality, MATERIALITIES) }),
    ...(oneOf(params.decided, ['DECIDED', 'UNDECIDED'] as const) === undefined
      ? // THE DEFAULT IS UNDECIDED, and it is applied here rather than in the repository so that
        // "show me everything" stays expressible by the filter form.
        { decided: 'UNDECIDED' as const }
      : { decided: oneOf(params.decided, ['DECIDED', 'UNDECIDED'] as const) }),
    ...(age === undefined ? {} : { withinDays: age }),
  }

  const [rows, sources, tags] = await Promise.all([
    listChanges(client, filter),
    listResearchSources(client),
    listTags(client),
  ])

  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))

  const selectedId = changeParam(params.change)
  const selected = selectedId === null ? null : await getChange(client, selectedId)

  let drawer: {
    readonly change: ChangeRow
    readonly productLabel: string
    readonly sourceName: string
    readonly notes: Awaited<ReturnType<typeof listNotes>>
    readonly appliedTagIds: ReadonlySet<string>
  } | null = null

  if (selected !== null) {
    const [product, notes, productTags] = await Promise.all([
      getExplorerRow(client, selected.research_product_id),
      listNotes(client, selected.research_product_id),
      listProductTags(client, selected.research_product_id),
    ])
    drawer = {
      change: selected,
      productLabel:
        product?.title_normalized ?? product?.source_url ?? selected.research_product_id,
      sourceName: sourceNames.get(selected.source_id) ?? selected.source_id,
      notes,
      appliedTagIds: new Set(productTags.map((row) => row.tag_id)),
    }
  }

  const canConfirm = roleHasPermission(session.role, 'research.confirm')

  const columns: readonly Column<ChangeRow>[] = [
    {
      id: 'field',
      header: t('studio.research.filterField'),
      cell: (row) => (
        <Link href={rowHref(params, row.id)} data-change-link={row.id}>
          {row.field}
        </Link>
      ),
    },
    {
      id: 'materiality',
      header: t('studio.research.filterMateriality'),
      cell: (row) => (
        <Badge tone={MATERIALITY_TONE[row.materiality] ?? 'neutral'}>{row.materiality}</Badge>
      ),
    },
    {
      id: 'before',
      header: t('studio.research.changeBefore'),
      cell: (row) => (
        <Text size="sm" tone="secondary" className="break-words">
          {readable(row.before)}
        </Text>
      ),
    },
    {
      id: 'after',
      header: t('studio.research.changeAfter'),
      cell: (row) => (
        <Text size="sm" className="break-words">
          {readable(row.after)}
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
      id: 'detected',
      header: t('studio.research.filterAge'),
      cell: (row) => <RelativeTime value={row.detected_at} />,
    },
    {
      id: 'decided',
      header: t('studio.research.filterDecided'),
      cell: (row) =>
        row.decided_action === null ? (
          <Text size="sm" tone="secondary">
            —
          </Text>
        ) : (
          <Badge tone="info">{row.decided_action}</Badge>
        ),
    },
  ]

  return (
    <StudioPage path="/studio/research/changes">
      <Stack gap={5}>
        <ChangeFilters
          values={{
            source: sourceParam,
            field: one(params.field),
            materiality: one(params.materiality),
            decided: one(params.decided),
            age: ageParam,
          }}
          sources={sources.map((source) => ({ value: source.id, label: source.name }))}
          fields={CHANGE_FIELDS.map((field) => ({ value: field, label: field }))}
        />

        <Cluster gap={3} justify="between">
          <QueueShortcuts />
          {/* THE TOOLBAR STAYS IN ITS NAMED UNAVAILABLE STATE UNTIL A SELECTION EXISTS ON THIS
              SCREEN. The five operations are implemented and available in the engine; what this
              surface does not yet carry is row selection, which is Phase 30's workspace work. A
              toolbar that offered to act on nothing would be the broken control Phase 24's
              unavailable state exists to avoid. */}
          <UnavailableBulkToolbar />
        </Cluster>

        {drawer === null ? null : (
          <ChangeDrawer
            change={drawer.change}
            productLabel={drawer.productLabel}
            sourceName={drawer.sourceName}
            notes={drawer.notes}
            tags={tags}
            appliedTagIds={drawer.appliedTagIds}
            canConfirm={canConfirm}
            actions={{
              review: reviewChangeAction,
              ignore: ignoreChangeAction,
              shortlist: shortlistAction,
              reject: rejectAction,
              confirm: confirmAction,
              note: addNoteAction,
              tag: tagAction,
              undo: undoActionAction,
            }}
          />
        )}

        <DataTable
          caption={t('studio.research.changesHeading')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={{
            reason: 'empty',
            heading: t('studio.research.changesEmpty'),
            body: t('studio.research.changesEmptyBody'),
          }}
        />
      </Stack>
    </StudioPage>
  )
}

/**
 * The current filters, plus this change.
 *
 * THE FILTERS ARE CARRIED so that opening a change and coming back returns to the list somebody was
 * working through — which on a hundred-row queue is not a nicety, it is whether the tool is usable.
 */
function rowHref(params: Record<string, string | string[] | undefined>, changeId: string): Route {
  const search = new URLSearchParams()
  for (const key of ['source', 'field', 'materiality', 'decided', 'age']) {
    const value = one(params[key])
    if (value !== '') search.set(key, value)
  }
  search.set('change', changeId)
  return `/studio/research/changes?${search.toString()}` as Route
}
