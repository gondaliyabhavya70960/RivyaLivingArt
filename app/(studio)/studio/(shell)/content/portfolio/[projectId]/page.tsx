import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { EntitySeoPanel } from '@/components/studio/seo/EntitySeoPanel'
import { ProjectGalleryPanel } from '@/components/studio/content/ProjectGalleryPanel'
import { ProjectPublishControls } from '@/components/studio/content/ProjectPublishControls'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import { OwnerVerificationPanel } from '@/components/studio/OwnerVerificationPanel'
import { PageHeader } from '@/components/studio/PageHeader'
import { RelatedContentPicker } from '@/components/studio/RelatedContentPicker'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { projectPublishGates } from '@/lib/portfolio/gates'
import { NotFoundError } from '@/lib/supabase/errors'
import {
  RELATION_ENTITIES,
  RELATION_KINDS,
  getRelations,
} from '@/lib/supabase/repositories/entity-relations'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import {
  PROJECT_MEDIA_ROLES,
  getProjectByIdForStudio,
  listProjectMedia,
} from '@/lib/supabase/repositories/portfolio'
import { clientConsentStateSchema } from '@/lib/supabase/schemas'
import { createClient } from '@/lib/supabase/server'

import {
  createProjectStoryPageAction,
  detachProjectMediaAction,
  publishProjectAction,
  saveProjectClientAction,
  saveProjectIdentityAction,
  saveProjectMediaAction,
  setProjectRelationAction,
  setProjectVerificationAction,
  unpublishProjectAction,
} from './actions'

/**
 * /studio/content/portfolio/[projectId] — one delivered project.
 *
 * THE VERIFICATION PANEL COMES FIRST, above the fields, because it answers the question an editor
 * actually opens this screen with: why is this not live yet. It reads `lib/portfolio/gates.ts`,
 * which `tests/unit/rls/phase17.test.ts` checks against the database across every combination — so
 * what it says here is what the trigger will do, not a second opinion about it.
 *
 * CONSENT IS ITS OWN FORM, SEPARATE FROM IDENTITY, and that separation is the point rather than a
 * layout choice. If consent were a field on the identity form, an editor could submit
 * `client_consent=GRANTED` in the same request that renames the project, and the only thing between
 * a client's name and the public site would be a hidden input. Two forms, two actions, two
 * permissions: recording a consent is an act somebody performed.
 *
 * `evidence_note` IS EDITED HERE AND RENDERED NOWHERE PUBLIC. `0152` revokes it from `anon` at the
 * grant, so it is not merely unrendered — it is unreadable to a visitor even through a crafted
 * request. This is the one screen it belongs on.
 *
 * EVERY CONTROL IS LABELLED THROUGH `FormField`, not a bare `<input>`. The first draft of this page
 * used bare inputs and a screen reader announced the client's name field as "edit text, blank" —
 * on the one form in the Studio where getting the wrong field means publishing somebody's name.
 */
export const metadata = studioMetadata('/studio/content/portfolio')

/** The consent vocabulary, in the schema's own order, each with the words an editor reads. */
const CONSENT_OPTIONS = clientConsentStateSchema.options.map((value) => ({
  value,
  label: t(`studio.portfolio.consent.${value}`),
}))

export default async function Page({
  params,
}: {
  readonly params: Promise<{ projectId: string }>
}) {
  const session = await requirePermission('content.read')
  const { projectId } = await params

  const client = await createClient()
  const project = await getProjectByIdForStudio(client, projectId).catch((error: unknown) => {
    // A project this role cannot see and one that does not exist are indistinguishable under RLS,
    // and must stay that way — for a portfolio that is also a confidentiality property.
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (project === null) notFound()

  // THE ATTACHABLE LIST IS FILTERED ON THE SERVER, so a concept render never reaches the browser as
  // an option. One of three copies of the same rule, all three wanted: this picker so an editor is
  // never offered a choice that will be refused, `saveProjectMediaAction` so the refusal is worded,
  // and `reject_concept_project_media` so a request that skipped both is still refused.
  const [relations, gallery, assets] = await Promise.all([
    getRelations(client, 'PORTFOLIO_PROJECT', project.id),
    listProjectMedia(client, project.id),
    listMediaAssets(client, { limit: 200 }),
  ])

  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  const attached = new Set(gallery.map((row) => row.media_asset_id))
  const label = (id: string): string => {
    const asset = byId.get(id)
    if (asset === undefined) return id
    return asset.title ?? asset.filename ?? asset.public_id
  }

  const canWrite = roleHasPermission(session.role, 'content.write')
  const canVerify = roleHasPermission(session.role, 'content.verify')
  const canPublish = roleHasPermission(session.role, 'content.publish')
  const verified = project.owner_verification === 'VERIFIED'

  return (
    <StudioPage path="/studio/content/portfolio">
      <Stack gap={8}>
        <PageHeader
          level={1}
          title={project.title === '' ? t('studio.portfolio.untitled') : project.title}
          description={project.slug}
          actions={<StatusPill status={project.status} />}
        />

        <Link href={'/studio/content/portfolio' as Route} className="underline underline-offset-4">
          <Text size="sm" as="span">
            {t('studio.portfolio.backToList')}
          </Text>
        </Link>

        <Divider />

        <Stack gap={3}>
          <OwnerVerificationPanel gates={projectPublishGates(project)} />
          {canVerify ? (
            <>
              <HelpText>{t('studio.portfolio.verifyHelp')}</HelpText>
              <ActionForm action={setProjectVerificationAction}>
                <input type="hidden" name="id" value={project.id} />
                {/*
                  The VALUE is the state being asked for, not a toggle computed from what this page
                  was rendered with. Two people with the screen open otherwise send "flip it" twice
                  and the second undoes the first without either of them meaning to.
                */}
                <Button
                  type="submit"
                  name="owner_verification"
                  value={verified ? 'OWNER_VERIFICATION_REQUIRED' : 'VERIFIED'}
                  variant={verified ? 'secondary' : 'primary'}
                >
                  {verified ? t('studio.portfolio.verifyClear') : t('studio.portfolio.verifySet')}
                </Button>
              </ActionForm>
            </>
          ) : null}
          {canPublish ? (
            <ProjectPublishControls
              projectId={project.id}
              isPublished={project.status === 'PUBLISHED'}
              publishAction={publishProjectAction}
              unpublishAction={unpublishProjectAction}
            />
          ) : null}
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.portfolio.identityHeading')} />
          <ActionForm action={saveProjectIdentityAction} className="grid gap-4">
            <input type="hidden" name="id" value={project.id} />
            <TextField
              name="title"
              label={t('studio.portfolio.fieldTitle')}
              defaultValue={project.title}
              required
              requiredLabel={t('studio.portfolio.requiredLabel')}
            />
            <TextField
              name="subtitle"
              label={t('studio.portfolio.fieldSubtitle')}
              defaultValue={project.subtitle ?? ''}
            />
            <TextAreaField
              name="summary"
              label={t('studio.portfolio.fieldSummary')}
              defaultValue={project.summary ?? ''}
            />
            <TextField
              name="project_type"
              label={t('studio.portfolio.fieldType')}
              defaultValue={project.project_type ?? ''}
            />
            <TextField
              name="location_label"
              label={t('studio.portfolio.fieldLocation')}
              help={t('studio.portfolio.fieldLocationHelp')}
              defaultValue={project.location_label ?? ''}
            />
            <TextField
              name="completed_on"
              type="date"
              label={t('studio.portfolio.fieldCompleted')}
              help={t('studio.portfolio.fieldCompletedHelp')}
              defaultValue={project.completed_on ?? ''}
            />
            <TextAreaField
              name="evidence_note"
              label={t('studio.portfolio.fieldEvidence')}
              help={t('studio.portfolio.fieldEvidenceHelp')}
              defaultValue={project.evidence_note ?? ''}
            />
            <div>
              <Button type="submit" disabled={!canWrite}>
                {t('studio.portfolio.identitySave')}
              </Button>
            </div>
          </ActionForm>
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.portfolio.clientHeading')} />
          <ActionForm action={saveProjectClientAction} className="grid gap-4">
            <input type="hidden" name="id" value={project.id} />
            <Checkbox
              name="is_client_project"
              label={t('studio.portfolio.fieldIsClient')}
              defaultChecked={project.is_client_project}
            />
            <TextField
              name="client_display_name"
              label={t('studio.portfolio.fieldClientName')}
              help={t('studio.portfolio.fieldClientNameHelp')}
              defaultValue={project.client_display_name ?? ''}
            />
            {/*
              GRANTED is offered to everyone and refused server-side to anyone without
              `content.verify`. Hiding the option would leave an editor unable to see what state the
              project is even in; the action is where the decision is actually gated.
            */}
            <SelectField
              name="client_consent"
              label={t('studio.portfolio.fieldConsent')}
              defaultValue={project.client_consent}
              options={CONSENT_OPTIONS}
            />
            <TextField
              name="client_consent_reference"
              label={t('studio.portfolio.fieldConsentRef')}
              help={t('studio.portfolio.fieldConsentRefHelp')}
              defaultValue={project.client_consent_reference ?? ''}
            />
            {project.client_consent_recorded_at === null ? null : (
              <HelpText>
                {t('studio.portfolio.consentRecorded')}{' '}
                <RelativeTime value={project.client_consent_recorded_at} />
              </HelpText>
            )}
            <div>
              <Button type="submit" disabled={!canWrite}>
                {t('studio.portfolio.clientSave')}
              </Button>
            </div>
          </ActionForm>
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.portfolio.story.heading')} />
          <HelpText>{t('studio.portfolio.story.help')}</HelpText>
          {project.page_id === null ? (
            canWrite ? (
              <ActionForm action={createProjectStoryPageAction}>
                <input type="hidden" name="id" value={project.id} />
                <Button type="submit">{t('studio.portfolio.story.create')}</Button>
              </ActionForm>
            ) : null
          ) : (
            <Link
              href={`/studio/content/pages/${project.page_id}` as Route}
              className="underline underline-offset-4"
              data-story-page={project.page_id}
            >
              <Text size="sm" as="span">
                {t('studio.portfolio.story.edit')}
              </Text>
            </Link>
          )}
        </Stack>

        <Divider />

        <ProjectGalleryPanel
          projectId={project.id}
          rows={gallery.map((row) => ({
            mediaAssetId: row.media_asset_id,
            label: label(row.media_asset_id),
            role: row.role,
            caption: row.caption,
            altOverride: row.alt_override,
            sortOrder: row.sort_order,
          }))}
          attachable={assets
            .filter((asset) => !asset.is_concept && !attached.has(asset.id))
            .map((asset) => ({ id: asset.id, label: label(asset.id) }))}
          roles={PROJECT_MEDIA_ROLES}
          canWrite={canWrite}
          saveAction={saveProjectMediaAction}
          detachAction={detachProjectMediaAction}
        />

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.portfolio.relationsHeading')} />
          <RelatedContentPicker
            sourceId={project.id}
            rows={relations.map((edge) => ({
              id: edge.id,
              targetType: edge.target_type,
              targetId: edge.target_id,
              relationType: edge.relation_type,
              note: edge.note,
            }))}
            targetTypes={RELATION_ENTITIES}
            relationTypes={RELATION_KINDS}
            canWrite={canWrite}
            action={setProjectRelationAction}
          />
        </Stack>

        <EntitySeoPanel
          entityType="portfolio_projects"
          entityId={project.id}
          entityPath={`/portfolio/${project.slug.toLowerCase()}`}
          name={project.title}
          summary={project.summary}
          role={session.role}
        />
      </Stack>
    </StudioPage>
  )
}
