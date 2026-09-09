'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Divider } from '@/components/primitives/Divider'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { TextField, errorFor } from '@/components/studio/FormField'
import { t } from '@/components/studio/strings'

import type { TabActionState } from '@/app/(studio)/studio/(shell)/catalog/products/[productId]/tab-actions'

import { fieldIssues } from './tab-issues'

/**
 * The Specifications tab — the strictest surface in the Studio, for the strictest block on the site.
 *
 * WHAT IS NOT HERE IS THE DESIGN. There is no "not applicable" option, no unit converter, no
 * "estimate" checkbox and no placeholder text to choose from, because every one of those is a way
 * to publish a sentence nobody measured. A row exists when the owner has something to say and does
 * not exist otherwise; the block on the product page then has one fewer line, and a visitor reads
 * nothing at all rather than a dash that implies a value is being withheld.
 *
 * THE VALUE IS A STRING AND STAYS A STRING. "450", "45–50" and "made to order" are all valid and
 * all stored verbatim. The moment this form parsed a number out of it, unit conversion would be one
 * convenience away — and a millimetre silently rendered in inches is a fabricated measurement even
 * though every digit came from the owner.
 *
 * THE OMISSION CONTROL IS THE HONEST ESCAPE. The Specifications readiness item is REQUIRED, so a
 * product cannot publish while the question is open. If the only way to close it were to enter a
 * row, the checklist itself would be an incentive to invent one. The checkbox at the bottom closes
 * it the other way: a recorded decision that this piece publishes no specifications. What is
 * required is the decision, never the number.
 *
 * DIMENSIONS ARE SHOWN BUT NOT EDITED HERE. They live on `products.dimensions` and belong to the
 * Overview form; repeating the inputs would give one value two owners. The panel below states
 * where they come from and that nothing converts them.
 */

export interface SpecRow {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly unit: string | null
  readonly groupLabel: string | null
  readonly sortOrder: number
}

export interface ProductSpecsTabProps {
  readonly productId: string
  readonly specs: readonly SpecRow[]
  /** The non-null keys of `products.dimensions`, already resolved to `key: value` strings. */
  readonly dimensions: readonly { readonly key: string; readonly value: string }[]
  readonly specificationsOmitted: boolean
  readonly canWrite: boolean
  readonly saveAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
  readonly deleteAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
  readonly omitAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
}

const IDLE: TabActionState = { status: 'idle' }

function SpecFields({
  spec,
  issues,
}: {
  spec: SpecRow | null
  issues: readonly { path: string; message: string }[]
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <TextField
        name="label"
        label={t('studio.catalog.product.specs.labelLabel')}
        defaultValue={spec?.label ?? ''}
        issues={issues}
      />
      <TextField
        name="value"
        label={t('studio.catalog.product.specs.valueLabel')}
        defaultValue={spec?.value ?? ''}
        issues={issues}
      />
      <TextField
        name="unit"
        label={t('studio.catalog.product.specs.unitLabel')}
        defaultValue={spec?.unit ?? ''}
        issues={issues}
      />
      <TextField
        name="group_label"
        label={t('studio.catalog.product.specs.groupLabel')}
        defaultValue={spec?.groupLabel ?? ''}
        issues={issues}
      />
      <TextField
        name="sort_order"
        label={t('studio.catalog.product.specs.orderLabel')}
        defaultValue={spec === null ? '0' : String(spec.sortOrder)}
        issues={issues}
      />
    </div>
  )
}

function SpecRowForm({
  productId,
  spec,
  canWrite,
  saveAction,
  deleteAction,
}: {
  productId: string
  spec: SpecRow
  canWrite: boolean
  saveAction: ProductSpecsTabProps['saveAction']
  deleteAction: ProductSpecsTabProps['deleteAction']
}): React.ReactElement {
  const [saveState, save, saving] = useActionState(saveAction, IDLE)
  const [deleteState, remove, removing] = useActionState(deleteAction, IDLE)
  const saveIssues = fieldIssues(saveState)
  const rowError = errorFor(saveIssues, '_form') ?? errorFor(fieldIssues(deleteState), '_form')

  return (
    <li className="border-b border-line py-4" data-spec-row={spec.id}>
      <Stack gap={3}>
        <form action={save}>
          <Stack gap={3}>
            <input type="hidden" name="product_id" value={productId} />
            <input type="hidden" name="spec_id" value={spec.id} />
            <SpecFields spec={spec} issues={saveIssues} />
            <div>
              <Button type="submit" disabled={!canWrite || saving}>
                {t('studio.catalog.product.save')}
              </Button>
            </div>
          </Stack>
        </form>

        <form action={remove}>
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="spec_id" value={spec.id} />
          <Button type="submit" variant="ghost" disabled={!canWrite || removing}>
            {t('studio.catalog.product.specs.deleteLabel')}
          </Button>
        </form>

        {rowError === undefined ? null : (
          <Text size="sm" tone="secondary" data-form-error="">
            {rowError}
          </Text>
        )}
        {saveState.status === 'saved' || deleteState.status === 'saved' ? (
          <Text size="sm" data-form-saved="">
            {t('studio.catalog.product.saved')}
          </Text>
        ) : null}
      </Stack>
    </li>
  )
}

export function ProductSpecsTab({
  productId,
  specs,
  dimensions,
  specificationsOmitted,
  canWrite,
  saveAction,
  deleteAction,
  omitAction,
}: ProductSpecsTabProps): React.ReactElement {
  const [addState, add, adding] = useActionState(saveAction, IDLE)
  const [omitState, omit, omitting] = useActionState(omitAction, IDLE)
  const addIssues = fieldIssues(addState)
  const addError = errorFor(addIssues, '_form')
  const omitError = errorFor(fieldIssues(omitState), '_form')

  return (
    <Stack gap={6} data-product-specs-tab="">
      <Stack gap={2}>
        <Heading level={2} size="display-xs">
          {t('studio.catalog.product.specs.heading')}
        </Heading>
        <Text size="sm" tone="secondary">
          {t('studio.catalog.product.specs.help')}
        </Text>
        <Text size="sm" tone="secondary" data-omit-help="">
          {t('studio.catalog.product.specs.omitHelp')}
        </Text>
      </Stack>

      {specs.length === 0 ? (
        <Text size="sm" tone="secondary" data-empty="">
          {t('studio.catalog.product.specs.empty')}
        </Text>
      ) : (
        <ul role="list">
          {specs.map((spec) => (
            <SpecRowForm
              key={spec.id}
              productId={productId}
              spec={spec}
              canWrite={canWrite}
              saveAction={saveAction}
              deleteAction={deleteAction}
            />
          ))}
        </ul>
      )}

      <form action={add} data-add-spec="">
        <Stack gap={3}>
          <input type="hidden" name="product_id" value={productId} />
          <SpecFields spec={null} issues={addIssues} />
          <div>
            <Button type="submit" disabled={!canWrite || adding}>
              {t('studio.catalog.product.specs.addLabel')}
            </Button>
          </div>
        </Stack>
      </form>

      {addError === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {addError}
        </Text>
      )}

      <Divider />

      <Stack gap={2} data-dimensions-panel="">
        <Heading level={3} size="display-xs">
          {t('studio.catalog.product.specs.dimensionsHeading')}
        </Heading>
        <Text size="sm" tone="secondary">
          {t('studio.catalog.product.specs.dimensionsHelp')}
        </Text>
        {dimensions.length === 0 ? null : (
          <ul role="list">
            {dimensions.map((entry) => (
              <li key={entry.key}>
                <Text size="sm">{`${entry.key}: ${entry.value}`}</Text>
              </li>
            ))}
          </ul>
        )}
      </Stack>

      <Divider />

      <form action={omit} data-omit-form="">
        <Stack gap={3}>
          <input type="hidden" name="product_id" value={productId} />
          <Checkbox
            id="specifications_omitted"
            name="specifications_omitted"
            defaultChecked={specificationsOmitted}
            label={t('studio.catalog.product.specs.omitLabel')}
          />
          <div>
            <Button type="submit" disabled={!canWrite || omitting}>
              {t('studio.catalog.product.specs.omitSubmit')}
            </Button>
          </div>
        </Stack>
      </form>

      {omitError === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {omitError}
        </Text>
      )}
      {omitState.status === 'saved' ? (
        <Text size="sm" data-form-saved="">
          {t('studio.catalog.product.saved')}
        </Text>
      ) : null}
    </Stack>
  )
}
