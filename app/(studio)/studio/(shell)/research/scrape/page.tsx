import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { isEnabled } from '@/lib/flags'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

import { startRunAction } from './actions'

/**
 * /studio/research/scrape — start a run against one approved source.
 *
 * ONLY APPROVED, ENABLED SOURCES APPEAR IN THE LIST, and when there are none the page says why
 * rather than offering an empty select. A form that lets an operator choose nothing and press a
 * button is a form that teaches them the feature is broken.
 *
 * THE DRY-RUN TOGGLE IS THE FIRST THING TO REACH FOR and is described in the label rather than in
 * a tooltip: it fetches, honours robots and the delay, records the fetch — and creates no research
 * product rows for anybody to triage afterwards. That is what an operator wants when they are
 * checking a source rather than harvesting it.
 *
 * A VIEWER SEES THE PAGE AND NOT THE FORM. `research.read` renders it; `research.write` is what
 * puts a control on it, and the action re-checks. Two nets, the usual way round.
 */
export const metadata = studioMetadata('/studio/research/scrape')

export default async function Page() {
  const session = await requirePermission('research.read')
  const client = await createClient()

  const [sources, researchOn] = await Promise.all([
    listResearchSources(client),
    isEnabled('research_enabled'),
  ])

  const runnable = sources.filter(
    (source) => source.policy_status === 'APPROVED' && source.is_enabled,
  )
  const mayWrite = roleHasPermission(session.role, 'research.write')

  return (
    <StudioPage path="/studio/research/scrape">
      <Stack gap={8}>
        {researchOn ? null : (
          <EmptyState
            reason="empty"
            heading={t('studio.research.killSwitchOff')}
            body={t('studio.research.killSwitchOffBody')}
          />
        )}

        {runnable.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noSources')}
            body={t('studio.research.noSourcesBody')}
          />
        ) : mayWrite ? (
          <Surface level={1} className="p-6">
            <PageHeader level={2} title={t('studio.research.startRun')} />
            <ActionForm action={startRunAction}>
              <Stack gap={4} className="mt-4">
                <label className="text-sm" htmlFor="source_id">
                  {t('studio.research.sourcesHeading')}
                </label>
                <select
                  id="source_id"
                  name="source_id"
                  required
                  className="border border-line bg-surface px-3 py-2 text-sm"
                  data-source-select
                >
                  {runnable.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>

                <label className="text-sm" htmlFor="urls">
                  URLs
                </label>
                <textarea
                  id="urls"
                  name="urls"
                  rows={6}
                  required
                  className="border border-line bg-surface px-3 py-2 font-mono text-xs"
                  data-run-urls
                />

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="dry_run" defaultChecked data-dry-run />
                  {t('studio.research.dryRun')}
                </label>

                <button
                  type="submit"
                  className="self-start border border-ink px-4 py-2 text-sm uppercase tracking-technical"
                  data-start-run
                >
                  {t('studio.research.startRun')}
                </button>
              </Stack>
            </ActionForm>
          </Surface>
        ) : null}

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
