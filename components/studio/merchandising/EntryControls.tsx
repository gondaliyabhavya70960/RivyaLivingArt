'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { TextAreaField, TextField, errorFor } from '@/components/studio/FormField'
import { IDLE_FORM_STATE, formIssues, type StudioFormAction } from '@/components/studio/form-state'

/**
 * The controls on one merchandising entry: order, pin, release, remove, and the window.
 *
 * ONE ACTION, ONE STATE, EIGHT BUTTONS. Every control posts the same Server Action with a different
 * `op`, so a row holds one `useActionState` rather than eight and a refusal lands under the row
 * that caused it. The buttons are real submit buttons in real forms — they work without
 * JavaScript, announce themselves, and cannot lose an arrangement to a dropped pointer event —
 * which is the reason the phase document's "drag ordering" is a button pair here, as it is in
 * `CollectionCurator`.
 *
 * THE ENDS ARE DISABLED RATHER THAN HIDDEN, so the control set keeps its shape at the boundaries;
 * the database treats an out-of-range move as a no-op anyway.
 *
 * EVERY LABEL IS RESOLVED BY THE SERVER and handed down: this file renders words it was given.
 */
export type EntryControlLabels = {
  readonly moveUp: string
  readonly moveDown: string
  readonly remove: string
  readonly publish: string
  readonly unpublish: string
  readonly pin: string
  readonly unpin: string
  readonly windowHeading: string
  readonly publishAt: string
  readonly unpublishAt: string
  readonly windowHelp: string
  readonly note: string
  readonly saveWindow: string
}

export type EntryControlsProps = {
  readonly entryId: string
  readonly route: string
  readonly status: string
  readonly pinned: boolean
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly publishAt: string | null
  readonly unpublishAt: string | null
  readonly note: string | null
  readonly canWrite: boolean
  readonly action: StudioFormAction
  readonly labels: EntryControlLabels
}

/** ISO → the `datetime-local` value shape (UTC, no zone), or empty. */
function localValue(iso: string | null): string {
  if (iso === null) return ''
  return iso.slice(0, 16)
}

export function EntryControls({
  entryId,
  route,
  status,
  pinned,
  isFirst,
  isLast,
  publishAt,
  unpublishAt,
  note,
  canWrite,
  action,
  labels,
}: EntryControlsProps): React.ReactElement | null {
  const [state, submit, pending] = useActionState(action, IDLE_FORM_STATE)
  const error = errorFor(formIssues(state), '_form')
  if (!canWrite) return null

  const hidden = (op: string) => (
    <>
      <input type="hidden" name="entry_id" value={entryId} />
      <input type="hidden" name="route" value={route} />
      <input type="hidden" name="op" value={op} />
    </>
  )

  return (
    <Stack gap={2} data-entry-controls={entryId}>
      <Cluster gap={2}>
        <form action={submit}>
          {hidden('move_up')}
          <Button type="submit" size="sm" disabled={isFirst || pending} aria-label={labels.moveUp}>
            ↑
          </Button>
        </form>
        <form action={submit}>
          {hidden('move_down')}
          <Button type="submit" size="sm" disabled={isLast || pending} aria-label={labels.moveDown}>
            ↓
          </Button>
        </form>
        <form action={submit}>
          {hidden(pinned ? 'unpin' : 'pin')}
          <Button type="submit" size="sm" disabled={pending}>
            {pinned ? labels.unpin : labels.pin}
          </Button>
        </form>
        <form action={submit}>
          {hidden(status === 'PUBLISHED' ? 'unpublish' : 'publish')}
          <Button
            type="submit"
            size="sm"
            variant={status === 'PUBLISHED' ? 'secondary' : 'primary'}
            disabled={pending}
          >
            {status === 'PUBLISHED' ? labels.unpublish : labels.publish}
          </Button>
        </form>
        <form action={submit}>
          {hidden('remove')}
          <Button type="submit" size="sm" variant="ghost" disabled={pending}>
            {labels.remove}
          </Button>
        </form>
      </Cluster>
      <details>
        <summary className="cursor-pointer text-sm">{labels.windowHeading}</summary>
        <form action={submit} className="pt-3">
          {hidden('window')}
          <Stack gap={3}>
            <TextField
              name="publish_at"
              label={labels.publishAt}
              defaultValue={localValue(publishAt)}
              help={labels.windowHelp}
            />
            <TextField
              name="unpublish_at"
              label={labels.unpublishAt}
              defaultValue={localValue(unpublishAt)}
            />
            <TextAreaField name="note" label={labels.note} defaultValue={note ?? ''} rows={2} />
            <div>
              <Button type="submit" size="sm" disabled={pending}>
                {labels.saveWindow}
              </Button>
            </div>
          </Stack>
        </form>
      </details>
      {error === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {error}
        </Text>
      )}
    </Stack>
  )
}
