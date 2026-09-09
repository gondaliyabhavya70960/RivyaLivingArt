import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { FormStepPanel } from '@/components/studio/catalog/FormStepPanel'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { NotFoundError } from '@/lib/supabase/errors'
import {
  listCategoriesForStudio,
  listProductsForStudio,
} from '@/lib/supabase/repositories/catalog-admin'
import { getFormById, listBindings } from '@/lib/supabase/repositories/customization-forms'
import { createClient } from '@/lib/supabase/server'

import {
  addBindingAction,
  deleteFieldAction,
  deleteStepAction,
  publishFormAction,
  removeBindingAction,
  reorderFieldsAction,
  reorderStepsAction,
  saveFieldAction,
  saveFormAction,
  saveStepAction,
  unpublishFormAction,
} from './actions'

/**
 * /studio/catalog/customization-forms/[formId] — the form builder.
 *
 * ONE SCREEN, COLLAPSED, RATHER THAN TABS. A form is a sequence, and a sequence split across tabs
 * stops reading as one: the question a builder is answering is "does this brief make sense end to
 * end", which needs every step on the same page. `<details>` keeps that page navigable without
 * turning eleven steps into eleven routes.
 *
 * THE PUBLISH BAND STATES ITS OWN REFUSALS. `enforce_form_publishable()` names three conditions,
 * and all three are invisible until they fire — so they are written above the button rather than
 * discovered by pressing it. The action re-checks them and reports every failure at once.
 *
 * PUBLISHING IS NOT THE SAME AS APPEARING. `/custom-commissions` renders the configurator only when
 * the `commission_configurator` flag is on, and Phase 20 owns the half that saves a completed
 * brief. The note beside the button says so, because a published form that does not appear on the
 * site looks like a fault rather than a deliberate sequence.
 *
 * ORDER IS EDITED AS NUMBERS AND SAVED AS A SEQUENCE — amendment A15·d. The contact step is forced
 * last by the database whatever number it is given, which the help text says rather than the form
 * silently correcting it afterwards.
 */
export const metadata = studioMetadata('/studio/catalog/customization-forms')

const KIND_OPTIONS = [
  { value: 'FURNITURE', label: 'FURNITURE' },
  { value: 'PRESERVATION', label: 'PRESERVATION' },
  { value: 'THREE_D_RESIN', label: 'THREE_D_RESIN' },
  { value: 'CUSTOM', label: 'CUSTOM' },
] as const

export default async function Page({ params }: { readonly params: Promise<{ formId: string }> }) {
  const session = await requirePermission('catalog.read')
  const { formId } = await params

  const client = await createClient()
  const resolved = await getFormById(client, formId).catch((error: unknown) => {
    // A form this role cannot see and one that does not exist are indistinguishable under RLS, and
    // must stay that way.
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (resolved === null) notFound()

  const [bindings, products, categories] = await Promise.all([
    listBindings(client, resolved.form.id),
    listProductsForStudio(client, {}),
    listCategoriesForStudio(client),
  ])

  const canWrite = roleHasPermission(session.role, 'catalog.write')
  const canPublish = roleHasPermission(session.role, 'catalog.publish')
  const canDelete = roleHasPermission(session.role, 'destructive.execute')
  const published = resolved.form.status === 'PUBLISHED'

  const productNames = new Map(products.map((product) => [product.id, product.title]))
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))

  return (
    <StudioPage path="/studio/catalog/customization-forms">
      <Stack gap={8}>
        <PageHeader
          level={1}
          title={resolved.form.name || t('studio.catalog.form.untitled')}
          description={resolved.form.slug}
          actions={<StatusPill status={resolved.form.status} />}
        />

        <Link
          href={'/studio/catalog/customization-forms' as Route}
          className="underline underline-offset-4"
        >
          <Text size="sm" as="span">
            {t('studio.catalog.form.back')}
          </Text>
        </Link>

        <Divider />

        <PageHeader level={2} title={t('studio.catalog.form.identityHeading')} />
        <ActionForm action={saveFormAction} className="grid max-w-2xl gap-4">
          <input type="hidden" name="id" value={resolved.form.id} />
          <TextField
            name="name"
            label={t('studio.catalog.form.name')}
            defaultValue={resolved.form.name}
            required
            requiredLabel={t('studio.catalog.form.requiredLabel')}
          />
          <TextField
            name="slug"
            label={t('studio.catalog.form.slug')}
            defaultValue={resolved.form.slug}
            required
            requiredLabel={t('studio.catalog.form.requiredLabel')}
          />
          <SelectField
            name="kind"
            label={t('studio.catalog.form.kind')}
            defaultValue={resolved.form.kind}
            options={[...KIND_OPTIONS]}
          />
          <TextAreaField
            name="description"
            label={t('studio.catalog.form.description')}
            help={t('studio.catalog.form.descriptionHelp')}
            defaultValue={resolved.form.description ?? ''}
            rows={3}
          />
          <TextField
            name="intro_heading"
            label={t('studio.catalog.form.introHeading')}
            help={t('studio.catalog.form.introHelp')}
            defaultValue={resolved.form.intro_heading ?? ''}
          />
          <TextAreaField
            name="intro_body"
            label={t('studio.catalog.form.introBody')}
            defaultValue={resolved.form.intro_body ?? ''}
            rows={3}
          />
          <TextField
            name="submit_label_key"
            label={t('studio.catalog.form.submitLabelKey')}
            help={t('studio.catalog.form.submitLabelKeyHelp')}
            defaultValue={resolved.form.submit_label_key ?? ''}
          />
          <Checkbox
            name="is_default"
            defaultChecked={resolved.form.is_default}
            label={t('studio.catalog.form.isDefault')}
          />
          <div>
            <Button type="submit" disabled={!canWrite}>
              {t('studio.catalog.form.save')}
            </Button>
          </div>
        </ActionForm>

        <Divider />

        <PageHeader level={2} title={t('studio.catalog.form.publishHeading')} />
        <HelpText>{t('studio.catalog.form.publishBody')}</HelpText>
        <HelpText>{t('studio.catalog.form.flagNote')}</HelpText>
        {/*
          THE CONTROLS ARE ABSENT FOR A ROLE THAT MAY NOT USE THEM, not disabled. A greyed-out
          publish button reads as "ask someone to enable this", which is the wrong idea: the
          decision is not theirs to make. The Server Action checks `catalog.publish` again
          regardless — this is the affordance, not the guard.
        */}
        {canPublish ? (
          <ActionForm action={published ? unpublishFormAction : publishFormAction}>
            <input type="hidden" name="id" value={resolved.form.id} />
            <Button type="submit" variant={published ? 'secondary' : 'primary'}>
              {published ? t('studio.catalog.form.unpublish') : t('studio.catalog.form.publish')}
            </Button>
          </ActionForm>
        ) : null}

        <Divider />

        <PageHeader level={2} title={t('studio.catalog.form.stepsHeading')} />
        <HelpText>{t('studio.catalog.form.stepsHelp')}</HelpText>

        {resolved.steps.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t('studio.catalog.form.stepsEmpty')}
          </Text>
        ) : (
          <>
            <ActionForm action={reorderStepsAction} className="grid max-w-md gap-3">
              <input type="hidden" name="form_id" value={resolved.form.id} />
              {resolved.steps.map((entry) => (
                <TextField
                  key={entry.step.id}
                  name={`order:${entry.step.id}`}
                  label={`${entry.step.title} — ${t('studio.catalog.form.stepPosition')}`}
                  defaultValue={String(entry.step.position)}
                />
              ))}
              <div>
                <Button type="submit" variant="secondary" disabled={!canWrite}>
                  {t('studio.catalog.form.orderSave')}
                </Button>
              </div>
            </ActionForm>

            {resolved.steps.map((entry) => (
              <FormStepPanel
                key={entry.step.id}
                formId={resolved.form.id}
                entry={entry}
                canWrite={canWrite}
                canDelete={canDelete}
                saveStepAction={saveStepAction}
                deleteStepAction={deleteStepAction}
                saveFieldAction={saveFieldAction}
                deleteFieldAction={deleteFieldAction}
                reorderFieldsAction={reorderFieldsAction}
              />
            ))}
          </>
        )}

        {canWrite ? (
          <>
            <Divider />
            <PageHeader level={2} title={t('studio.catalog.form.stepAddHeading')} />
            <ActionForm action={saveStepAction} className="grid max-w-2xl gap-4">
              <input type="hidden" name="form_id" value={resolved.form.id} />
              <TextField
                name="key"
                label={t('studio.catalog.form.stepKey')}
                help={t('studio.catalog.form.stepKeyHelp')}
                required
                requiredLabel={t('studio.catalog.form.requiredLabel')}
              />
              <TextField
                name="title"
                label={t('studio.catalog.form.stepTitle')}
                required
                requiredLabel={t('studio.catalog.form.requiredLabel')}
              />
              <TextAreaField
                name="description"
                label={t('studio.catalog.form.stepDescription')}
                rows={2}
              />
              <Checkbox
                name="is_enabled"
                defaultChecked
                label={t('studio.catalog.form.stepEnabled')}
              />
              <Checkbox name="is_required" label={t('studio.catalog.form.stepRequired')} />
              <div>
                <Button type="submit">{t('studio.catalog.form.stepAdd')}</Button>
              </div>
            </ActionForm>
          </>
        ) : null}

        <Divider />

        <PageHeader level={2} title={t('studio.catalog.form.bindingsHeading')} />
        <HelpText>{t('studio.catalog.form.bindingsHelp')}</HelpText>

        {bindings.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t('studio.catalog.form.bindingsEmpty')}
          </Text>
        ) : (
          <Stack gap={3}>
            {bindings.map((binding) => (
              <div
                key={binding.id}
                className="flex flex-wrap items-center gap-3"
                data-form-binding={binding.id}
              >
                <Text size="sm" as="span">
                  {binding.product_id !== null
                    ? `${t('studio.catalog.form.bindingProduct')}: ${productNames.get(binding.product_id) ?? binding.product_id}`
                    : `${t('studio.catalog.form.bindingCategory')}: ${categoryNames.get(binding.category_id ?? '') ?? binding.category_id}`}
                </Text>
                {canWrite ? (
                  <ActionForm action={removeBindingAction}>
                    <input type="hidden" name="form_id" value={resolved.form.id} />
                    <input type="hidden" name="id" value={binding.id} />
                    <Button type="submit" variant="secondary">
                      {t('studio.catalog.form.bindingRemove')}
                    </Button>
                  </ActionForm>
                ) : null}
              </div>
            ))}
          </Stack>
        )}

        {canWrite ? (
          <ActionForm action={addBindingAction} className="grid max-w-md gap-4">
            <input type="hidden" name="form_id" value={resolved.form.id} />
            <SelectField
              name="product_id"
              label={t('studio.catalog.form.bindingProduct')}
              defaultValue=""
              options={[
                { value: '', label: t('studio.catalog.form.bindingNone') },
                // A product's title is nullable at the column and its slug is not, so an untitled
                // draft still appears as something a merchandiser can pick rather than a blank row.
                ...products.map((product) => ({
                  value: product.id,
                  label: product.title ?? product.slug,
                })),
              ]}
            />
            <SelectField
              name="category_id"
              label={t('studio.catalog.form.bindingCategory')}
              defaultValue=""
              options={[
                { value: '', label: t('studio.catalog.form.bindingNone') },
                // A category's name is nullable at the column; its slug is not. A picker showing a
                // blank row would be a row nobody can choose on purpose.
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name ?? category.slug,
                })),
              ]}
            />
            <div>
              <Button type="submit">{t('studio.catalog.form.bindingAdd')}</Button>
            </div>
          </ActionForm>
        ) : null}

        <Divider />

        <PageHeader level={2} title={t('studio.catalog.form.previewHeading')} />
        <HelpText>{t('studio.catalog.form.previewBody')}</HelpText>
        <Link href={'/custom-commissions' as Route} className="underline underline-offset-4">
          <Text size="sm" as="span">
            {t('studio.catalog.form.preview')}
          </Text>
        </Link>
      </Stack>
    </StudioPage>
  )
}
