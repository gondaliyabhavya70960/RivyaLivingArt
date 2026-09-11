import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import type { StudioFormAction } from '@/components/studio/form-state'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import type { SeoEntry } from '@/lib/supabase/schemas'

import type { SeoFormOption } from './SeoEntryForm'
import { SerpPreview } from './SerpPreview'

/**
 * The Global tab — the SEED §41/§44 defaults: site name, title template, the GLOBAL
 * `seo_entries` row (default title, description, social card, robots) and the two SOCIAL
 * strings. What every page falls back to when its own rungs are empty.
 */
export function GlobalSeoForm({
  entry,
  strings,
  mediaOptions,
  action,
  canWrite,
}: {
  readonly entry: SeoEntry | null
  readonly strings: {
    readonly siteName: string
    readonly titleTemplate: string
    readonly ogHeadline: string
    readonly ogDescription: string
  }
  readonly mediaOptions: readonly SeoFormOption[]
  readonly action: StudioFormAction
  readonly canWrite: boolean
}) {
  return (
    <Stack gap={4} data-seo-global-form="">
      <div className="flex flex-wrap items-center gap-3">
        <Text size="sm" tone="secondary">
          {t('studio.seo.global.intro')}
        </Text>
        {entry === null ? null : <StatusPill status={entry.status} />}
      </div>
      <ActionForm action={action} className="grid gap-4">
        {entry === null ? null : <input type="hidden" name="id" value={entry.id} />}
        <input type="hidden" name="scope" value="GLOBAL" />
        <TextField
          name="site_name"
          label={t('studio.seo.global.siteName')}
          defaultValue={strings.siteName}
          required
          requiredLabel={t('studio.seo.requiredLabel')}
        />
        <TextField
          name="title_template"
          label={t('studio.seo.global.titleTemplate')}
          help={t('studio.seo.global.titleTemplateHelp')}
          defaultValue={strings.titleTemplate}
        />
        <SerpPreview
          initialTitle={entry?.title ?? ''}
          initialDescription={entry?.description ?? ''}
          fallbackTitle={strings.siteName}
          fallbackDescription={null}
          template={null}
          url="/"
          disabled={!canWrite}
          labels={{
            title: t('studio.seo.global.defaultTitle'),
            description: t('studio.seo.global.defaultDescription'),
            titleHelp: t('studio.seo.global.defaultTitleHelp'),
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
          defaultValue={entry?.social_title ?? ''}
        />
        <TextAreaField
          name="social_description"
          label={t('studio.seo.field.socialDescription')}
          defaultValue={entry?.social_description ?? ''}
          rows={2}
        />
        <TextField
          name="og_headline"
          label={t('studio.seo.global.ogHeadline')}
          help={t('studio.seo.global.ogHeadlineHelp')}
          defaultValue={strings.ogHeadline}
        />
        <TextField
          name="og_description"
          label={t('studio.seo.global.ogDescription')}
          defaultValue={strings.ogDescription}
        />
        <SelectField
          name="og_media_id"
          label={t('studio.seo.global.ogImage')}
          help={t('studio.seo.global.ogImageHelp')}
          defaultValue={entry?.og_media_id ?? ''}
          options={[{ value: '', label: t('studio.seo.field.none') }, ...mediaOptions]}
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
        {canWrite ? (
          <div>
            <Button type="submit" data-seo-global-save="">
              {t('studio.seo.global.save')}
            </Button>
          </div>
        ) : null}
      </ActionForm>
    </Stack>
  )
}
