import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listResearchJobs } from '@/lib/supabase/repositories/research/jobs'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

/**
 * /studio/research/jobs — the standing definitions, and when each next fires.
 *
 * A JOB WITH NO NEXT RUN IS SHOWN AS SUCH, IN WORDS. `next_run_at` is null either because the job
 * is switched off or because its cron expression did not parse, and both look identical from the
 * outside — so the row shows the expression beside the time, which is the pair an operator needs
 * to spot the second case. A job silently never firing is the failure this display exists for.
 *
 * READ-ONLY IN THIS PHASE. Creating and editing a job is Phase 26's source-management surface,
 * where the URL patterns and category mappings a real job needs are also built; a half-form here
 * would be a second place to define the same thing.
 */
export const metadata = studioMetadata('/studio/research/jobs')

export default async function Page() {
  await requirePermission('research.read')
  const client = await createClient()

  const [jobs, sources] = await Promise.all([listResearchJobs(client), listResearchSources(client)])
  const sourceName = new Map(sources.map((source) => [source.id, source.name]))

  return (
    <StudioPage path="/studio/research/jobs">
      <Stack gap={8}>
        {jobs.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noJobs')}
            body={t('studio.research.noJobsBody')}
          />
        ) : (
          <Surface level={1} className="p-6">
            <PageHeader level={2} title={t('studio.research.jobsHeading')} />
            <div className="mt-4 overflow-x-auto border border-line">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t('studio.research.jobsHeading')}</caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th scope="col" className="p-2 text-left">
                      Name
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Source
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Kind
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Schedule
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Next
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-t border-line" data-job-id={job.id}>
                      <td className="p-2">{job.name}</td>
                      <td className="p-2">{sourceName.get(job.source_id) ?? job.source_id}</td>
                      <td className="p-2">
                        <Badge tone="neutral">{job.job_type}</Badge>
                      </td>
                      <td className="p-2 font-mono text-xs">{job.cron_expression ?? '—'}</td>
                      {/* THE PAIR, NOT JUST THE TIME. A null next run beside a real expression is a
                          job whose schedule did not parse; a null beside a null is a job that is
                          simply off. Showing only one of the two makes those indistinguishable. */}
                      <td className="p-2 text-ink-secondary">
                        {job.is_enabled
                          ? (job.next_run_at ?? 'never — check the expression')
                          : 'off'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        )}
      </Stack>
    </StudioPage>
  )
}
