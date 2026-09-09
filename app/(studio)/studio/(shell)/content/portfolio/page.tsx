import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable } from '@/components/studio/DataTable'
import { TextField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { DemoPill, StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listProjectsForStudio } from '@/lib/supabase/repositories/portfolio'
import { createClient } from '@/lib/supabase/server'
import type { PortfolioProject } from '@/lib/supabase/schemas'

import { createProjectAction } from './actions'

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
 * THE CREATE FORM ASKS FOR TWO THINGS AND NOTHING ELSE — a title and an address. Neither of the
 * columns that decide publication is on it: a new project is a DRAFT that nobody has confirmed,
 * naming nobody, and it stays that way until somebody performs those acts on the editor screen with
 * the permission each requires. A wide create form would invite exactly the half-filled entry, typed
 * from memory, that the evidence gate exists to refuse.
 */
export const metadata = studioMetadata('/studio/content/portfolio')

export default async function Page() {
  const session = await requirePermission('content.read')
  const projects = await listProjectsForStudio(await createClient())
  const canWrite = roleHasPermission(session.role, 'content.write')

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
              // THE ROW IS THE WAY IN. Without this link the editor screen has no route to it from
              // anywhere in the Studio, which is how a finished editor ships unreachable.
              cell: (project) => (
                <Link
                  href={`/studio/content/portfolio/${project.id}` as Route}
                  className="underline underline-offset-4"
                  data-project-link={project.id}
                >
                  {project.title === '' ? t('studio.portfolio.untitled') : project.title}
                </Link>
              ),
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
              // The editor's words for the state, not the enum's. `GRANTED` is legible; the other
              // three are not, and a column nobody can read is a column nobody checks.
              cell: (project) => t(`studio.portfolio.consent.${project.client_consent}`),
            },
            {
              id: 'status',
              header: t('studio.portfolio.colStatus'),
              cell: (project) => (
                <span className="flex flex-wrap items-center gap-1">
                  <StatusPill status={project.status} />
                  <DemoPill isDemo={project.is_demo} />
                </span>
              ),
            },
          ]}
        />

        {canWrite ? (
          <>
            <Divider />
            <Stack gap={3}>
              <PageHeader level={2} title={t('studio.portfolio.newHeading')} />
              <HelpText>{t('studio.portfolio.newHelp')}</HelpText>
              <ActionForm action={createProjectAction} className="grid max-w-md gap-4">
                <TextField
                  name="title"
                  label={t('studio.portfolio.colTitle')}
                  required
                  requiredLabel={t('studio.portfolio.requiredLabel')}
                />
                <TextField
                  name="slug"
                  label={t('studio.portfolio.newSlug')}
                  required
                  requiredLabel={t('studio.portfolio.requiredLabel')}
                />
                <div>
                  <Button type="submit">{t('studio.portfolio.newSubmit')}</Button>
                </div>
              </ActionForm>
            </Stack>
          </>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
