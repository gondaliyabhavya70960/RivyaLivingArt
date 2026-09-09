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
 * The Media tab: which assets illustrate this product, in which role, in which order.
 *
 * ONE FORM PER ROW, NOT ONE FORM FOR THE TAB. The Phase 14 trigger refuses a concept render on
 * `product_media`, and a single whole-tab form would lose every other edit on the screen to one
 * refused attachment. Per-row forms cost the editor exactly the row that was refused, which is the
 * difference between a correction and a re-entry.
 *
 * THE PICKER LISTS NO CONCEPT ASSETS — the server filters them out before this renders, and the
 * helper string says so rather than leaving an editor to wonder why an asset they can see in the
 * Media library is missing here. That is the Studio's copy of a rule the database also enforces;
 * neither is sufficient alone, because the picker cannot stop a `curl` and the trigger cannot
 * explain itself.
 *
 * `disabled` LIVES ON THE BUTTON, NOT ON THE FIELDS. `TextField` and `SelectField` take no
 * `disabled` prop, and adding one would be the wrong fix: a read-only editor is better served by
 * controls they can read and a submit they cannot press than by a row of greyed boxes. Every action
 * re-checks `catalog.write` server-side regardless, so this is presentation, never a boundary.
 */

export interface MediaEdgeRow {
  readonly mediaAssetId: string
  readonly label: string
  readonly role: string | null
  readonly sortOrder: number | null
}

export interface ProductMediaTabProps {
  readonly productId: string
  readonly edges: readonly MediaEdgeRow[]
  /** Assets that may be attached — already filtered of concept renders by the server. */
  readonly attachable: readonly { readonly id: string; readonly label: string }[]
  readonly roles: readonly string[]
  readonly canWrite: boolean
  readonly saveAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
  readonly detachAction: (state: TabActionState, form: FormData) => Promise<TabActionState>
}

const IDLE: TabActionState = { status: 'idle' }

/** `''` is the option for "no role recorded" — distinct from a role named "none", which is not one. */
function roleOptions(roles: readonly string[]): { value: string; label: string }[] {
  return [{ value: '', label: '—' }, ...roles.map((role) => ({ value: role, label: role }))]
}

function EdgeRow({
  productId,
  edge,
  roles,
  canWrite,
  saveAction,
  detachAction,
}: {
  productId: string
  edge: MediaEdgeRow
  roles: readonly string[]
  canWrite: boolean
  saveAction: ProductMediaTabProps['saveAction']
  detachAction: ProductMediaTabProps['detachAction']
}): React.ReactElement {
  const [saveState, save, saving] = useActionState(saveAction, IDLE)
  const [detachState, detach, detaching] = useActionState(detachAction, IDLE)
  const saveIssues = fieldIssues(saveState)
  const rowError = errorFor(saveIssues, '_form') ?? errorFor(fieldIssues(detachState), '_form')

  return (
    <li className="border-b border-line py-4" data-media-edge={edge.mediaAssetId}>
      <Stack gap={3}>
        <Text size="sm">{edge.label}</Text>

        <div className="flex flex-wrap items-end gap-3">
          <form action={save} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="product_id" value={productId} />
            <input type="hidden" name="media_asset_id" value={edge.mediaAssetId} />

            <SelectField
              name="role"
              label={t('studio.catalog.product.media.roleLabel')}
              defaultValue={edge.role ?? ''}
              issues={saveIssues}
              options={roleOptions(roles)}
            />
            <TextField
              name="sort_order"
              label={t('studio.catalog.product.media.orderLabel')}
              defaultValue={edge.sortOrder === null ? '' : String(edge.sortOrder)}
              issues={saveIssues}
            />
            <Button type="submit" disabled={!canWrite || saving}>
              {t('studio.catalog.product.save')}
            </Button>
          </form>

          <form action={detach}>
            <input type="hidden" name="product_id" value={productId} />
            <input type="hidden" name="media_asset_id" value={edge.mediaAssetId} />
            <Button type="submit" variant="ghost" disabled={!canWrite || detaching}>
              {t('studio.catalog.product.media.detachLabel')}
            </Button>
          </form>
        </div>

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

export function ProductMediaTab({
  productId,
  edges,
  attachable,
  roles,
  canWrite,
  saveAction,
  detachAction,
}: ProductMediaTabProps): React.ReactElement {
  const [attachState, attach, attaching] = useActionState(saveAction, IDLE)
  const attachIssues = fieldIssues(attachState)
  const attachError = errorFor(attachIssues, '_form')

  return (
    <Stack gap={6} data-product-media-tab="">
      <Stack gap={2}>
        <Heading level={2} size="display-xs">
          {t('studio.catalog.product.media.heading')}
        </Heading>
        <Text size="sm" tone="secondary">
          {t('studio.catalog.product.media.help')}
        </Text>
        <Text size="sm" tone="tertiary">
          {t('studio.catalog.product.media.conceptExcluded')}
        </Text>
      </Stack>

      {edges.length === 0 ? (
        <Text size="sm" tone="secondary" data-empty="">
          {t('studio.catalog.product.media.empty')}
        </Text>
      ) : (
        <ul role="list">
          {edges.map((edge) => (
            <EdgeRow
              key={edge.mediaAssetId}
              productId={productId}
              edge={edge}
              roles={roles}
              canWrite={canWrite}
              saveAction={saveAction}
              detachAction={detachAction}
            />
          ))}
        </ul>
      )}

      {attachable.length === 0 ? null : (
        <form action={attach} className="flex flex-wrap items-end gap-3" data-attach-media="">
          <input type="hidden" name="product_id" value={productId} />
          <SelectField
            name="media_asset_id"
            label={t('studio.catalog.product.media.attachLabel')}
            issues={attachIssues}
            options={attachable.map((asset) => ({ value: asset.id, label: asset.label }))}
          />
          <SelectField
            name="role"
            label={t('studio.catalog.product.media.roleLabel')}
            issues={attachIssues}
            options={roleOptions(roles)}
          />
          <Button type="submit" disabled={!canWrite || attaching}>
            {t('studio.catalog.product.media.attachLabel')}
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
