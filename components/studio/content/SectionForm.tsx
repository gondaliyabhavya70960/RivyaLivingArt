'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Divider } from '@/components/primitives/Divider'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Text } from '@/components/primitives/Text'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import { MediaPicker, type PickerAsset } from '@/components/studio/MediaPicker'
import { t } from '@/components/studio/strings'
import type { AnyBlockModule, SharedCopyField } from '@/lib/cms/block-module'

import { buildPayload, type SectionFormValues } from './section-form-values'

/**
 * The editor for one section.
 *
 * IT RENDERS WHAT THE BLOCK DECLARES, AND THE CHROME ALWAYS. `sharedFields` chooses which of the
 * twelve SEED §5 copy fields appear; the chrome below — visibility, theme, layout, the schedule
 * pair, the classifications — is rendered for EVERY block regardless. That is the split
 * `block-module.ts` documents: `sharedFields: []` on a divider means "no copy fields", never "no
 * editor", and exit criterion 2 would be false for it otherwise.
 *
 * IT IS UNCONTROLLED EXCEPT FOR THE MEDIA PICKERS. Text inputs keep their own DOM state, which is
 * what makes a long edit survive a re-render; the pickers need React state because their value is
 * chosen in a dialog rather than typed. The hidden inputs inside `MediaPicker` are what put those
 * values back into the form data.
 */

export type SectionFormProps = {
  readonly block: AnyBlockModule
  readonly values: SectionFormValues
  readonly assets: readonly PickerAsset[]
  readonly slotKeys: readonly string[]
  readonly pending: boolean
  readonly error: string | null
  readonly onSubmit: (values: SectionFormValues) => void
  readonly onCancel: () => void
}

const THEMES = [
  { value: '', label: t('studio.content.section.themeInherit') },
  { value: 'DEEP', label: 'Deep' },
  { value: 'INK', label: 'Ink' },
  { value: 'BONE', label: 'Bone' },
]

const FACT_CLASSIFICATIONS = [
  { value: 'EDITORIAL_COPY', label: 'Editorial copy' },
  { value: 'BRAND_COPY', label: 'Brand copy' },
  { value: 'VERIFIED_BUSINESS_FACT', label: 'Verified business fact' },
  { value: 'PRODUCT_FACT', label: 'Product fact' },
  { value: 'SEO_COPY', label: 'SEO copy' },
  { value: 'LEGAL_COPY', label: 'Legal copy' },
]

const VERIFICATIONS = [
  { value: 'NOT_REQUIRED', label: 'Not required' },
  { value: 'OWNER_VERIFICATION_REQUIRED', label: 'Owner must confirm' },
  { value: 'VERIFIED', label: 'Confirmed by the owner' },
]

/** Labels for the twelve shared copy fields. Interface mechanics, not marketing copy. */
const COPY_LABELS: Record<SharedCopyField, string> = {
  eyebrow: 'Eyebrow',
  heading: 'Heading',
  heading_highlight: 'Highlighted words',
  body: 'Body',
  supporting: 'Supporting text',
  cta_label: 'Button label',
  cta_url: 'Button link',
  cta_secondary_label: 'Second button label',
  cta_secondary_url: 'Second button link',
  media_desktop_id: t('studio.content.section.desktopLabel'),
  media_mobile_id: t('studio.content.section.mobileLabel'),
  media_alt_override: t('studio.content.section.altOverrideLabel'),
}

const LONG_FIELDS = new Set<SharedCopyField>(['body', 'supporting'])
const MEDIA_FIELDS = new Set<SharedCopyField>([
  'media_desktop_id',
  'media_mobile_id',
  'media_alt_override',
])

export function SectionForm({
  block,
  values,
  assets,
  slotKeys,
  pending,
  error,
  onSubmit,
  onCancel,
}: SectionFormProps): React.ReactElement {
  const [desktopId, setDesktopId] = React.useState(values.mediaDesktopId)
  const [mobileId, setMobileId] = React.useState(values.mediaMobileId)

  const copyFields = block.sharedFields.filter((field) => !MEDIA_FIELDS.has(field))
  const usesMedia =
    block.sharedFields.includes('media_desktop_id') ||
    block.sharedFields.includes('media_mobile_id')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    onSubmit({
      sectionId: values.sectionId,
      pageId: values.pageId,
      isVisible: data.get('is_visible') !== null,
      theme: text(data, 'theme'),
      layoutVariant: text(data, 'layout_variant'),
      eyebrow: text(data, 'eyebrow'),
      heading: text(data, 'heading'),
      headingHighlight: text(data, 'heading_highlight'),
      body: text(data, 'body'),
      supporting: text(data, 'supporting'),
      ctaLabel: text(data, 'cta_label'),
      ctaUrl: text(data, 'cta_url'),
      ctaSecondaryLabel: text(data, 'cta_secondary_label'),
      ctaSecondaryUrl: text(data, 'cta_secondary_url'),
      mediaDesktopId: desktopId,
      mediaMobileId: mobileId,
      mediaAltOverride: text(data, 'media_alt_override'),
      mediaSlotKey: text(data, 'media_slot_key'),
      publishAt: text(data, 'publish_at'),
      unpublishAt: text(data, 'unpublish_at'),
      factClassification: data.get(
        'fact_classification',
      ) as SectionFormValues['factClassification'],
      ownerVerification: data.get('owner_verification') as SectionFormValues['ownerVerification'],
      payload: buildPayload(block, data, values.payload),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={6}>
        {error === null ? null : <ErrorText>{error}</ErrorText>}

        {copyFields.length === 0 ? null : (
          <Stack gap={4}>
            <Heading level={3} size="display-xs">
              {t('studio.content.section.copyHeading')}
            </Heading>
            {copyFields.map((field) =>
              LONG_FIELDS.has(field) ? (
                <TextAreaField
                  key={field}
                  name={field}
                  label={COPY_LABELS[field]}
                  defaultValue={stringOf(values, field)}
                />
              ) : (
                <TextField
                  key={field}
                  name={field}
                  label={COPY_LABELS[field]}
                  defaultValue={stringOf(values, field)}
                />
              ),
            )}
          </Stack>
        )}

        {!usesMedia ? null : (
          <>
            <Divider />
            <Stack gap={4}>
              <Heading level={3} size="display-xs">
                {t('studio.content.section.mediaHeading')}
              </Heading>
              {block.sharedFields.includes('media_desktop_id') ? (
                <MediaPicker
                  name="media_desktop_id"
                  label={t('studio.content.section.desktopLabel')}
                  assets={assets}
                  value={desktopId}
                  onChange={setDesktopId}
                />
              ) : null}
              {block.sharedFields.includes('media_mobile_id') ? (
                <MediaPicker
                  name="media_mobile_id"
                  label={t('studio.content.section.mobileLabel')}
                  assets={assets}
                  value={mobileId}
                  onChange={setMobileId}
                />
              ) : null}
              <SelectField
                name="media_slot_key"
                label={t('studio.content.section.slotKeyLabel')}
                help={t('studio.content.section.slotKeyHelp')}
                defaultValue={values.mediaSlotKey ?? ''}
                options={[
                  { value: '', label: '—' },
                  ...slotKeys.map((key) => ({ value: key, label: key })),
                ]}
              />
              {block.sharedFields.includes('media_alt_override') ? (
                <TextField
                  name="media_alt_override"
                  label={t('studio.content.section.altOverrideLabel')}
                  help={t('studio.content.section.altOverrideHelp')}
                  defaultValue={values.mediaAltOverride ?? ''}
                />
              ) : null}
            </Stack>
          </>
        )}

        {block.payloadFields.length === 0 ? null : (
          <>
            <Divider />
            <Stack gap={4}>
              <Heading level={3} size="display-xs">
                {t('studio.content.section.blockHeading')}
              </Heading>
              {block.payloadFields.map((field) => {
                const current = (values.payload as Record<string, unknown>)[field.name]
                const key = `payload.${field.name}`

                if (field.kind === 'boolean') {
                  // A native checkbox, not `Switch`. Switch renders a <button> — correct for a
                  // control that acts on toggle, and invisible to `new FormData(form)`, so a
                  // switch here would look right and submit nothing.
                  return (
                    <Checkbox
                      key={key}
                      id={key}
                      name={key}
                      label={field.label}
                      defaultChecked={current === true}
                    />
                  )
                }
                if (field.kind === 'select') {
                  return (
                    <SelectField
                      key={key}
                      name={key}
                      label={field.label}
                      help={field.help}
                      defaultValue={String(current ?? '')}
                      options={field.options ?? []}
                    />
                  )
                }
                if (field.kind === 'json') {
                  return (
                    <TextAreaField
                      key={key}
                      name={key}
                      label={field.label}
                      help={field.help}
                      rows={8}
                      defaultValue={JSON.stringify(current ?? [], null, 2)}
                    />
                  )
                }
                if (field.kind === 'textarea') {
                  return (
                    <TextAreaField
                      key={key}
                      name={key}
                      label={field.label}
                      help={field.help}
                      defaultValue={String(current ?? '')}
                    />
                  )
                }
                return (
                  <TextField
                    key={key}
                    name={key}
                    label={field.label}
                    help={field.help}
                    defaultValue={String(current ?? '')}
                  />
                )
              })}
            </Stack>
          </>
        )}

        <Divider />
        <Stack gap={4}>
          <Heading level={3} size="display-xs">
            {t('studio.content.section.scheduleHeading')}
          </Heading>
          <Checkbox
            id="is_visible"
            name="is_visible"
            label={t('studio.content.section.visibleLabel')}
            defaultChecked={values.isVisible}
          />
          <SelectField
            name="theme"
            label={t('studio.content.section.themeLabel')}
            defaultValue={values.theme ?? ''}
            options={THEMES}
          />
          {block.layoutVariants.length === 0 ? null : (
            <SelectField
              name="layout_variant"
              label={t('studio.content.section.layoutLabel')}
              defaultValue={values.layoutVariant ?? ''}
              options={[
                { value: '', label: '—' },
                ...block.layoutVariants.map((variant) => ({ value: variant, label: variant })),
              ]}
            />
          )}
          <TextField
            name="publish_at"
            label={t('studio.content.section.publishAtLabel')}
            help={t('studio.content.section.scheduleHelp')}
            defaultValue={values.publishAt ?? ''}
          />
          <TextField
            name="unpublish_at"
            label={t('studio.content.section.unpublishAtLabel')}
            defaultValue={values.unpublishAt ?? ''}
          />
        </Stack>

        <Divider />
        <Stack gap={4}>
          <Heading level={3} size="display-xs">
            {t('studio.content.section.provenanceHeading')}
          </Heading>
          <SelectField
            name="fact_classification"
            label={t('studio.content.section.factLabel')}
            defaultValue={values.factClassification}
            options={FACT_CLASSIFICATIONS}
          />
          <SelectField
            name="owner_verification"
            label={t('studio.content.section.verificationLabel')}
            help={t('studio.content.section.verificationHelp')}
            defaultValue={values.ownerVerification}
            options={VERIFICATIONS}
          />
        </Stack>

        <Cluster gap={3}>
          <Button type="submit" loading={pending}>
            {t('studio.content.section.saveLabel')}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('studio.content.section.cancelLabel')}
          </Button>
        </Cluster>

        {block.state === 'BUILT' ? null : (
          <Text size="sm" tone="tertiary">
            {t('studio.content.section.noRenderer')}
          </Text>
        )}
      </Stack>
    </form>
  )
}

/** `''` from an emptied input becomes null — the same rule the action applies server-side. */
function text(data: FormData, name: string): string | null {
  const value = data.get(name)
  if (typeof value !== 'string') return null
  return value.trim() === '' ? null : value
}

function stringOf(values: SectionFormValues, field: SharedCopyField): string {
  const map: Partial<Record<SharedCopyField, string | null>> = {
    eyebrow: values.eyebrow,
    heading: values.heading,
    heading_highlight: values.headingHighlight,
    body: values.body,
    supporting: values.supporting,
    cta_label: values.ctaLabel,
    cta_url: values.ctaUrl,
    cta_secondary_label: values.ctaSecondaryLabel,
    cta_secondary_url: values.ctaSecondaryUrl,
    media_alt_override: values.mediaAltOverride,
  }
  return map[field] ?? ''
}
