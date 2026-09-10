import { notFound } from 'next/navigation'

import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { AdapterRunPanel } from '@/components/studio/research/AdapterRunPanel'
import { VersionList } from '@/components/studio/research/VersionList'
import { listAdapterRunsForRun } from '@/lib/supabase/repositories/research/adapter-runs'
import { listFetchesForRun } from '@/lib/supabase/repositories/research/fetches'
import { listVersionsForRun } from '@/lib/supabase/repositories/research/product-versions'
import { getResearchRun } from '@/lib/supabase/repositories/research/runs'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { countWorkItemsByState } from '@/lib/supabase/repositories/research/work-items'
import { createClient } from '@/lib/supabase/server'

import { RunControls } from './controls'

/**
 * /studio/research/runs/[runId] — what this run has done, and what it may still do.
 *
 * THE FETCH LOG IS THE POINT OF THIS PAGE, and the `DISALLOWED` rows are the most important lines
 * on it. A row saying "robots.txt disallows this URL — no request was made" is the visible proof
 * that the politeness posture is a behaviour rather than a claim in a document, and it is rendered
 * as a distinct outcome rather than being folded in with the failures. A refusal is not an error.
 *
 * PHASE 27 COMPLETED IT with two panels, and the ORDER they are in is the argument. The adapter
 * panels come first because they answer the question somebody opens this page with when a run has
 * gone wrong — which source stopped, and did it take the others with it. The versions come second
 * because they answer the question somebody opens it with when it has gone right. The fetch log
 * stays last: it is the evidence, and evidence is what you read after you know what you are
 * looking for.
 *
 * A SHORT VERSION LIST IS THE NORMAL CASE. A version exists only where a page's content hash
 * differed from the last one, so a nightly run over four hundred unchanged pages produces none.
 * The empty state says that in words rather than leaving a reader to conclude the pipeline is
 * broken.
 */
export const metadata = studioMetadata('/studio/research/runs')

export default async function Page({ params }: { params: Promise<{ runId: string }> }) {
  const session = await requirePermission('research.read')
  const { runId } = await params

  const client = await createClient()
  const run = await getResearchRun(client, runId)
  if (run === null) notFound()

  const [counts, fetches, adapterRuns, versions, sources] = await Promise.all([
    countWorkItemsByState(client, runId),
    listFetchesForRun(client, runId, 100),
    listAdapterRunsForRun(client, runId),
    listVersionsForRun(client, runId, 50),
    listResearchSources(client),
  ])

  // Source id → name, so a panel is headed by a source rather than by a uuid. One read for the
  // whole page: a run touches one source today, and reading the list is cheaper than a join that
  // would have to be repeated per panel when it touches several.
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))

  const mayWrite = roleHasPermission(session.role, 'research.write')
  const isActive = run.status === 'QUEUED' || run.status === 'RUNNING'

  return (
    <StudioPage path="/studio/research/runs">
      <Stack gap={8}>
        <Surface level={1} className="p-6">
          <PageHeader level={2} title={run.id.slice(0, 8)} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge tone={run.status === 'FAILED' ? 'danger' : 'neutral'}>{run.status}</Badge>
            <Badge tone="neutral">{run.trigger}</Badge>
            {run.is_dry_run ? <Badge tone="neutral">dry run</Badge> : null}
            {Object.entries(counts).map(([state, count]) => (
              <Badge key={state} tone="neutral" data-queue-state={state}>
                {`${state}: ${count}`}
              </Badge>
            ))}
          </div>
          {run.error_summary === null ? null : (
            <Text tone="secondary" className="mt-3">
              {run.error_summary}
            </Text>
          )}
        </Surface>

        {mayWrite ? (
          <RunControls
            runId={run.id}
            isActive={isActive}
            hasFailures={(counts['FAILED'] ?? 0) > 0}
          />
        ) : null}

        <AdapterRunPanel adapterRuns={adapterRuns} sourceNames={sourceNames} />

        <VersionList versions={versions} />

        <Surface level={1} className="p-6">
          <PageHeader level={2} title="Fetches" />
          {fetches.length === 0 ? (
            <Text tone="secondary" className="mt-3">
              {t('studio.research.noRunsBody')}
            </Text>
          ) : (
            <div className="mt-4 max-h-96 overflow-y-auto border border-line">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Fetches</caption>
                <thead className="sticky top-0 bg-surface-raised">
                  <tr>
                    <th scope="col" className="p-2 text-left">
                      URL
                    </th>
                    <th scope="col" className="p-2 text-left">
                      robots
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Status
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Bytes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fetches.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-line"
                      data-fetch-id={row.id}
                      data-robots-decision={row.robots_decision}
                    >
                      <td className="p-2 font-mono text-xs break-all">{row.url}</td>
                      <td className="p-2">
                        {/* A REFUSAL IS NOT A FAILURE, and is not toned as one. It is the system
                            doing exactly what it promised. */}
                        <Badge tone={row.robots_decision === 'ERROR' ? 'danger' : 'neutral'}>
                          {row.robots_decision}
                        </Badge>
                        {row.robots_decision === 'DISALLOWED' ? (
                          <span className="ml-2 text-xs text-ink-secondary">
                            {t('studio.research.disallowedNote')}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2">{row.http_status ?? '—'}</td>
                      <td className="p-2 text-ink-secondary">{row.bytes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </Stack>
    </StudioPage>
  )
}
