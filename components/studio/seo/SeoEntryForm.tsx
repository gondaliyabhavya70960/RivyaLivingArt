import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import type { StudioFormAction } from '@/components/studio/form-state'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import type { ResolvedSeo } from '@/lib/seo/resolve'
import type { SeoEntryTarget } from '@/lib/supabase/repositories/seo'
import type { SeoEntry } from '@/lib/supabase/schemas'
import { STRUCTURED_DATA_TYPES } from '@/lib/supabase/schemas/seo'

import { LevelBadge } from './LevelBadge'
import { SerpPreview } from './SerpPreview'

/**
 * RC-349 `SeoEntryForm` — one `seo_entries` row (PATH or ENTITY scope), with the SERP preview,
 * the social card fields, the canonical, the structured-data type and the two directives.
 *
 * THE RESOLVED VALUE IS SHOWN BESIDE EVERY FIELD WITH ITS LEVEL, so an empty field is never a
 * mystery: the editor sees what the page currently says and where that came from, and their
 * own words replace it the moment they type. Publishing is a second form, because a row is
 * created DRAFT (the Phase 08 transition rule) and goes live through the same step a section does.
 */

export type SeoFormOption = { readonly value: string; readonly label: string }

export function SeoEntryForm({
  target,
  entityPath,
  entry,
  resolved,
  template,
  mediaOptions,
  saveAction,
  statusAction,
  deleteAction,
  canWrite,
  canPublish,
  canDelete,
}: {
  readonly target: SeoEntryTarget
  /** The public address the entry affects, for the preview and the revalidation. */
  readonly entityPath: string
  readonly entry: SeoEntry | null
  readonly resolved: ResolvedSeo
  readonly template: string | null
  readonly mediaOptions: readonly SeoFormOption[]
  readonly saveAction: StudioFormAction
  readonly statusAction: StudioFormAction
  readonly deleteAction: StudioFormAction
  readonly canWrite: boolean
  readonly canPublish: boolean
  readonly canDelete: boolean
}) {
  const hidden = (
    <>
      {entry === null ? null : <input type="hidden" name="id" value={entry.id} />}
      <input type="hidden" name="scope" value={target.scope} />
      {target.scope === 'PATH' ? <input type="hidden" name="path" value={target.path} /> : null}
      {target.scope === 'ENTITY' ? (
        <>
          <input type="hidden" name="entity_type" value={target.entityType} />
          <input type="hidden" name="entity_id" value={target.entityId} />
        </>
      ) : null}
      <input type="hidden" name="entity_path" value={entityPath} />
    </>
  )

  const resolvedLine = (label: string, value: { value: string | null; level: string }) => (
    <div className="flex flex-wrap items-center gap-2">
      <Text as="span" size="xs" tone="tertiary">
        {label}
      </Text>
      <Text as="span" size="xs" tone="secondary">
        {value.value ?? t('studio.seo.resolved.none')}
      </Text>
      <LevelBadge level={value.level as ResolvedSeo['title']['level']} />
    </div>
  )

  return (
    <Stack gap={4} data-seo-entry-form={target.scope}>
      <div className="flex flex-wrap items-center gap-3">
        <Text size="sm" tone="secondary">
          {entityPath}
        </Text>
        {entry === null ? (
          <Text size="xs" tone="tertiary">
            {t('studio.seo.entry.noneYet')}
          </Text>
        ) : (
          <StatusPill status={entry.status} />
        )}
      </div>

      <Stack gap={1}>
        {resolvedLine(t('studio.seo.resolved.title'), resolved.title)}
        {resolvedLine(t('studio.seo.resolved.description'), resolved.description)}
        {resolvedLine(t('studio.seo.resolved.socialTitle'), resolved.socialTitle)}
        {resolvedLine(t('studio.seo.resolved.socialDescription'), resolved.socialDescription)}
      </Stack>

      <ActionForm action={saveAction} className="grid gap-4">
        {hidden}
        <SerpPreview
          initialTitle={entry?.title ?? ''}
          initialDescription={entry?.description ?? ''}
          fallbackTitle={resolved.title.value}
          fallbackDescription={resolved.description.value}
          template={template}
          url={entityPath}
          disabled={!canWrite}
          labels={{
            title: t('studio.seo.field.title'),
            description: t('studio.seo.field.description'),
            titleHelp: t('studio.seo.field.titleHelp'),
            descriptionHelp: t('studio.seo.field.descriptionHelp'),
            previewHeading: t('studio.seo.preview.heading'),
            characters: t('studio.seo.preview.characters'),
            overMark: t('studio.seo.preview.overMark'),
            resolvedFallback: t('studio.seo.preview.resolvedFallback'),
          }}
        />
        <TextField
          name="social_title"
          label={t('studio.seo.field.socialTitle')}
          help={t('studio.seo.field.socialTitleHelp')}
          defaultValue={entry?.social_title ?? ''}
        />
        <TextAreaField
          name="social_description"
          label={t('studio.seo.field.socialDescription')}
          defaultValue={entry?.social_description ?? ''}
          rows={2}
        />
        <SelectField
          name="og_media_id"
          label={t('studio.seo.field.ogImage')}
          help={t('studio.seo.field.ogImageHelp')}
          defaultValue={entry?.og_media_id ?? ''}
          options={[{ value: '', label: t('studio.seo.field.none') }, ...mediaOptions]}
        />
        <TextField
          name="canonical_url"
          type="url"
          label={t('studio.seo.field.canonical')}
          help={t('studio.seo.field.canonicalHelp')}
          defaultValue={entry?.canonical_url ?? ''}
        />
        <SelectField
          name="structured_data_type"
          label={t('studio.seo.field.structuredType')}
          help={t('studio.seo.field.structuredTypeHelp')}
          defaultValue={entry?.structured_data_type ?? ''}
          options={[
            { value: '', label: t('studio.seo.field.none') },
            ...STRUCTURED_DATA_TYPES.map((type) => ({ value: type, label: type })),
          ]}
        />
        <div className="flex flex-wrap gap-6">
          <Checkbox
            name="noindex"
            label={t('studio.seo.field.noindex')}
            defaultChecked={entry?.noindex ?? false}
            disabled={!canWrite}
          />
          <Checkbox
            name="nofollow"
            label={t('studio.seo.field.nofollow')}
            defaultChecked={entry?.nofollow ?? false}
            disabled={!canWrite}
          />
        </div>
        <Text size="xs" tone="tertiary">
          {t('studio.seo.field.directiveNote')}
        </Text>
        {canWrite ? (
          <div>
            <Button type="submit" data-seo-save="">
              {entry === null ? t('studio.seo.entry.create') : t('studio.seo.entry.save')}
            </Button>
          </div>
        ) : null}
      </ActionForm>

      {entry === null ? null : (
        <div className="flex flex-wrap gap-3">
          {canPublish ? (
            <ActionForm action={statusAction}>
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="entity_path" value={entityPath} />
              <input
                type="hidden"
                name="status"
                value={entry.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'}
              />
              <Button type="submit" variant="secondary" data-seo-status="">
                {entry.status === 'PUBLISHED'
                  ? t('studio.seo.entry.unpublish')
                  : t('studio.seo.entry.publish')}
              </Button>
            </ActionForm>
          ) : null}
          {canDelete ? (
            <ActionForm action={deleteAction}>
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="entity_path" value={entityPath} />
              <Button type="submit" variant="secondary" data-seo-delete="">
                {t('studio.seo.entry.delete')}
              </Button>
            </ActionForm>
          ) : null}
        </div>
      )}
    </Stack>
  )
}
