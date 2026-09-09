import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import { fieldOptions } from '@/lib/cms/forms'
import type { FormStepWithFields } from '@/lib/cms/forms'
import type { CustomizationFormField } from '@/lib/supabase/schemas'

/**
 * One step of a customization form, with everything it asks.
 *
 * A SERVER COMPONENT WITH ACTIONS AS PROPS, not a client island. Every control here is a form that
 * posts to a Server Action, so the whole panel works with JavaScript switched off and adds nothing
 * to the bundle — which matters because a form with eleven steps would otherwise mount eleven
 * copies of the same interactive editor.
 *
 * COLLAPSED BY DEFAULT, USING `<details>`. A builder screen showing eleven expanded steps is a page
 * nobody can navigate; `<details>` collapses without state, without JavaScript and without taking
 * the content out of the document, so a browser's find-in-page still reaches a question inside a
 * closed step in the browsers that implement it.
 *
 * ORDER IS A NUMBER PER ROW AND ONE SAVE. Amendment A15·d: a drag handle is unreachable by
 * keyboard and unusable on a touch screen at this density, and a number is neither. The whole
 * sequence is submitted together so the database renumbers in a single statement rather than
 * racing itself across ten writes.
 */

/** Every `form_field_type`, shown under the enum's own names. See the list screen on why. */
export const FIELD_TYPE_OPTIONS = [
  { value: 'TEXT', label: 'TEXT — a short answer' },
  { value: 'TEXTAREA', label: 'TEXTAREA — a long answer' },
  { value: 'NUMBER', label: 'NUMBER — a quantity' },
  { value: 'DIMENSION', label: 'DIMENSION — a measurement and its unit' },
  { value: 'SELECT', label: 'SELECT — one of a list' },
  { value: 'MULTISELECT', label: 'MULTISELECT — any of a list' },
  { value: 'RADIO', label: 'RADIO — one of a few, all shown' },
  { value: 'CHECKBOX', label: 'CHECKBOX — yes or no' },
  { value: 'COLOUR_DIRECTION', label: 'COLOUR_DIRECTION — a named direction, not a colour' },
  { value: 'FILE', label: 'FILE — a reference image' },
  { value: 'CITY', label: 'CITY — where the piece is going' },
  { value: 'CONTACT_NAME', label: 'CONTACT_NAME' },
  { value: 'CONTACT_PHONE', label: 'CONTACT_PHONE' },
  { value: 'CONTACT_EMAIL', label: 'CONTACT_EMAIL' },
] as const

/** `value | Label`, one per line — the shape `parseOptions` reads back. */
function optionsAsText(field: CustomizationFormField): string {
  return fieldOptions(field)
    .map((option) => `${option.value} | ${option.label}`)
    .join('\n')
}

function QuestionForm({
  formId,
  stepId,
  field,
  canWrite,
  canDelete,
  saveAction,
  deleteAction,
}: {
  readonly formId: string
  readonly stepId: string
  /** `null` is the add form: no id, and a key field that only a new question gets. */
  readonly field: CustomizationFormField | null
  readonly canWrite: boolean
  readonly canDelete: boolean
  readonly saveAction: StudioFormAction
  readonly deleteAction: StudioFormAction
}) {
  const isNew = field === null

  return (
    <Stack gap={3}>
      <ActionForm action={saveAction} className="grid max-w-2xl gap-4">
        <input type="hidden" name="form_id" value={formId} />
        <input type="hidden" name="step_id" value={stepId} />
        {field !== null ? <input type="hidden" name="id" value={field.id} /> : null}

        {isNew ? (
          <TextField
            name="key"
            label={t('studio.catalog.form.fieldKey')}
            help={t('studio.catalog.form.fieldKeyHelp')}
            required
            requiredLabel={t('studio.catalog.form.requiredLabel')}
          />
        ) : null}

        <TextField
          name="label"
          label={t('studio.catalog.form.fieldLabel')}
          defaultValue={field?.label ?? ''}
          required
          requiredLabel={t('studio.catalog.form.requiredLabel')}
        />
        <SelectField
          name="field_type"
          label={t('studio.catalog.form.fieldType')}
          defaultValue={field?.field_type ?? 'TEXT'}
          options={[...FIELD_TYPE_OPTIONS]}
        />
        <TextField
          name="help_text"
          label={t('studio.catalog.form.fieldHelpText')}
          defaultValue={field?.help_text ?? ''}
        />
        <TextField
          name="placeholder"
          label={t('studio.catalog.form.fieldPlaceholder')}
          defaultValue={field?.placeholder ?? ''}
        />
        <TextAreaField
          name="options"
          label={t('studio.catalog.form.fieldOptions')}
          help={t('studio.catalog.form.fieldOptionsHelp')}
          defaultValue={field === null ? '' : optionsAsText(field)}
          rows={4}
        />
        {/*
          A NEW QUESTION ARRIVES ASKED AND OPTIONAL. `is_enabled` defaults checked because a
          question added to a step is a question meant to be asked; `is_required` defaults clear
          because making an answer compulsory is a decision, and a default that quietly blocks a
          visitor from continuing is the wrong one to make on their behalf.
        */}
        <Checkbox
          name="is_enabled"
          defaultChecked={field?.is_enabled ?? true}
          label={t('studio.catalog.form.fieldEnabled')}
        />
        <Checkbox
          name="is_required"
          defaultChecked={field?.is_required ?? false}
          label={t('studio.catalog.form.fieldRequired')}
        />
        <Checkbox
          name="include_in_whatsapp"
          defaultChecked={field?.include_in_whatsapp ?? true}
          label={t('studio.catalog.form.fieldWhatsapp')}
        />
        <div>
          <Button type="submit" disabled={!canWrite}>
            {isNew ? t('studio.catalog.form.fieldAdd') : t('studio.catalog.form.fieldSave')}
          </Button>
        </div>
      </ActionForm>

      {field !== null && canDelete ? (
        <ActionForm action={deleteAction}>
          <input type="hidden" name="form_id" value={formId} />
          <input type="hidden" name="id" value={field.id} />
          <Button type="submit" variant="secondary">
            {t('studio.catalog.form.fieldDelete')}
          </Button>
        </ActionForm>
      ) : null}
    </Stack>
  )
}

export function FormStepPanel({
  formId,
  entry,
  canWrite,
  canDelete,
  saveStepAction,
  deleteStepAction,
  saveFieldAction,
  deleteFieldAction,
  reorderFieldsAction,
}: {
  readonly formId: string
  readonly entry: FormStepWithFields
  readonly canWrite: boolean
  readonly canDelete: boolean
  readonly saveStepAction: StudioFormAction
  readonly deleteStepAction: StudioFormAction
  readonly saveFieldAction: StudioFormAction
  readonly deleteFieldAction: StudioFormAction
  readonly reorderFieldsAction: StudioFormAction
}) {
  const { step, fields } = entry
  const isContact = step.key === 'contact'

  return (
    <details className="border-t border-[--color-border] pt-4" data-form-step={step.key}>
      <summary className="cursor-pointer list-none">
        <Text size="sm" as="span">
          {step.position}. {step.title}
          {step.is_enabled ? '' : ' — not shown'} ({fields.length})
        </Text>
      </summary>

      <Stack gap={6} className="pt-6">
        <ActionForm action={saveStepAction} className="grid max-w-2xl gap-4">
          <input type="hidden" name="form_id" value={formId} />
          <input type="hidden" name="id" value={step.id} />
          <TextField
            name="title"
            label={t('studio.catalog.form.stepTitle')}
            defaultValue={step.title}
            required
            requiredLabel={t('studio.catalog.form.requiredLabel')}
          />
          <TextAreaField
            name="description"
            label={t('studio.catalog.form.stepDescription')}
            defaultValue={step.description ?? ''}
            rows={2}
          />
          {/*
            THE CONTACT STEP HAS NO "shown to visitors" CHECKBOX AT ALL, because
            `customization_form_steps_contact_enabled` refuses a disabled one at the column. A
            checkbox that always fails is worse than no checkbox: it looks like a setting. The
            hidden input keeps the value true so the save does not clear it.
          */}
          {isContact ? (
            <input type="hidden" name="is_enabled" value="on" />
          ) : (
            <Checkbox
              name="is_enabled"
              defaultChecked={step.is_enabled}
              label={t('studio.catalog.form.stepEnabled')}
            />
          )}
          <Checkbox
            name="is_required"
            defaultChecked={step.is_required}
            label={t('studio.catalog.form.stepRequired')}
          />
          <div>
            <Button type="submit" disabled={!canWrite}>
              {t('studio.catalog.form.stepSave')}
            </Button>
          </div>
        </ActionForm>

        {!isContact && canDelete ? (
          <ActionForm action={deleteStepAction}>
            <input type="hidden" name="form_id" value={formId} />
            <input type="hidden" name="id" value={step.id} />
            <Button type="submit" variant="secondary">
              {t('studio.catalog.form.stepDelete')}
            </Button>
          </ActionForm>
        ) : null}

        <Divider />

        <PageHeader level={3} title={t('studio.catalog.form.fieldsHeading')} />
        <HelpText>{t('studio.catalog.form.fieldsNote')}</HelpText>

        {fields.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t('studio.catalog.form.fieldsEmpty')}
          </Text>
        ) : (
          <>
            <ActionForm action={reorderFieldsAction} className="grid max-w-md gap-3">
              <input type="hidden" name="form_id" value={formId} />
              <input type="hidden" name="step_id" value={step.id} />
              {fields.map((field) => (
                <TextField
                  key={field.id}
                  name={`order:${field.id}`}
                  label={`${field.label} — ${t('studio.catalog.form.fieldPosition')}`}
                  defaultValue={String(field.position)}
                />
              ))}
              <div>
                <Button type="submit" variant="secondary" disabled={!canWrite}>
                  {t('studio.catalog.form.orderSave')}
                </Button>
              </div>
            </ActionForm>

            {fields.map((field) => (
              <details key={field.id} className="pt-2" data-form-field={field.key}>
                <summary className="cursor-pointer list-none">
                  <Text size="sm" as="span">
                    {field.position}. {field.label} — {field.field_type}
                    {field.is_required ? ' *' : ''}
                  </Text>
                </summary>
                <div className="pt-4">
                  <QuestionForm
                    formId={formId}
                    stepId={step.id}
                    field={field}
                    canWrite={canWrite}
                    canDelete={canDelete}
                    saveAction={saveFieldAction}
                    deleteAction={deleteFieldAction}
                  />
                </div>
              </details>
            ))}
          </>
        )}

        {canWrite ? (
          <>
            <Divider />
            <PageHeader level={3} title={t('studio.catalog.form.fieldAddHeading')} />
            <QuestionForm
              formId={formId}
              stepId={step.id}
              field={null}
              canWrite={canWrite}
              canDelete={false}
              saveAction={saveFieldAction}
              deleteAction={deleteFieldAction}
            />
          </>
        ) : null}
      </Stack>
    </details>
  )
}
