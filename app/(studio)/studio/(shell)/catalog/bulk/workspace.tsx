'use client'

import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectionBar } from '@/components/studio/bulk'
import { t } from '@/components/studio/strings'

import { previewBulkAction } from './actions'

/**
 * The selection surface. The ONE client island on this page.
 *
 * IT SELECTS AND IT PREVIEWS, AND IT DOES NOT APPLY. Apply lives on the preview page the action
 * redirects to, because the operator should read the preview on a surface that is not also the one
 * where they were clicking checkboxes a second ago. The four-step flow is Select → Preview →
 * Confirm → Apply, and collapsing the middle two into the same screen is how the middle two stop
 * happening.
 *
 * THE SELECTION TRAVELS AS A FORM FIELD, not in component state read by a fetch. Without
 * JavaScript the checkboxes and the submit still work — this island buys the running count and the
 * over-cap warning, not the feature.
 */

export interface BulkProduct {
  readonly id: string
  readonly label: string
  readonly status: string
}

export interface BulkOperationChoice {
  readonly kind: string
  readonly isDestructive: boolean
  readonly available: boolean
}

export function BulkWorkspace({
  products,
  operations,
  canDestroy,
  maxSelection,
}: {
  readonly products: readonly BulkProduct[]
  readonly operations: readonly BulkOperationChoice[]
  readonly canDestroy: boolean
  readonly maxSelection: number
  readonly activeOperationId: string | null
}): React.ReactElement {
  const [selected, setSelected] = React.useState<readonly string[]>([])

  const toggle = (id: string): void => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  return (
    <ActionForm action={previewBulkAction}>
      <Stack gap={6}>
        <Surface level={1} className="p-6">
          <fieldset>
            <legend className="mb-3 text-sm uppercase tracking-technical">
              {t('studio.bulk.chooseOperation')}
            </legend>
            <select
              name="kind"
              required
              className="border border-line bg-surface px-3 py-2 text-sm"
              data-operation-select
            >
              {operations.map((operation) => {
                // A DESTRUCTIVE OPERATION IS DISABLED RATHER THAN HIDDEN for a role without
                // `destructive.execute`. Absent, it teaches the operator the feature does not
                // exist; disabled, it teaches them who to ask. The engine refuses either way.
                const blocked = operation.isDestructive && !canDestroy
                return (
                  <option
                    key={operation.kind}
                    value={operation.kind}
                    disabled={blocked || !operation.available}
                  >
                    {operation.kind}
                    {blocked ? ' — needs an owner or admin' : ''}
                    {operation.available ? '' : ' — not available yet'}
                  </option>
                )
              })}
            </select>
            <input type="hidden" name="params" value="{}" />
          </fieldset>
        </Surface>

        <Surface level={1} className="p-6">
          <ul className="list-none" data-bulk-rows>
            {products.map((product) => (
              <li key={product.id} className="flex items-center gap-3 border-b border-line py-2">
                <input
                  type="checkbox"
                  name="selection"
                  value={product.id}
                  id={`bulk-${product.id}`}
                  checked={selected.includes(product.id)}
                  onChange={() => toggle(product.id)}
                />
                <label htmlFor={`bulk-${product.id}`} className="flex-1 text-sm">
                  {product.label}
                </label>
                <Text size="sm" tone="secondary">
                  {product.status}
                </Text>
              </li>
            ))}
          </ul>
        </Surface>

        <SelectionBar selectedCount={selected.length} maxSelection={maxSelection}>
          <button
            type="submit"
            className="border border-ink px-4 py-2 text-sm uppercase tracking-technical"
            data-bulk-preview
          >
            {t('studio.bulk.preview')}
          </button>
        </SelectionBar>
      </Stack>
    </ActionForm>
  )
}
