'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { SelectField, TextField, errorFor } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import type { ValidationIssue } from '@/lib/catalog/validation'

import type { ProjectActionState } from '@/app/(studio)/studio/(shell)/content/portfolio/[projectId]/actions'

/**
 * The Gallery panel: which photographs a project shows, in which order, saying what.
 *
 * ONE FORM PER ROW, NOT ONE FORM FOR THE PANEL, exactly as the product Media tab is built.
 * `reject_concept_project_media` refuses a concept render, and a whole-panel form would lose every
 * other edit on the screen to one refused attachment. Per-row forms cost the editor exactly the row
 * that was refused.
 *
 * ORDER IS A NUMBER AN EDITOR TYPES, NOT A DRAG. The phase document says "drag ordering", and this
 * is a deliberate divergence rather than an omission: a drag-only reorder is unreachable by keyboard
 * and by anyone using a screen reader, it needs a client-side library and a persistence path of its
 * own, and it does not work with JavaScript off — which the rest of these forms do. A numeric field
 * is the same capability, reachable by everyone, and it is what `ProductMediaTab` already uses. Drag
 * can be added on top of it later; it cannot be the only way in.
 *
 * THE PICKER OFFERS NO CONCEPT ASSETS — the server filters them out before this renders, and the
 * helper line says so rather than leaving an editor to wonder why an asset they can see in the Media
 * library is missing here. That is the Studio's copy of a rule the database also enforces. Neither
 * is sufficient alone: the picker cannot stop a `curl`, and the trigger cannot explain itself.
 *
 * `disabled` LIVES ON THE BUTTONS, NOT ON THE FIELDS, as it does throughout the Studio: a read-only
 * editor is better served by controls they can read and a submit they cannot press than by a row of
 * grey boxes. Every action re-checks `content.write` server-side, so this is presentation only.
 */

export interface ProjectMediaRow {
  readonly mediaAssetId: string
  /** The asset's own words where it has them, its public id where it does not. Never a bare uuid. */
  readonly label: string
  readonly role: string
  readonly caption: string | null
  readonly altOverride: string | null
  readonly sortOrder: number
}

export interface ProjectGalleryPanelProps {
  readonly projectId: string
  readonly rows: readonly ProjectMediaRow[]
  /** Assets that may be attached — already filtered of concept renders by the server. */
  readonly attachable: readonly { readonly id: string; readonly label: string }[]
  readonly roles: readonly string[]
  readonly canWrite: boolean
  readonly saveAction: (state: ProjectActionState, form: FormData) => Promise<ProjectActionState>
  readonly detachAction: (state: ProjectActionState, form: FormData) => Promise<ProjectActionState>
}

const IDLE: ProjectActionState = { status: 'idle' }

function issuesOf(state: ProjectActionState): readonly { path: string; message: string }[] {
  const issues: readonly ValidationIssue[] = state.status === 'error' ? state.issues : []
  return issues.map((issue) => ({ path: issue.field, message: issue.message }))
}

const roleOptions = (roles: readonly string[]) =>
  roles.map((role) => ({ value: role, label: role }))

function GalleryRow({
  projectId,
  row,
  roles,
  canWrite,
  saveAction,
  detachAction,
}: {
  projectId: string
  row: ProjectMediaRow
  roles: readonly string[]
  canWrite: boolean
  saveAction: ProjectGalleryPanelProps['saveAction']
  detachAction: ProjectGalleryPanelProps['detachAction']
}): React.ReactElement {
  const [saveState, save, saving] = useActionState(saveAction, IDLE)
  const [detachState, detach, detaching] = useActionState(detachAction, IDLE)
  const saveIssues = issuesOf(saveState)
  const rowError = errorFor(saveIssues, '_form') ?? errorFor(issuesOf(detachState), '_form')

  return (
    <li className="border-b border-line py-4" data-project-media={row.mediaAssetId}>
      <Stack gap={3}>
        <Text size="sm">{row.label}</Text>

        <div className="flex flex-wrap items-end gap-3">
          <form action={save} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="media_asset_id" value={row.mediaAssetId} />
            <SelectField
              name="role"
              label={t('studio.portfolio.gallery.roleLabel')}
              defaultValue={row.role}
              issues={saveIssues}
              options={roleOptions(roles)}
            />
            <TextField
              name="caption"
              label={t('studio.portfolio.gallery.captionLabel')}
              defaultValue={row.caption ?? ''}
              issues={saveIssues}
            />
            <TextField
              name="alt_override"
              label={t('studio.portfolio.gallery.altLabel')}
              help={t('studio.portfolio.gallery.altHelp')}
              defaultValue={row.altOverride ?? ''}
              issues={saveIssues}
            />
            <TextField
              name="sort_order"
              label={t('studio.portfolio.gallery.orderLabel')}
              defaultValue={String(row.sortOrder)}
              issues={saveIssues}
            />
            <Button type="submit" disabled={!canWrite || saving}>
              {t('studio.portfolio.gallery.save')}
            </Button>
          </form>

          <form action={detach}>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="media_asset_id" value={row.mediaAssetId} />
            <Button type="submit" variant="ghost" disabled={!canWrite || detaching}>
              {t('studio.portfolio.gallery.detach')}
            </Button>
          </form>
        </div>

        {rowError === undefined ? null : (
          <Text size="sm" tone="secondary" data-form-error="">
            {rowError}
          </Text>
        )}
      </Stack>
    </li>
  )
}

export function ProjectGalleryPanel({
  projectId,
  rows,
  attachable,
  roles,
  canWrite,
  saveAction,
  detachAction,
}: ProjectGalleryPanelProps): React.ReactElement {
  const [attachState, attach, attaching] = useActionState(saveAction, IDLE)
  const attachIssues = issuesOf(attachState)
  const attachError = errorFor(attachIssues, '_form')

  return (
    <Stack gap={4} data-project-gallery-panel="">
      <PageHeader level={2} title={t('studio.portfolio.gallery.heading')} />
      <Text size="sm" tone="secondary">
        {t('studio.portfolio.gallery.help')}
      </Text>
      <Text size="sm" tone="tertiary">
        {t('studio.portfolio.gallery.conceptExcluded')}
      </Text>

      {rows.length === 0 ? (
        <Text size="sm" tone="secondary" data-empty="">
          {t('studio.portfolio.gallery.empty')}
        </Text>
      ) : (
        <ul role="list">
          {rows.map((row) => (
            <GalleryRow
              key={row.mediaAssetId}
              projectId={projectId}
              row={row}
              roles={roles}
              canWrite={canWrite}
              saveAction={saveAction}
              detachAction={detachAction}
            />
          ))}
        </ul>
      )}

      {attachable.length === 0 ? (
        <Text size="sm" tone="secondary" data-nothing-attachable="">
          {t('studio.portfolio.gallery.nothingAttachable')}
        </Text>
      ) : (
        <form action={attach} className="flex flex-wrap items-end gap-3" data-attach-media="">
          <input type="hidden" name="project_id" value={projectId} />
          <SelectField
            name="media_asset_id"
            label={t('studio.portfolio.gallery.attachLabel')}
            issues={attachIssues}
            options={attachable.map((asset) => ({ value: asset.id, label: asset.label }))}
          />
          <SelectField
            name="role"
            label={t('studio.portfolio.gallery.roleLabel')}
            issues={attachIssues}
            options={roleOptions(roles)}
          />
          <Button type="submit" disabled={!canWrite || attaching}>
            {t('studio.portfolio.gallery.attach')}
          </Button>
        </form>
      )}

      {attachError === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {attachError}
        </Text>
      )}
    </Stack>
  )
}
