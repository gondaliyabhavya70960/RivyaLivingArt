import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

/**
 * /studio/research/sources — read-only until Phase 26.
 *
 * WHAT IT SHOWS IS THE POLITENESS SETTINGS AND THE POLICY REVIEW, because those are the two things
 * anybody looking at this list is checking: may we read this site, and how gently. The rest of
 * FEAT §26's twenty-three fields — category mapping, URL patterns, extraction modes, the health
 * view — is Phase 26's management surface, and a half-form here would be a second place to define
 * the same source.
 *
 * THE OWNER-VERIFICATION NOTE IS ON THE PAGE, NOT IN THE DOCUMENTATION. Approving a source is an
 * assertion about a third party's terms of use — a legal and commercial judgement this software
 * cannot make — and the place that has to say so is the screen where somebody would do it, not a
 * file they will never open.
 */
export const metadata = studioMetadata('/studio/research/sources')

export default async function Page() {
  await requirePermission('research.read')
  const client = await createClient()
  const sources = await listResearchSources(client)

  return (
    <StudioPage path="/studio/research/sources">
      <Stack gap={8}>
        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.research.policyOwnerOnly')} />
          <Text tone="secondary" className="mt-3">
            {t('studio.research.policyOwnerOnlyBody')}
          </Text>
        </Surface>

        {sources.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noSources')}
            body={t('studio.research.noSourcesBody')}
          />
        ) : (
          <Surface level={1} className="p-6">
            <PageHeader level={2} title={t('studio.research.sourcesHeading')} />
            <div className="mt-4 overflow-x-auto border border-line">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t('studio.research.sourcesHeading')}</caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th scope="col" className="p-2 text-left">
                      Name
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Policy
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Enabled
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Delay
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Concurrency
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Failures
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr
                      key={source.id}
                      className="border-t border-line"
                      data-source-id={source.id}
                      data-policy-status={source.policy_status}
                    >
                      <td className="p-2">
                        {source.name}
                        <span className="ml-2 font-mono text-xs text-ink-secondary">
                          {source.base_url}
                        </span>
                      </td>
                      <td className="p-2">
                        <Badge tone={source.policy_status === 'APPROVED' ? 'neutral' : 'danger'}>
                          {source.policy_status}
                        </Badge>
                      </td>
                      <td className="p-2">{source.is_enabled ? 'yes' : 'no'}</td>
                      <td className="p-2 text-ink-secondary">{`${source.request_delay_ms} ms`}</td>
                      <td className="p-2 text-ink-secondary">{source.concurrency}</td>
                      {/* THE CIRCUIT, SHOWN AS A STATE AND NOT ONLY AS A COUNT. Five failures is
                          the threshold, and a source that has hit it is paused — which is what an
                          operator needs to see when a run is doing nothing. */}
                      <td className="p-2">
                        {source.circuit_open_until === null ? (
                          <span className="text-ink-secondary">{source.consecutive_failures}</span>
                        ) : (
                          <Badge tone="danger">paused</Badge>
                        )}
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
