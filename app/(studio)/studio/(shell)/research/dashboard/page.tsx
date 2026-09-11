import { Badge } from '@/components/primitives/Badge'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { coverage, tallyThreeValued } from '@/lib/scraper/analytics/coverage'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { isEnabled } from '@/lib/flags'
import { STAGE_ORDER } from '@/lib/scraper/core/stage'
import { HealthPill } from '@/components/studio/research/HealthPill'
import { SourceCoveragePanel } from '@/components/studio/research/SourceCoveragePanel'
import { countProductsByStage } from '@/lib/supabase/repositories/research/products'
import { listResearchRuns } from '@/lib/supabase/repositories/research/runs'
import { countUndecided, oldestUndecided } from '@/lib/supabase/repositories/research/changes'
import { countSourceCoverage } from '@/lib/supabase/repositories/research/analytics'
import { listScaleRows } from '@/lib/supabase/repositories/research/scale'
import { countStaleEntries } from '@/lib/supabase/repositories/research/shortlist'
import { latestDigest } from '@/lib/supabase/repositories/research/digests'
import { countUnresolvedCategoryMappings } from '@/lib/supabase/repositories/research/source-config'
import { listSourceHealth } from '@/lib/supabase/repositories/research/source-health'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { countPendingWorkItems } from '@/lib/supabase/repositories/research/work-items'
import { createClient } from '@/lib/supabase/server'

/**
 * /studio/research/dashboard — run health, queue depth, source freshness, stage counts.
 *
 * EVERY NUMBER ON THIS PAGE IS ZERO UNTIL A SOURCE IS APPROVED, and the page says so in words
 * rather than rendering a row of zeroes and letting an operator wonder whether it is broken. That
 * is the shipped state: this repository seeds no source, because a source is an assertion that
 * Rivya may read somebody else's website and only the owner can make it.
 *
 * THE KILL SWITCH IS SURFACED FIRST when it is off. A researcher looking at a queue that is not
 * moving needs to know the master switch is down before they go looking at politeness settings,
 * and it is the single most common reason for a still queue.
 *
 * PHASE 29 ADDS THE DIGEST AND, ABOVE IT, THE ONE NUMBER THAT MAKES A STALLED QUEUE UNDENIABLE:
 * the DATE of the oldest undecided change. A count can sit at forty for a month and read as steady
 * state; "the oldest undecided change is from 3 August" cannot be read as anything but a backlog,
 * and a review queue people quietly stop reading is the risk that whole phase is arranged against.
 *
 * PHASE 26 ADDS TWO FIGURES AND BOTH ARE GAPS RATHER THAN ACHIEVEMENTS. Health comes from the
 * derived view, so a source that has stopped running says so here without anything having to
 * remember to write it down. The unmapped-category count is the number of labels a source has
 * shown Rivya that nobody has decided about — every one of them is a row Phase 28 will stop at
 * `VALIDATED`, and the whole reason it is counted is that guessing instead would be silent.
 */
export const metadata = studioMetadata('/studio/research/dashboard')

export default async function Page() {
  await requirePermission('research.read')

  const client = await createClient()
  const [
    sources,
    runs,
    pending,
    stages,
    researchOn,
    health,
    unmapped,
    digest,
    undecided,
    oldest,
    scaleRows,
    sourceCoverage,
    staleEntries,
  ] = await Promise.all([
    listResearchSources(client),
    listResearchRuns(client, 10),
    countPendingWorkItems(client),
    countProductsByStage(client),
    isEnabled('research_enabled'),
    listSourceHealth(client),
    countUnresolvedCategoryMappings(client),
    latestDigest(client),
    countUndecided(client),
    oldestUndecided(client),
    listScaleRows(client, { limit: 5_000 }),
    countSourceCoverage(client),
    // Phase 35: entries open longer than 60 days — the shortlist's graveyard count.
    countStaleEntries(client, 60),
  ])

  /*
   * PHASE 30'S TILES, AND THE UNKNOWN BUCKET IS ONE OF THREE RATHER THAN AN ERROR COUNT.
   *
   * A dashboard that showed "18 large" and "204 not large" would be read as a complete picture,
   * and on a corpus of other people's web pages the third number is usually the biggest one.
   * Coverage sits beside them for the same reason: every figure here is conditional on how many
   * rows had measurements at all.
   */
  const largeTally = tallyThreeValued(scaleRows.map((row) => row.is_large_format))
  const scaleCoverage = coverage(
    scaleRows.length,
    scaleRows.filter((row) => row.dimension_parse_state === 'PARSED').length,
  )

  const stats = (digest?.stats ?? {}) as {
    productsDiscovered?: number
    productsDisappeared?: number
    materialChangeTotal?: number
    materialChangesByField?: Record<string, number>
  }

  const healthById = new Map(health.map((entry) => [entry.sourceId, entry]))

  /*
   * PHASE 31'S COVERAGE PANEL — the honest header every analysis inherits. Captured, priced and
   * parsed are counted here; health is READ from Phase 26's view rather than recomputed, so the
   * dashboard cannot disagree with the sources page about what "failing" means.
   */
  const coverageById = new Map(sourceCoverage.map((entry) => [entry.sourceId, entry]))
  const coverageEntries = sources.map((source) => ({
    sourceId: source.id,
    name: source.name,
    captured: coverageById.get(source.id)?.captured ?? 0,
    priced: coverageById.get(source.id)?.priced ?? 0,
    parsed: coverageById.get(source.id)?.parsed ?? 0,
    health: healthById.get(source.id) ?? null,
  }))

  const approved = sources.filter((source) => source.policy_status === 'APPROVED')

  return (
    <StudioPage path="/studio/research/dashboard">
      <Stack gap={8}>
        {researchOn ? null : (
          <EmptyState
            reason="empty"
            heading={t('studio.research.killSwitchOff')}
            body={t('studio.research.killSwitchOffBody')}
          />
        )}

        {approved.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noSources')}
            body={t('studio.research.noSourcesBody')}
          />
        ) : null}

        <SourceCoveragePanel entries={coverageEntries} />

        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.research.stagesHeading')} />
          {/* THE SEVEN STAGES, ALWAYS ALL SEVEN, including the ones with no rows. A pipeline that
              renders only the stages it has rows for is a pipeline whose shape changes as it
              fills, and the shape is the thing an operator is learning. */}
          <div className="mt-4 flex flex-wrap gap-3" data-stage-counts>
            {STAGE_ORDER.map((stage) => (
              <Badge key={stage} tone="neutral" data-stage={stage}>
                {`${stage}: ${stages[stage] ?? 0}`}
              </Badge>
            ))}
          </div>
          <Text tone="secondary" className="mt-4">
            {`${pending} ${t('studio.research.queueDepth')}`}
          </Text>
          {/* COUNTED EVEN WHEN IT IS ZERO. A figure that appears only when it is non-zero is a
              figure nobody learns to look for. */}
          <Text tone="secondary" className="mt-2" data-unmapped-categories={String(unmapped)}>
            {`${unmapped} ${t('studio.research.unmappedCount')}`}
          </Text>
        </Surface>

        <Surface level={1} className="p-6" data-stale-shortlist-panel={String(staleEntries)}>
          <Stack gap={1}>
            <PageHeader level={2} title={t('studio.research.slStaleHeading')} />
            <Text size="sm">{String(staleEntries)}</Text>
            <Text size="xs" tone="secondary">
              {t('studio.research.slStaleBody')}
            </Text>
          </Stack>
        </Surface>

        <Surface level={1} className="p-6" data-large-format-panel="">
          <PageHeader level={2} title={t('studio.research.largeFormatHeading')} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge tone="neutral" data-large-yes={String(largeTally.yes)}>
              {`${String(largeTally.yes)} ${t('studio.research.tallyLarge')}`}
            </Badge>
            <Badge tone="neutral" data-large-no={String(largeTally.no)}>
              {`${String(largeTally.no)} ${t('studio.research.tallyNotLarge')}`}
            </Badge>
            {/* THE THIRD VALUE, ALWAYS DRAWN. On a corpus of other people's pages it is usually
                the biggest of the three, and a dashboard showing only two would be read as a
                complete picture. */}
            <Badge tone="warning" data-large-unknown={String(largeTally.unknown)}>
              {`${String(largeTally.unknown)} ${t('studio.research.tallyUnknown')}`}
            </Badge>
            <Badge tone={scaleCoverage.pct < 50 ? 'warning' : 'neutral'} data-scale-coverage="">
              {`${String(scaleCoverage.pct)}% ${t('studio.research.coverageMeasured')}`}
            </Badge>
          </div>
          <Text tone="secondary" className="mt-3">
            {t('studio.research.tallyNote')}
          </Text>
        </Surface>

        <Surface level={1} className="p-6" data-digest-panel="">
          <PageHeader level={2} title={t('studio.research.digestHeading')} />
          {digest === null ? (
            <Text tone="secondary" className="mt-3">
              {t('studio.research.digestNone')}
            </Text>
          ) : (
            <Stack gap={2} className="mt-4">
              <div className="flex flex-wrap gap-3">
                <Badge tone="neutral" data-digest-changes="">
                  {`${stats.materialChangeTotal ?? 0} material`}
                </Badge>
                <Badge tone="neutral" data-digest-discovered="">
                  {`${stats.productsDiscovered ?? 0} ${t('studio.research.digestDiscovered')}`}
                </Badge>
                <Badge tone="neutral" data-digest-disappeared="">
                  {`${stats.productsDisappeared ?? 0} ${t('studio.research.digestDisappeared')}`}
                </Badge>
              </div>
              {Object.keys(stats.materialChangesByField ?? {}).length === 0 ? null : (
                <div className="flex flex-wrap gap-2" data-digest-fields="">
                  {Object.entries(stats.materialChangesByField ?? {}).map(([field, count]) => (
                    <Badge key={field} tone="neutral">{`${field}: ${String(count)}`}</Badge>
                  ))}
                </div>
              )}
            </Stack>
          )}

          {/* THE DATE, NOT THE COUNT, IS THE POINT OF THIS LINE. Rendered even at zero, for the
              reason the unmapped-category count is: a figure that appears only when it is
              non-zero is a figure nobody learns to look for. */}
          <Text tone="secondary" className="mt-4" data-oldest-undecided="">
            {`${undecided} ${t('studio.research.digestOldest')}`}
          </Text>
          {oldest === null ? null : (
            <Text tone="secondary" className="mt-1">
              <RelativeTime value={oldest.detected_at} />
            </Text>
          )}
        </Surface>

        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.research.sourcesHeading')} />
          {sources.length === 0 ? (
            <Text tone="secondary" className="mt-3">
              {t('studio.research.noSourcesBody')}
            </Text>
          ) : (
            <ul className="mt-4 list-none" data-source-list>
              {sources.map((source) => (
                <li
                  key={source.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line py-2 text-sm"
                  data-source-id={source.id}
                >
                  <span className="flex-1">{source.name}</span>
                  <HealthPill health={healthById.get(source.id)?.health ?? null} />
                  <Badge tone={source.policy_status === 'APPROVED' ? 'neutral' : 'danger'}>
                    {source.policy_status}
                  </Badge>
                  <Badge tone={source.is_enabled ? 'neutral' : 'danger'}>
                    {source.is_enabled ? 'enabled' : 'disabled'}
                  </Badge>
                  {source.circuit_open_until === null ? null : <Badge tone="danger">paused</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.research.runsHeading')} />
          {runs.length === 0 ? (
            <Text tone="secondary" className="mt-3">
              {t('studio.research.noRunsBody')}
            </Text>
          ) : (
            <ul className="mt-4 list-none" data-run-list>
              {runs.map((run) => (
                <li key={run.id} className="border-b border-line py-2 text-sm" data-run-id={run.id}>
                  <a
                    href={`/studio/research/runs/${run.id}`}
                    className="underline underline-offset-4"
                  >
                    {run.id.slice(0, 8)}
                  </a>
                  <span className="ml-3">{run.status}</span>
                  <span className="ml-3 text-ink-secondary">{run.queued_at}</span>
                  {run.is_dry_run ? <span className="ml-3 text-ink-secondary">dry run</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.research.politeness')} />
          <Text tone="secondary" className="mt-3">
            {t('studio.research.politenessBody')}
          </Text>
        </Surface>
      </Stack>
    </StudioPage>
  )
}
