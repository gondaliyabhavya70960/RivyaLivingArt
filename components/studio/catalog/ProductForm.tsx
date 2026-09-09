'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Divider } from '@/components/primitives/Divider'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { SelectField, TextAreaField, TextField, errorFor } from '@/components/studio/FormField'
import { t } from '@/components/studio/strings'
import { DIMENSION_KEYS } from '@/lib/catalog/validation'

import type { CatalogActionState } from '@/app/(studio)/studio/(shell)/catalog/actions'

/**
 * The product form — the only legitimate origin of a product (SEED §32).
 *
 * A CLIENT COMPONENT, AND THIS ONE EARNS IT. `useActionState` keeps the editor's typed values on
 * the page when the server refuses, and puts each refusal beside the field that caused it. The
 * alternative this codebase uses elsewhere — a plain `<form action>` posting to a Server Action
 * that redirects with a `?notice=` code — is right for the users page, where a refusal means one
 * sentence and two fields. A product carries twenty-odd fields and up to a dozen simultaneous
 * refusals, and discarding all of them to show a code in the URL is not a trade worth making.
 *
 * IT IS STILL A REAL `<form action={…}>`. Before hydration the browser submits it and the server
 * handles it; nothing here is required for the form to work, only for it to work pleasantly.
 *
 * IT VALIDATES NOTHING ITSELF. Every rule lives in `lib/catalog/validation.ts` and runs on the
 * server. Duplicating them here would create a second definition of a valid product that can
 * disagree with the first — and the one that matters is the one the database sees.
 *
 * THE AMOUNT FIELDS ARE IN MAJOR UNITS. An editor types 12500, not 1250000; `actions.ts` converts
 * once. Asking for minor units is asking for a price wrong by a hundredfold.
 */

export interface ProductFormOption {
  readonly value: string
  readonly label: string
}

export interface ProductFormValues {
  readonly id: string | null
  readonly slug: string
  readonly sku: string
  readonly title: string
  readonly subtitle: string
  readonly summary: string
  readonly description: string
  readonly categoryId: string
  readonly priceState: string
  readonly priceMajor: string
  readonly priceFromMajor: string
  readonly currency: string
  readonly availabilityState: string
  readonly editionState: string
  readonly editionSize: string
  readonly isCustomizable: boolean
  readonly isLargeFormat: boolean
  readonly sortOrder: string
  readonly heroMediaId: string
  readonly seoTitle: string
  readonly seoDescription: string
  readonly dimensions: Readonly<Record<string, string>>
  readonly materialIds: readonly string[]
}

const PRICE_STATES = ['FIXED', 'STARTING_FROM', 'REQUEST_QUOTE', 'PRICE_ON_REQUEST'] as const
const AVAILABILITY = ['READY_STOCK', 'MADE_TO_ORDER'] as const
const EDITIONS = ['ONE_OF_ONE', 'LIMITED_EDITION', 'OPEN_EDITION'] as const

/** A select that may legitimately hold nothing gets an explicit "Not set", never a blank row. */
function withNone(options: readonly ProductFormOption[]): ProductFormOption[] {
  return [{ value: '', label: t('studio.catalog.product.none') }, ...options]
}

export function ProductForm({
  values,
  categories,
  materials,
  mediaOptions,
  action,
  canWrite,
}: {
  readonly values: ProductFormValues
  readonly categories: readonly ProductFormOption[]
  readonly materials: readonly ProductFormOption[]
  readonly mediaOptions: readonly ProductFormOption[]
  readonly action: (state: CatalogActionState, form: FormData) => Promise<CatalogActionState>
  readonly canWrite: boolean
}): React.ReactElement {
  const [state, submit, pending] = useActionState(action, { status: 'idle' } as CatalogActionState)
  /*
   * `ValidationIssue.field` becomes `FieldIssue.path` once, here.
   *
   * The two names are not a mistake to unify: `path` is the form layer's word for "which control",
   * and `field` is the rule layer's word for "which column". `lib/catalog/validation.ts` is pure
   * and knows nothing about forms — that is what lets the Server Action reuse it — so the
   * translation belongs at the boundary rather than inside either side.
   */
  const issues = (state.status === 'error' ? state.issues : []).map((issue) => ({
    path: issue.field,
    message: issue.message,
  }))
  const formError = errorFor(issues, '_form')

  return (
    <form action={submit} data-product-form="">
      <Stack gap={8}>
        {values.id === null ? null : <input type="hidden" name="id" value={values.id} />}

        {formError === undefined ? null : (
          <Text tone="secondary" data-form-error="">
            {formError}
          </Text>
        )}
        {state.status === 'saved' ? (
          <Text data-form-saved="">{t('studio.catalog.product.saved')}</Text>
        ) : null}

        <Stack gap={4}>
          <Heading level={2} size="display-xs">
            {t('studio.catalog.product.identityHeading')}
          </Heading>
          <TextField
            name="slug"
            label={t('studio.catalog.product.slug')}
            help={t('studio.catalog.product.slugHelp')}
            defaultValue={values.slug}
            issues={issues}
            required
            requiredLabel={t('studio.catalog.requiredLabel')}
          />
          <TextField
            name="sku"
            label={t('studio.catalog.product.sku')}
            defaultValue={values.sku}
            issues={issues}
          />
          <SelectField
            name="category_id"
            label={t('studio.catalog.product.category')}
            defaultValue={values.categoryId}
            options={withNone(categories)}
            issues={issues}
          />
        </Stack>

        <Divider />

        <Stack gap={4}>
          <Heading level={2} size="display-xs">
            {t('studio.catalog.product.copyHeading')}
          </Heading>
          <TextField
            name="title"
            label={t('studio.catalog.product.title')}
            defaultValue={values.title}
            issues={issues}
          />
          <TextField
            name="subtitle"
            label={t('studio.catalog.product.subtitle')}
            defaultValue={values.subtitle}
            issues={issues}
          />
          <TextAreaField
            name="summary"
            label={t('studio.catalog.product.summary')}
            defaultValue={values.summary}
            issues={issues}
            rows={3}
          />
          <TextAreaField
            name="description"
            label={t('studio.catalog.product.description')}
            defaultValue={values.description}
            issues={issues}
            rows={8}
          />
        </Stack>

        <Divider />

        <Stack gap={4}>
          <Heading level={2} size="display-xs">
            {t('studio.catalog.product.commerceHeading')}
          </Heading>
          <SelectField
            name="price_state"
            label={t('studio.catalog.product.priceState')}
            help={t('studio.catalog.product.priceStateHelp')}
            defaultValue={values.priceState}
            options={PRICE_STATES.map((state_) => ({
              value: state_,
              label: t(`studio.catalog.priceState.${state_}`),
            }))}
            issues={issues}
            required
            requiredLabel={t('studio.catalog.requiredLabel')}
          />
          <TextField
            name="price_major"
            label={t('studio.catalog.product.priceMajor')}
            help={t('studio.catalog.product.amountHelp')}
            defaultValue={values.priceMajor}
            issues={issues}
          />
          <TextField
            name="price_from_major"
            label={t('studio.catalog.product.priceFromMajor')}
            help={t('studio.catalog.product.amountHelp')}
            defaultValue={values.priceFromMajor}
            issues={issues}
          />
          <TextField
            name="currency"
            label={t('studio.catalog.product.currency')}
            help={t('studio.catalog.product.currencyHelp')}
            defaultValue={values.currency}
            issues={issues}
          />
          <SelectField
            name="availability_state"
            label={t('studio.catalog.product.availability')}
            help={t('studio.catalog.product.availabilityHelp')}
            defaultValue={values.availabilityState}
            options={withNone(
              AVAILABILITY.map((value) => ({
                value,
                label: t(`studio.catalog.availability.${value}`),
              })),
            )}
            issues={issues}
          />
          <SelectField
            name="edition_state"
            label={t('studio.catalog.product.edition')}
            defaultValue={values.editionState}
            options={withNone(
              EDITIONS.map((value) => ({ value, label: t(`studio.catalog.edition.${value}`) })),
            )}
            issues={issues}
          />
          <TextField
            name="edition_size"
            label={t('studio.catalog.product.editionSize')}
            help={t('studio.catalog.product.editionSizeHelp')}
            defaultValue={values.editionSize}
            issues={issues}
          />
        </Stack>

        <Divider />

        <Stack gap={4}>
          <Heading level={2} size="display-xs">
            {t('studio.catalog.product.specificationHeading')}
          </Heading>

          <fieldset className="border-0 p-0">
            <legend className="text-ink-secondary text-sm">
              {t('studio.catalog.product.materials')}
            </legend>
            {materials.length === 0 ? (
              <Text tone="secondary" size="sm">
                {t('studio.catalog.product.materialsEmpty')}
              </Text>
            ) : (
              <Stack gap={2} className="mt-2">
                {materials.map((material) => (
                  <Checkbox
                    key={material.value}
                    name="material_ids"
                    value={material.value}
                    defaultChecked={values.materialIds.includes(material.value)}
                    label={material.label}
                  />
                ))}
              </Stack>
            )}
          </fieldset>

          <fieldset className="border-0 p-0">
            <legend className="text-ink-secondary text-sm">
              {t('studio.catalog.product.dimensions')}
            </legend>
            <Text tone="secondary" size="sm">
              {t('studio.catalog.product.dimensionsHelp')}
            </Text>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {DIMENSION_KEYS.map((key) => (
                <TextField
                  key={key}
                  name={`dimensions.${key}`}
                  label={key}
                  defaultValue={values.dimensions[key] ?? ''}
                  issues={issues}
                />
              ))}
            </div>
            {errorFor(issues, 'dimensions') === undefined ? null : (
              <Text tone="secondary" size="sm" data-dimensions-error="">
                {errorFor(issues, 'dimensions')}
              </Text>
            )}
          </fieldset>

          <SelectField
            name="hero_media_id"
            label={t('studio.catalog.product.heroMedia')}
            help={t('studio.catalog.product.heroMediaHelp')}
            defaultValue={values.heroMediaId}
            options={withNone(mediaOptions)}
            issues={issues}
          />

          <Checkbox
            name="is_customizable"
            defaultChecked={values.isCustomizable}
            label={t('studio.catalog.product.customizable')}
          />
          <Checkbox
            name="is_large_format"
            defaultChecked={values.isLargeFormat}
            label={t('studio.catalog.product.largeFormat')}
          />
          <TextField
            name="sort_order"
            label={t('studio.catalog.product.sortOrder')}
            help={t('studio.catalog.product.sortOrderHelp')}
            defaultValue={values.sortOrder}
            issues={issues}
          />
        </Stack>

        <Divider />

        <Stack gap={4}>
          <Heading level={2} size="display-xs">
            {t('studio.catalog.product.seoHeading')}
          </Heading>
          <TextField
            name="seo_title"
            label={t('studio.catalog.product.seoTitle')}
            defaultValue={values.seoTitle}
            issues={issues}
          />
          <TextAreaField
            name="seo_description"
            label={t('studio.catalog.product.seoDescription')}
            defaultValue={values.seoDescription}
            issues={issues}
            rows={3}
          />
        </Stack>

        {/*
         * A ROLE WITHOUT `catalog.write` SEES NO SUBMIT BUTTON, and the action refuses it anyway.
         * The button is hidden rather than disabled because a disabled control that never becomes
         * enabled reads as a broken interface rather than as a boundary.
         */}
        {canWrite ? (
          <Button type="submit" loading={pending}>
            {values.id === null
              ? t('studio.catalog.product.create')
              : t('studio.catalog.product.save')}
          </Button>
        ) : null}
      </Stack>
    </form>
  )
}
