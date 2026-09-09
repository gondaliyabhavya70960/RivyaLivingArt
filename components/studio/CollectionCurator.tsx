'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { TextField, errorFor } from '@/components/studio/FormField'
import { t } from '@/components/studio/strings'

import type { CollectionActionState } from '@/app/(studio)/studio/(shell)/catalog/collections/[collectionId]/actions'

import { fieldIssues } from './catalog/tab-issues'

/**
 * The curation: which pieces are in a collection, and in what order.
 *
 * REORDERING IS TWO BUTTONS, NOT A DRAG HANDLE, and that is a deliberate departure from the phase
 * document's "drag ordering". A drag affordance needs a keyboard equivalent to be operable at all
 * (WCAG 2.1.1), so the button pair has to exist whatever else is built — and it is the half that
 * works with no JavaScript, announces itself correctly, and cannot lose an arrangement to a dropped
 * pointer event. A pointer affordance can be layered over this later without touching the write
 * path, because the server action takes "move this piece one place", not a new array.
 *
 * THE ENDS ARE DISABLED RATHER THAN HIDDEN, for the reason `Pagination` gives about its own
 * controls: a control set that keeps its shape does not shift sideways under the pointer at the
 * boundaries. The action also treats an out-of-range move as a no-op, so a submitted form that
 * arrives anyway asks for the arrangement it already has.
 *
 * A PIECE IS ADDED BY ID, NOT BY SEARCH. Phase 23 builds the picker; a half-built search here would
 * be the surface where an automatic suggestion first appears, which FEAT §11 reserves for a person.
 * The id is what the products list already shows, and pasting one is a deliberate act.
 */

export interface CuratedRow {
  readonly productId: string
  readonly title: string | null
  readonly slug: string
  readonly status: string
}

export interface CollectionCuratorProps {
  readonly collectionId: string
  readonly rows: readonly CuratedRow[]
  readonly canWrite: boolean
  readonly addAction: (
    state: CollectionActionState,
    form: FormData,
  ) => Promise<CollectionActionState>
  readonly reorderAction: (
    state: CollectionActionState,
    form: FormData,
  ) => Promise<CollectionActionState>
}

const IDLE: CollectionActionState = { status: 'idle' }

function RowControls({
  collectionId,
  row,
  index,
  total,
  canWrite,
  reorderAction,
}: {
  collectionId: string
  row: CuratedRow
  index: number
  total: number
  canWrite: boolean
  reorderAction: CollectionCuratorProps['reorderAction']
}): React.ReactElement {
  const [state, submit, pending] = useActionState(reorderAction, IDLE)
  const error = errorFor(fieldIssues(state), '_form')

  return (
    <li className="border-b border-line py-3" data-curated-row={row.productId}>
      <Stack gap={2}>
        <Text size="sm">
          {row.title ?? row.slug} — {row.status}
        </Text>
        <form action={submit} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={collectionId} />
          <input type="hidden" name="product_id" value={row.productId} />
          <Button
            type="submit"
            name="direction"
            value="up"
            variant="secondary"
            disabled={!canWrite || pending || index === 0}
          >
            {t('studio.catalog.collection.moveUp')}
          </Button>
          <Button
            type="submit"
            name="direction"
            value="down"
            variant="secondary"
            disabled={!canWrite || pending || index === total - 1}
          >
            {t('studio.catalog.collection.moveDown')}
          </Button>
          <Button
            type="submit"
            name="direction"
            value="remove"
            variant="secondary"
            disabled={!canWrite || pending}
          >
            {t('studio.catalog.collection.remove')}
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

export function CollectionCurator({
  collectionId,
  rows,
  canWrite,
  addAction,
  reorderAction,
}: CollectionCuratorProps): React.ReactElement {
  const [state, add, adding] = useActionState(addAction, IDLE)
  const issues = fieldIssues(state)

  return (
    <Stack gap={4}>
      {rows.length === 0 ? (
        <Text size="sm">{t('studio.catalog.collection.curationEmpty')}</Text>
      ) : (
        <ul className="list-none p-0" data-curated-list="">
          {rows.map((row, index) => (
            <RowControls
              key={row.productId}
              collectionId={collectionId}
              row={row}
              index={index}
              total={rows.length}
              canWrite={canWrite}
              reorderAction={reorderAction}
            />
          ))}
        </ul>
      )}

      <form action={add} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={collectionId} />
        <TextField
          name="product_id"
          label={t('studio.catalog.collection.productId')}
          issues={issues}
        />
        <Button type="submit" disabled={!canWrite || adding}>
          {t('studio.catalog.collection.add')}
        </Button>
      </form>

      {/*
        `_form` errors are rendered here rather than under the field, because they are refusals
        about the ACTION — "that piece is already in this collection", "no product with that id" —
        rather than about the shape of what was typed. `TextField` shows the field-level ones.
      */}
      {errorFor(issues, '_form') === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {errorFor(issues, '_form')}
        </Text>
      )}
    </Stack>
  )
}
