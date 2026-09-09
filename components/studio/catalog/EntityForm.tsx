'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { SelectField, TextAreaField, TextField, errorFor } from '@/components/studio/FormField'
import { t, type StudioStringKey } from '@/components/studio/strings'

import type { CatalogActionState } from '@/app/(studio)/studio/(shell)/catalog/actions'

/**
 * The small catalogue forms — a category, a material, a collection.
 *
 * ONE COMPONENT FOR THREE ENTITIES, described by a field list rather than three near-identical
 * files. The product form is deliberately NOT built this way: it has twenty-odd fields with real
 * relationships between them (a price state decides which amount field means anything), and
 * expressing that through a generic descriptor would be harder to read than writing it out.
 * These three are flat lists of text.
 *
 * IT VALIDATES NOTHING. Every rule is in the Server Action, so the form and the action cannot
 * disagree — and a request that skipped the form meets the same rules.
 */

export type EntityFieldKind = 'text' | 'textarea' | 'select'

export interface EntityField {
  readonly name: string
  readonly labelKey: StudioStringKey
  readonly helpKey?: StudioStringKey
  readonly kind?: EntityFieldKind
  readonly required?: boolean
  readonly defaultValue?: string
  readonly options?: readonly { value: string; label: string }[]
  readonly rows?: number
}

export function EntityForm({
  id,
  fields,
  action,
  submitLabelKey,
  canWrite,
  note,
}: {
  /** Null when this form creates a row rather than editing one. */
  readonly id: string | null
  readonly fields: readonly EntityField[]
  readonly action: (state: CatalogActionState, form: FormData) => Promise<CatalogActionState>
  readonly submitLabelKey: StudioStringKey
  readonly canWrite: boolean
  /** A sentence shown above the fields — used for the collection concept rule. */
  readonly note?: string
}): React.ReactElement {
  const [state, submit, pending] = useActionState(action, { status: 'idle' } as CatalogActionState)
  const issues = (state.status === 'error' ? state.issues : []).map((issue) => ({
    path: issue.field,
    message: issue.message,
  }))
  const formError = errorFor(issues, '_form')

  return (
    <form action={submit} data-entity-form="">
      <Stack gap={4}>
        {id === null ? null : <input type="hidden" name="id" value={id} />}
        {note === undefined ? null : (
          <Text tone="secondary" size="sm">
            {note}
          </Text>
        )}
        {formError === undefined ? null : (
          <Text tone="secondary" data-form-error="">
            {formError}
          </Text>
        )}
        {state.status === 'saved' ? (
          <Text data-form-saved="">{t('studio.catalog.product.saved')}</Text>
        ) : null}

        {fields.map((field) => {
          const common = {
            name: field.name,
            label: t(field.labelKey),
            issues,
            defaultValue: field.defaultValue ?? '',
            ...(field.helpKey === undefined ? {} : { help: t(field.helpKey) }),
            ...(field.required === true
              ? { required: true, requiredLabel: t('studio.catalog.requiredLabel') }
              : {}),
          }

          if (field.kind === 'textarea') {
            return <TextAreaField key={field.name} {...common} rows={field.rows ?? 4} />
          }
          if (field.kind === 'select') {
            return <SelectField key={field.name} {...common} options={field.options ?? []} />
          }
          return <TextField key={field.name} {...common} />
        })}

        {canWrite ? (
          <Button type="submit" loading={pending}>
            {t(submitLabelKey)}
          </Button>
        ) : null}
      </Stack>
    </form>
  )
}
