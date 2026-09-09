'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { SelectField, TextAreaField, errorFor } from '@/components/studio/FormField'
import { t } from '@/components/studio/strings'

import type { TabActionState } from '@/app/(studio)/studio/(shell)/catalog/products/[productId]/tab-actions'

import { fieldIssues } from './tab-issues'

/**
 * The Materials tab: what this piece is made from, and optionally how.
 *
 * THE NOTE IS OPTIONAL AND STAYS OPTIONAL. It says how THIS material is used in THIS piece — "the
 * top only", "hand-rubbed" — and a blank one is stored as null rather than as an empty string,
 * because "no note" and "an empty note" are different facts and only one of them is true. The
 * public material band falls back to the material's own description when there is none, so an
 * editor with nothing to add is never pushed into writing something.
 *
 * The material band is also the ONE place on a product page where a concept render legitimately
 * appears: it illustrates the material, is captioned as a material study, and comes from the
 * `materials` row rather than from this product. Nothing on this tab attaches imagery — that
 * belongs to the material itself, which is what keeps the caption honest.
 */

export interface MaterialLinkRow {
  readonly materialId: string
  readonly label: string
  readonly note: string | null
}

export interface ProductMaterialsTabProps {
  readonly productId: string
  readonly links: readonly MaterialLinkRow[]
  readonly attachable: readonly { readonly id: string; readonly label: string }[]
  readonly canWrite: boolean
  readonly saveAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
  readonly detachAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
}

const IDLE: TabActionState = { status: 'idle' }

function LinkRow({
  productId,
  link,
  canWrite,
  saveAction,
  detachAction,
}: {
  productId: string
  link: MaterialLinkRow
  canWrite: boolean
  saveAction: ProductMaterialsTabProps['saveAction']
  detachAction: ProductMaterialsTabProps['detachAction']
}): React.ReactElement {
  const [saveState, save, saving] = useActionState(saveAction, IDLE)
  const [detachState, detach, detaching] = useActionState(detachAction, IDLE)
  const saveIssues = fieldIssues(saveState)
  const rowError = errorFor(saveIssues, '_form') ?? errorFor(fieldIssues(detachState), '_form')

  return (
    <li className="border-b border-line py-4" data-material-link={link.materialId}>
      <Stack gap={3}>
        <Text size="sm">{link.label}</Text>

        <form action={save}>
          <Stack gap={3}>
            <input type="hidden" name="product_id" value={productId} />
            <input type="hidden" name="material_id" value={link.materialId} />
            <TextAreaField
              name="note"
              label={t('studio.catalog.product.materials.noteLabel')}
              defaultValue={link.note ?? ''}
              rows={2}
              issues={saveIssues}
            />
            <div>
              <Button type="submit" disabled={!canWrite || saving}>
                {t('studio.catalog.product.save')}
              </Button>
            </div>
          </Stack>
        </form>

        <form action={detach}>
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="material_id" value={link.materialId} />
          <Button type="submit" variant="ghost" disabled={!canWrite || detaching}>
            {t('studio.catalog.product.media.detachLabel')}
          </Button>
        </form>

        {rowError === undefined ? null : (
          <Text size="sm" tone="secondary" data-form-error="">
            {rowError}
          </Text>
        )}
        {saveState.status === 'saved' || detachState.status === 'saved' ? (
          <Text size="sm" data-form-saved="">
            {t('studio.catalog.product.saved')}
          </Text>
        ) : null}
      </Stack>
    </li>
  )
}

export function ProductMaterialsTab({
  productId,
  links,
  attachable,
  canWrite,
  saveAction,
  detachAction,
}: ProductMaterialsTabProps): React.ReactElement {
  const [attachState, attach, attaching] = useActionState(saveAction, IDLE)
  const attachIssues = fieldIssues(attachState)
  const attachError = errorFor(attachIssues, '_form')

  return (
    <Stack gap={6} data-product-materials-tab="">
      <Stack gap={2}>
        <Heading level={2} size="display-xs">
          {t('studio.catalog.product.materials.heading')}
        </Heading>
        <Text size="sm" tone="secondary">
          {t('studio.catalog.product.materials.help')}
        </Text>
      </Stack>

      {links.length === 0 ? (
        <Text size="sm" tone="secondary" data-empty="">
          {t('studio.catalog.product.materials.empty')}
        </Text>
      ) : (
        <ul role="list">
          {links.map((link) => (
            <LinkRow
              key={link.materialId}
              productId={productId}
              link={link}
              canWrite={canWrite}
              saveAction={saveAction}
              detachAction={detachAction}
            />
          ))}
        </ul>
      )}

      {attachable.length === 0 ? null : (
        <form action={attach} className="flex flex-wrap items-end gap-3" data-attach-material="">
          <input type="hidden" name="product_id" value={productId} />
          <SelectField
            name="material_id"
            label={t('studio.catalog.product.materials.heading')}
            issues={attachIssues}
            options={attachable.map((material) => ({ value: material.id, label: material.label }))}
          />
          <Button type="submit" disabled={!canWrite || attaching}>
            {t('studio.catalog.product.save')}
          </Button>
        </form>
      )}

      {attachError === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {attachError}
        </Text>
      )}
    </Stack>
  )
}
