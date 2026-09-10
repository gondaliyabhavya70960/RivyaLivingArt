import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listResearchRuns } from '@/lib/supabase/repositories/research/runs'
import { createClient } from '@/lib/supabase/server'

/**
 * /studio/research/runs — every execution, newest first.
 *
 * NO POLLING ON THE LIST. The phase document asks for "a live-ish status that polls at 10-second
 * intervals", and that belongs on the detail page of the run somebody is actually watching, not on
 * a list of twenty-five that would re-query the database six times a minute for rows nobody is
 * looking at. The list is a Server Component and reloads when the operator does.
 */
export const metadata = studioMetadata('/studio/research/runs')

const ACTIVE = new Set(['QUEUED', 'RUNNING'])

export default async function Page() {
  await requirePermission('research.read')
  const client = await createClient()
  const runs = await listResearchRuns(client, 25)

  return (
    <StudioPage path="/studio/research/runs">
      <Stack gap={8}>
        {runs.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noRuns')}
            body={t('studio.research.noRunsBody')}
          />
        ) : (
          <Surface level={1} className="p-6">
            <PageHeader level={2} title={t('studio.research.runsHeading')} />
            <ul className="mt-4 list-none" data-run-list>
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line py-2 text-sm"
                  data-run-id={run.id}
                  data-run-status={run.status}
                >
                  <a
                    href={`/studio/research/runs/${run.id}`}
                    className="font-mono underline underline-offset-4"
                  >
                    {run.id.slice(0, 8)}
                  </a>
                  <Badge tone={run.status === 'FAILED' ? 'danger' : 'neutral'}>{run.status}</Badge>
                  {run.is_dry_run ? <Badge tone="neutral">dry run</Badge> : null}
                  {ACTIVE.has(run.status) ? <Badge tone="neutral">{run.trigger}</Badge> : null}
                  <span className="ml-auto text-ink-secondary">{run.queued_at}</span>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </Stack>
    </StudioPage>
  )
}
