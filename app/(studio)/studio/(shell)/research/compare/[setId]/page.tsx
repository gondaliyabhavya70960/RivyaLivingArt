import { notFound } from 'next/navigation'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import {
  AssortmentPanel,
  DimensionsPanel,
  PricePanel,
} from '@/components/studio/research/AnalysisPanels'
import { ComparisonBuilder } from '@/components/studio/research/ComparisonBuilder'
import { DeleteSetButton } from '@/components/studio/research/DeleteSetButton'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import {
  getComparisonSet,
  latestRunId,
  latestSnapshots,
  listMembers,
} from '@/lib/supabase/repositories/research/analytics'
import { getResearchProduct } from '@/lib/supabase/repositories/research/products'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

import {
  addMemberAction,
  deleteSetFormAction,
  moveMemberAction,
  recomputeSetAction,
  removeMemberAction,
  updateSetAction,
} from '../actions'

/**
 * /studio/research/compare/[setId] — the workbench: Members, Assortment, Price architecture,
 * Dimensions, each panel headed by its coverage badge.
 *
 * EVERYTHING DRAWN HERE IS READ FROM A SNAPSHOT. The page never scans the corpus; it renders the
 * newest snapshot per (family, currency) for this set and says when it was computed and from how
 * many rows. Recompute is an explicit action — a button a person presses — so two readers an hour
 * apart see the same numbers.
 *
 * "THE CORPUS HAS GROWN SINCE" is stated, not inferred by the reader: the snapshot stores the
 * newest run id it could have seen, and if the corpus has a newer run the stale line renders.
 */
export const metadata = studioMetadata('/studio/research/compare')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const BASE_PATH = '/studio/research/compare'

export default async function Page({ params }: { readonly params: Promise<{ setId: string }> }) {
  const session = await requirePermission('research.read')
  const { setId } = await params
  if (!UUID.test(setId)) notFound()

  const client = await createClient()
  const set = await getComparisonSet(client, setId)
  if (set === null) notFound()

  const [members, sources, snapshots, newestRun] = await Promise.all([
    listMembers(client, set.id),
    listResearchSources(client),
    latestSnapshots(client, { scopeType: 'SET', scopeId: set.id }),
    latestRunId(client),
  ])

  // Titles for the individual rows, resolved one by one: a set holds a handful of them, and a
  // batch read for a handful is a second code path for no gain.
  const productLabels = new Map<string, string>()
  for (const member of members) {
    if (member.research_product_id === null) continue
    const product = await getResearchProduct(client, member.research_product_id)
    if (product !== null) {
      productLabels.set(member.research_product_id, product.title_normalized ?? product.source_url)
    }
  }

  const canWrite = roleHasPermission(session.role, 'research.write')
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))

  const assortment = snapshots.find((row) => row.metric_family === 'ASSORTMENT') ?? null
  const dimensions = snapshots.find((row) => row.metric_family === 'DIMENSIONS') ?? null
  const prices = snapshots
    .filter((row) => row.metric_family === 'PRICE_ARCHITECTURE')
    .sort((a, b) => (a.currency ?? '').localeCompare(b.currency ?? ''))
  const newest = snapshots[0] ?? null
  const stale =
    newest !== null &&
    newestRun !== null &&
    newest.input_run_max_id !== null &&
    newest.input_run_max_id !== newestRun

  return (
    <StudioPage path={BASE_PATH}>
      <Stack gap={6}>
        <Surface level={1} className="p-6" data-set-header={set.slug}>
          <Stack gap={3}>
            <PageHeader level={2} title={set.name} description={set.scope_note ?? undefined} />
            <Cluster gap={3}>
              <Badge tone="neutral">{`${t('studio.research.compareBandRule')}: ${set.band_rule}`}</Badge>
              {set.band_edges === null ? null : (
                <Badge tone="neutral">{set.band_edges.join(', ')}</Badge>
              )}
              {newest === null ? (
                <Badge tone="warning" data-never-computed="">
                  {t('studio.research.compareNeverComputed')}
                </Badge>
              ) : (
                <Badge tone="neutral" data-computed-from={String(newest.row_count)}>
                  {`${t('studio.research.compareComputedFrom')} ${String(newest.row_count)} ${t('studio.research.compareRowsOn')} ${newest.computed_at.slice(0, 10)}`}
                </Badge>
              )}
              {stale ? (
                <Badge tone="warning" data-stale="">
                  {t('studio.research.compareStale')}
                </Badge>
              ) : null}
            </Cluster>
            {canWrite ? (
              <Cluster gap={3}>
                <ActionForm action={recomputeSetAction}>
                  <input type="hidden" name="set_id" value={set.id} />
                  <Button type="submit" variant="primary" data-recompute="">
                    {t('studio.research.compareRecompute')}
                  </Button>
                </ActionForm>
                <DeleteSetButton
                  setId={set.id}
                  action={deleteSetFormAction}
                  labels={{
                    button: t('studio.research.compareDelete'),
                    title: t('studio.research.compareDeleteTitle'),
                    body: t('studio.research.compareDeleteBody'),
                    confirm: t('studio.research.compareDelete'),
                    cancel: t('studio.content.section.cancelLabel'),
                    close: t('studio.content.section.closeLabel'),
                  }}
                />
              </Cluster>
            ) : null}
          </Stack>
        </Surface>

        <ComparisonBuilder
          setId={set.id}
          members={members}
          sources={sources.map((source) => ({ id: source.id, name: source.name }))}
          productLabels={productLabels}
          canWrite={canWrite}
          actions={{ add: addMemberAction, remove: removeMemberAction, move: moveMemberAction }}
        />

        {newest === null ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.compareNoSnapshot')}
            body={t('studio.research.compareSetsEmptyBody')}
          />
        ) : (
          <>
            {assortment === null ? null : (
              <AssortmentPanel snapshot={assortment} sourceNames={sourceNames} />
            )}
            {prices.map((snapshot) => (
              <PricePanel key={snapshot.id} snapshot={snapshot} multiCurrency={prices.length > 1} />
            ))}
            {dimensions === null ? null : <DimensionsPanel snapshot={dimensions} />}
          </>
        )}

        {canWrite ? (
          <Surface level={1} className="p-6" data-set-settings="">
            <Stack gap={4}>
              <PageHeader level={2} title={t('studio.research.compareBandRule')} />
              <ActionForm action={updateSetAction}>
                <input type="hidden" name="set_id" value={set.id} />
                <Stack gap={3}>
                  <Cluster gap={3} align="end">
                    <label className="flex min-w-56 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareName')}
                      </Text>
                      <Input name="name" defaultValue={set.name} required />
                    </label>
                    <label className="flex min-w-56 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareBandRule')}
                      </Text>
                      <Select name="band_rule" defaultValue={set.band_rule}>
                        <option value="QUANTILE">
                          {t('studio.research.compareBandRuleQuantile')}
                        </option>
                        <option value="FIXED">{t('studio.research.compareBandRuleFixed')}</option>
                      </Select>
                    </label>
                    <label className="flex min-w-56 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareBandEdges')}
                      </Text>
                      <Input name="band_edges" defaultValue={set.band_edges?.join(', ') ?? ''} />
                    </label>
                  </Cluster>
                  <Cluster gap={3} align="end">
                    <label className="flex min-w-72 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareScopeNote')}
                      </Text>
                      <Input name="scope_note" defaultValue={set.scope_note ?? ''} />
                    </label>
                    <label className="flex min-w-72 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareDescription')}
                      </Text>
                      <Input name="description" defaultValue={set.description ?? ''} />
                    </label>
                    <Button type="submit" variant="secondary">
                      {t('studio.research.apply')}
                    </Button>
                  </Cluster>
                </Stack>
              </ActionForm>
            </Stack>
          </Surface>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
