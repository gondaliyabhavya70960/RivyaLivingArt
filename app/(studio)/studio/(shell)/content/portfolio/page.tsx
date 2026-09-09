import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable } from '@/components/studio/DataTable'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listProjectsForStudio } from '@/lib/supabase/repositories/portfolio'
import { createClient } from '@/lib/supabase/server'
import type { PortfolioProject } from '@/lib/supabase/schemas'

/**
 * /studio/content/portfolio — the project archive, which is empty.
 *
 * THE ZERO-ROW STATE IS AN EXPLANATION, NOT AN ERROR, and the phase document asks for exactly that:
 * "a list with a permanent zero-row explanation rather than an error state". A portfolio with no
 * projects is the correct condition of a studio that has not yet entered and verified any, and the
 * public page already says so in SEED §28's words. An editor opening this screen should learn that,
 * not wonder whether something failed to load.
 *
 * THE CONSENT COLUMN IS IN THE TABLE, not buried in the editor. Whether a named client has agreed
 * to be named is the fact most likely to block a publish and the one most easily forgotten, so it
 * is visible at a glance across every row rather than one click away.
 *
 * NOTHING HERE CREATES A PROJECT. That is deliberate for this phase: `portfolio_projects` ships
 * empty, and the New Project form belongs with the editor that can also record the evidence and the
 * consent. A create button that produced a bare row would invite exactly the half-filled,
 * unverifiable entry the evidence gate exists to refuse.
 */
export const metadata = studioMetadata('/studio/content/portfolio')

export default async function Page() {
  await requirePermission('content.read')
  const projects = await listProjectsForStudio(await createClient())

  return (
    <StudioPage path="/studio/content/portfolio">
      <Stack gap={8}>
        <Text size="sm" tone="secondary">
          {t('studio.portfolio.caption')}
        </Text>

        <DataTable<PortfolioProject>
          caption={t('studio.portfolio.caption')}
          rows={projects}
          rowKey={(project) => project.id}
          empty={{
            reason: 'empty',
            heading: t('studio.portfolio.emptyHeading'),
            body: t('studio.portfolio.emptyBody'),
          }}
          columns={[
            {
              id: 'title',
              header: t('studio.portfolio.colTitle'),
              cell: (project) => project.title || t('studio.portfolio.untitled'),
            },
            {
              id: 'client',
              header: t('studio.portfolio.colClient'),
              // A project that names nobody says so, rather than showing an empty cell that reads
              // as a missing value.
              cell: (project) => project.client_display_name ?? t('studio.portfolio.noClient'),
            },
            {
              id: 'consent',
              header: t('studio.portfolio.colConsent'),
              cell: (project) => project.client_consent,
            },
            {
              id: 'status',
              header: t('studio.portfolio.colStatus'),
              cell: (project) => <StatusPill status={project.status} />,
            },
          ]}
        />
      </Stack>
    </StudioPage>
  )
}
