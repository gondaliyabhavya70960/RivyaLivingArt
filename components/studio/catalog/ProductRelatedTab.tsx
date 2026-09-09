'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { SelectField, TextField, errorFor } from '@/components/studio/FormField'
import { t } from '@/components/studio/strings'

import type { TabActionState } from '@/app/(studio)/studio/(shell)/catalog/products/[productId]/tab-actions'

import { fieldIssues } from './tab-issues'

/**
 * The Related tab: edges an editor makes by hand, and nothing else.
 *
 * NO SUGGESTIONS, NO "PRODUCTS LIKE THIS", NO AFFINITY. FEAT §11 allows exactly one automatic
 * behaviour on the public page — up to six other published products in the same category — and it
 * is rendered under its own heading, "More in {Category}", never under "Related". That distinction
 * is the entire point: "Related" is a claim an editor made, and the fallback is an observation
 * about a category. This tab creates only the first kind. The helper string says so, so nobody
 * reads an empty list as a missing feature.
 *
 * THE TARGET IS AN ID THE EDITOR PASTES OR PICKS. There is no search-as-you-type here: Phase 23
 * builds the relationship engine and its picker, and a half-built one now would be the surface
 * where an automatic suggestion first appears.
 */

export interface RelationRow {
  readonly id: string
  readonly targetType: string
  readonly targetId: string
  readonly targetLabel: string | null
  readonly relationType: string
  readonly sortOrder: number
}

export interface ProductRelatedTabProps {
  readonly productId: string
  readonly relations: readonly RelationRow[]
  readonly targetTypes: readonly string[]
  readonly relationTypes: readonly string[]
  readonly canWrite: boolean
  readonly createAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
  readonly deleteAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
}

const IDLE: TabActionState = { status: 'idle' }

function RelationRowForm({
  productId,
  relation,
  canWrite,
  deleteAction,
}: {
  productId: string
  relation: RelationRow
  canWrite: boolean
  deleteAction: ProductRelatedTabProps['deleteAction']
}): React.ReactElement {
  const [state, remove, removing] = useActionState(deleteAction, IDLE)
  const error = errorFor(fieldIssues(state), '_form')

  return (
    <li className="border-b border-line py-4" data-relation-row={relation.id}>
      <Stack gap={2}>
        <Text size="sm">
          {`${relation.relationType} → ${relation.targetType}: ${relation.targetLabel ?? relation.targetId}`}
        </Text>
        <form action={remove}>
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="relation_id" value={relation.id} />
          <Button type="submit" variant="ghost" disabled={!canWrite || removing}>
            {t('studio.catalog.product.related.deleteLabel')}
          </Button>
        </form>
        {error === undefined ? null : (
          <Text size="sm" tone="secondary" data-form-error="">
            {error}
          </Text>
        )}
      </Stack>
    </li>
  )
}

export function ProductRelatedTab({
  productId,
  relations,
  targetTypes,
  relationTypes,
  canWrite,
  createAction,
  deleteAction,
}: ProductRelatedTabProps): React.ReactElement {
  const [state, create, creating] = useActionState(createAction, IDLE)
  const issues = fieldIssues(state)
  const formError = errorFor(issues, '_form')

  return (
    <Stack gap={6} data-product-related-tab="">
      <Stack gap={2}>
        <Heading level={2} size="display-xs">
          {t('studio.catalog.product.related.heading')}
        </Heading>
        <Text size="sm" tone="secondary">
          {t('studio.catalog.product.related.help')}
        </Text>
      </Stack>

      {relations.length === 0 ? (
        <Text size="sm" tone="secondary" data-empty="">
          {t('studio.catalog.product.related.empty')}
        </Text>
      ) : (
        <ul role="list">
          {relations.map((relation) => (
            <RelationRowForm
              key={relation.id}
              productId={productId}
              relation={relation}
              canWrite={canWrite}
              deleteAction={deleteAction}
            />
          ))}
        </ul>
      )}

      <form action={create} data-add-relation="">
        <Stack gap={3}>
          <input type="hidden" name="product_id" value={productId} />
          <div className="flex flex-wrap items-end gap-3">
            <SelectField
              name="target_type"
              label={t('studio.catalog.product.related.targetTypeLabel')}
              issues={issues}
              options={targetTypes.map((type) => ({ value: type, label: type }))}
            />
            <TextField
              name="target_id"
              label={t('studio.catalog.product.related.targetLabel')}
              issues={issues}
            />
            <SelectField
              name="relation_type"
              label={t('studio.catalog.product.related.relationTypeLabel')}
              issues={issues}
              options={relationTypes.map((type) => ({ value: type, label: type }))}
            />
            <TextField
              name="sort_order"
              label={t('studio.catalog.product.related.orderLabel')}
              defaultValue="0"
              issues={issues}
            />
          </div>
          <div>
            <Button type="submit" disabled={!canWrite || creating}>
              {t('studio.catalog.product.related.addLabel')}
            </Button>
          </div>
        </Stack>
      </form>

      {formError === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {formError}
        </Text>
      )}
      {state.status === 'saved' ? (
        <Text size="sm" data-form-saved="">
          {t('studio.catalog.product.saved')}
        </Text>
      ) : null}
    </Stack>
  )
}
