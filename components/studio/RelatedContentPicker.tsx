'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { SelectField, TextField, errorFor } from '@/components/studio/FormField'
import { t } from '@/components/studio/strings'

import type { CollectionActionState } from '@/app/(studio)/studio/(shell)/catalog/collections/[collectionId]/actions'

import { fieldIssues } from './catalog/tab-issues'

/**
 * Hand-made links out of one entity, over `entity_relations`.
 *
 * BUILT TO BE REUSED BY PHASES 17 AND 18, which is why nothing in it names a collection. It takes
 * the source id, the two vocabularies and one action; a portfolio project or a journal article
 * points it at itself and gets the same surface. The phase document asks for exactly that.
 *
 * NO SUGGESTIONS AND NO SCORING, EVER, ON THIS SURFACE. Phase 23 owns the relationship engine.
 * Every row here is an edge a person made on purpose, which is why the repository behind it
 * requires an actor as a positional argument rather than an option — there is no way to write one
 * with nobody's name on it. The helper text says so, so an empty list reads as "nobody has linked
 * anything" rather than as a feature that has not loaded.
 *
 * THE TARGET IS AN ID, AND IT IS NOT VALIDATED AGAINST ANYTHING. The ids in `entity_relations` are
 * polymorphic and deliberately un-FK'd: three of the six target families have no table until
 * Phases 17 and 18, so an edge pointing at a journal article that does not exist yet is legitimate
 * and simply renders nothing until it does. A picker that refused unknown ids would make the table
 * unusable for the phases it was built for.
 *
 * ONE ACTION FOR ADD AND REMOVE, distinguished by `intent`. Two actions would be two permission
 * checks, two audit shapes and two places for the source id to be wrong.
 */

export interface RelatedRow {
  readonly id: string
  readonly targetType: string
  readonly targetId: string
  readonly relationType: string
  readonly note: string | null
}

export interface RelatedContentPickerProps {
  readonly sourceId: string
  readonly rows: readonly RelatedRow[]
  readonly targetTypes: readonly string[]
  readonly relationTypes: readonly string[]
  readonly canWrite: boolean
  readonly action: (state: CollectionActionState, form: FormData) => Promise<CollectionActionState>
}

const IDLE: CollectionActionState = { status: 'idle' }

function Row({
  sourceId,
  row,
  canWrite,
  action,
}: {
  sourceId: string
  row: RelatedRow
  canWrite: boolean
  action: RelatedContentPickerProps['action']
}): React.ReactElement {
  const [state, submit, pending] = useActionState(action, IDLE)
  const error = errorFor(fieldIssues(state), '_form')

  return (
    <li className="border-b border-line py-3" data-relation-row={row.id}>
      <Stack gap={2}>
        <Text size="sm">
          {row.relationType} → {row.targetType} {row.targetId}
        </Text>
        {row.note === null ? null : (
          <Text size="sm" tone="secondary">
            {row.note}
          </Text>
        )}
        <form action={submit}>
          <input type="hidden" name="id" value={sourceId} />
          <input type="hidden" name="target_type" value={row.targetType} />
          <input type="hidden" name="target_id" value={row.targetId} />
          <input type="hidden" name="relation_type" value={row.relationType} />
          <input type="hidden" name="intent" value="remove" />
          <Button type="submit" variant="secondary" disabled={!canWrite || pending}>
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

export function RelatedContentPicker({
  sourceId,
  rows,
  targetTypes,
  relationTypes,
  canWrite,
  action,
}: RelatedContentPickerProps): React.ReactElement {
  const [state, submit, pending] = useActionState(action, IDLE)
  const issues = fieldIssues(state)

  return (
    <Stack gap={4}>
      <Text size="sm" tone="secondary">
        {t('studio.catalog.collection.relationsHelp')}
      </Text>

      {rows.length === 0 ? (
        <Text size="sm" tone="secondary" data-empty="">
          {t('studio.catalog.collection.relationsEmpty')}
        </Text>
      ) : (
        <ul role="list" className="list-none p-0">
          {rows.map((row) => (
            <Row key={row.id} sourceId={sourceId} row={row} canWrite={canWrite} action={action} />
          ))}
        </ul>
      )}

      <form action={submit} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={sourceId} />
        <SelectField
          name="target_type"
          label={t('studio.catalog.collection.targetType')}
          options={targetTypes.map((value) => ({ value, label: value }))}
          issues={issues}
        />
        <TextField
          name="target_id"
          label={t('studio.catalog.collection.targetId')}
          issues={issues}
        />
        <SelectField
          name="relation_type"
          label={t('studio.catalog.collection.relationType')}
          options={relationTypes.map((value) => ({ value, label: value }))}
          issues={issues}
        />
        <TextField
          name="note"
          label={t('studio.catalog.collection.relationNote')}
          issues={issues}
        />
        <Button type="submit" disabled={!canWrite || pending}>
          {t('studio.catalog.collection.relationAdd')}
        </Button>
      </form>

      {errorFor(issues, '_form') === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {errorFor(issues, '_form')}
        </Text>
      )}
    </Stack>
  )
}
