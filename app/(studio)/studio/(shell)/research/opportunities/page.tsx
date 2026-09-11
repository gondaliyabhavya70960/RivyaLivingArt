import Link from 'next/link'
import type { Route } from 'next'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { ScoreExplain } from '@/components/studio/research/ScoreExplain'
import { ScoringModelPanel } from '@/components/studio/research/ScoringModelPanel'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { rankMovement, type RankMovement } from '@/lib/scraper/analytics/opportunity/rank'
import type { SignalKey } from '@/lib/scraper/analytics/opportunity/model'
import { listCategories } from '@/lib/supabase/repositories/categories'
import {
  getScore,
  listComponents,
  listLatestComponents,
  listLatestScores,
  listScoringModels,
  tallyExclusions,
  toScoringModel,
  type RankedScore,
} from '@/lib/supabase/repositories/research/opportunity'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

import { activateModelFormAction, createDraftModelAction, recomputeScoresAction } from './actions'

/**
 * /studio/research/opportunities — the ranked table, the explain drawer, the model panel.
 *
 * THE HEADER STATES THE MODEL VERSION AND THE DATE OF THE LAST RUN ON EVERY LOAD, so no score is
 * ever read without its provenance. The default filter is `state = SCORED`; the INSUFFICIENT_DATA
 * tab is visible, not hidden, because a low score and an absent score mean opposite things.
 *
 * NOTHING HERE COMPUTES. The table renders stored score rows; the drawer renders stored component
 * rows; the diff re-weights stored components. Recompute is a button.
 */
export const metadata = studioMetadata('/studio/research/opportunities')

const BASE_PATH = '/studio/research/opportunities'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const STALE_DAYS = 14
const one = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? ''

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('research.read')
  const params = await searchParams
  const client = await createClient()

  const [modelRows, sources, categories] = await Promise.all([
    listScoringModels(client),
    listResearchSources(client),
    listCategories(client),
  ])
  const models = modelRows.map(toScoringModel)
  const active = models.find((model) => model.lifecycle === 'ACTIVE') ?? null
  const selectedVersion = one(params.model)
  const selected = models.find((model) => model.version === selectedVersion) ?? active

  const state = one(params.state) === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'SCORED'
  const sourceParam = one(params.source)
  const categoryParam = one(params.category)

  const scores =
    selected === null
      ? []
      : await listLatestScores(client, selected.id, {
          state,
          ...(UUID.test(sourceParam) ? { sourceId: sourceParam } : {}),
          ...(UUID.test(categoryParam) ? { categoryId: categoryParam } : {}),
        })

  const lastComputed = scores[0]?.computed_at ?? null
  const stale =
    lastComputed !== null &&
    new Date().getTime() - Date.parse(lastComputed) > STALE_DAYS * 86_400_000

  const rowParam = one(params.row)
  const openScore = UUID.test(rowParam) ? await getScore(client, rowParam) : null
  const openComponents = openScore === null ? [] : await listComponents(client, openScore.id)
  const openTitle =
    openScore === null
      ? ''
      : (scores.find((score) => score.id === openScore.id)?.title_normalized ??
        openScore.research_product_id)

  const canManage = roleHasPermission(session.role, 'research.score.manage')
  const canWrite = roleHasPermission(session.role, 'research.write')

  // The rank-movement diff for every draft, re-weighted from the active model's stored components.
  const diffs = new Map<string, RankMovement>()
  if (canManage && active !== null) {
    const stored = (await listLatestComponents(client, active.id)).map((entry) => ({
      productId: entry.productId,
      completeness: entry.completeness,
      components: entry.components.map((component) => ({
        signalKey: component.signalKey as SignalKey,
        normalised: component.normalised,
      })),
    }))
    for (const model of models.filter((candidate) => candidate.lifecycle === 'DRAFT')) {
      diffs.set(model.id, rankMovement(stored, active, model))
    }
  }
  const exclusions = active === null ? [] : await tallyExclusions(client, active.id)

  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))
  const categoryNames = new Map(categories.map((category) => [category.id, category.slug]))
  const query = (extra: Record<string, string>): string => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries({
      model: selectedVersion,
      state: one(params.state),
      source: sourceParam,
      category: categoryParam,
      ...extra,
    })) {
      if (value !== '') search.set(key, value)
    }
    const text = search.toString()
    return text === '' ? BASE_PATH : `${BASE_PATH}?${text}`
  }

  const columns: readonly Column<RankedScore & { rank: number }>[] = [
    {
      id: 'rank',
      header: t('studio.research.oppRank'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.rank)}</Text>,
    },
    {
      id: 'title',
      header: t('studio.research.filterTitle'),
      cell: (row) => (
        <Text size="sm" className="break-words">
          {row.title_normalized ?? row.research_product_id}
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
      id: 'category',
      header: t('studio.research.oppCategory'),
      cell: (row) => (
        <Text size="sm" tone="secondary">
          {row.matched_category_id === null
            ? '—'
            : (categoryNames.get(row.matched_category_id) ?? row.matched_category_id)}
        </Text>
      ),
    },
    {
      id: 'band',
      header: t('studio.research.filterBand'),
      cell: (row) => (
        <Text size="sm" tone="secondary">
          {row.scale_band ?? '—'}
        </Text>
      ),
    },
    {
      id: 'score',
      header: t('studio.research.oppScore'),
      numeric: true,
      cell: (row) => <Text size="sm">{row.score === null ? '—' : String(row.score)}</Text>,
    },
    {
      id: 'confidence',
      header: t('studio.research.oppConfidence'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.confidence)}</Text>,
    },
    {
      id: 'state',
      header: t('studio.research.oppState'),
      cell: (row) => (
        <Badge tone={row.state === 'SCORED' ? 'neutral' : 'warning'}>{row.state}</Badge>
      ),
    },
    {
      id: 'explain',
      header: t('studio.research.oppExplain'),
      cell: (row) => (
        <Link
          href={query({ row: row.id }) as Route}
          className="text-sm underline underline-offset-4"
          data-explain-link={row.id}
        >
          {t('studio.research.oppExplain')}
        </Link>
      ),
    },
  ]
  const ranked = scores.map((score, index) => ({ ...score, rank: index + 1 }))

  return (
    <StudioPage path={BASE_PATH}>
      <Stack gap={6}>
        <Surface level={1} className="p-6" data-opp-header="">
          <Stack gap={3}>
            <PageHeader
              level={2}
              title={t('studio.research.oppHeading')}
              description={t('studio.research.oppBody')}
            />
            <Cluster gap={3}>
              {active === null ? (
                <Badge tone="warning" data-no-active-model="">
                  {t('studio.research.oppNoActiveModel')}
                </Badge>
              ) : (
                <Badge
                  tone="info"
                  data-active-model={active.version}
                >{`${t('studio.research.oppActiveModel')}: ${active.version}`}</Badge>
              )}
              <Badge
                tone="neutral"
                data-last-run={lastComputed ?? ''}
              >{`${t('studio.research.oppLastRun')}: ${lastComputed === null ? t('studio.research.oppNeverRun') : lastComputed.slice(0, 16).replace('T', ' ')}`}</Badge>
              {stale ? (
                <Badge tone="warning" data-stale="">
                  {t('studio.research.oppStale')}
                </Badge>
              ) : null}
              {selected !== null && selected.id !== active?.id ? (
                <Badge tone="neutral">{`${t('studio.research.oppVersion')} ${selected.version}`}</Badge>
              ) : null}
            </Cluster>
            {canWrite && active !== null ? (
              <ActionForm action={recomputeScoresAction}>
                <Button type="submit" variant="primary" data-recompute-scores="">
                  {t('studio.research.oppRecompute')}
                </Button>
              </ActionForm>
            ) : null}
          </Stack>
        </Surface>

        <form method="get">
          <Cluster gap={3} align="end">
            <label className="flex min-w-40 flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.oppVersion')}
              </Text>
              <Select name="model" defaultValue={selected?.version ?? ''}>
                {models.map((model) => (
                  <option
                    key={model.id}
                    value={model.version}
                  >{`${model.version} (${model.lifecycle})`}</option>
                ))}
              </Select>
            </label>
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
                {t('studio.research.oppCategory')}
              </Text>
              <Select name="category" defaultValue={categoryParam}>
                <option value="">{t('studio.research.filterAll')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.slug}
                  </option>
                ))}
              </Select>
            </label>
            <input type="hidden" name="state" value={state} />
            <Button type="submit" variant="secondary">
              {t('studio.research.apply')}
            </Button>
          </Cluster>
        </form>

        <Cluster gap={2} data-state-tabs="">
          <Link
            href={query({ state: 'SCORED' }) as Route}
            className="text-sm underline underline-offset-4"
            data-tab="SCORED"
            aria-current={state === 'SCORED' ? 'page' : undefined}
          >
            {t('studio.research.oppTabScored')}
          </Link>
          <Link
            href={query({ state: 'INSUFFICIENT_DATA' }) as Route}
            className="text-sm underline underline-offset-4"
            data-tab="INSUFFICIENT_DATA"
            aria-current={state === 'INSUFFICIENT_DATA' ? 'page' : undefined}
          >
            {t('studio.research.oppTabInsufficient')}
          </Link>
        </Cluster>
        {state === 'INSUFFICIENT_DATA' ? (
          <Text size="xs" tone="secondary">
            {t('studio.research.oppInsufficientBody')}
          </Text>
        ) : null}

        {openScore === null ? null : (
          <ScoreExplain score={openScore} components={openComponents} title={openTitle} />
        )}

        {selected === null ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.oppEmpty')}
            body={t('studio.research.oppEmptyBody')}
          />
        ) : (
          <DataTable
            caption={t('studio.research.oppHeading')}
            columns={columns}
            rows={ranked}
            rowKey={(row) => row.id}
            empty={{
              reason: 'empty',
              heading: t('studio.research.oppEmpty'),
              body: t('studio.research.oppEmptyBody'),
            }}
          />
        )}

        {exclusions.length === 0 ? null : (
          <Surface level={1} className="p-6" data-exclusions-panel="">
            <Stack gap={3}>
              <PageHeader
                level={2}
                title={t('studio.research.oppExclusionsHeading')}
                description={t('studio.research.oppExclusionsBody')}
              />
              <Stack gap={1}>
                {exclusions.slice(0, 20).map((entry) => (
                  <Text key={`${entry.signalKey}-${entry.reason}`} size="xs" tone="secondary">
                    {`${entry.signalKey} · ${entry.reason}: ${String(entry.count)}`}
                  </Text>
                ))}
              </Stack>
            </Stack>
          </Surface>
        )}

        {canManage ? (
          <ScoringModelPanel
            models={models}
            diffs={diffs}
            actions={{ createDraft: createDraftModelAction }}
            activateAction={activateModelFormAction}
          />
        ) : null}
      </Stack>
    </StudioPage>
  )
}
