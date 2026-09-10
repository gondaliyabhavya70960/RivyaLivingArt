'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { errorFor } from '@/components/studio/FormField'
import { IDLE_FORM_STATE, formIssues, type StudioFormAction } from '@/components/studio/form-state'

/**
 * The two buttons on one category row, and the SEED §56 two-step.
 *
 * A MOVE THAT PUTS GIFTS OR DÉCOR ABOVE FURNITURE IS REFUSED THE FIRST TIME with the priority
 * warning as its refusal, and this control then re-renders the same move with `acknowledge` set
 * and the confirm label — "a warning appears before saving; save anyway" (verification step 7),
 * without a modal and without JavaScript being load-bearing: the second submit is an ordinary
 * form post that carries one more field.
 */
export type CategoryOrderLabels = {
  readonly moveUp: string
  readonly moveDown: string
  readonly confirm: string
}

export function CategoryOrderControls({
  categoryId,
  isFirst,
  isLast,
  action,
  labels,
}: {
  readonly categoryId: string
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly action: StudioFormAction
  readonly labels: CategoryOrderLabels
}): React.ReactElement {
  const [state, submit, pending] = useActionState(action, IDLE_FORM_STATE)
  const issues = formIssues(state)
  const error = errorFor(issues, '_form')
  const needsAcknowledge =
    state.status === 'error' && state.issues.some((issue) => issue.code === 'priority')
  const [lastDirection, setLastDirection] = React.useState<'up' | 'down'>('up')

  return (
    <Stack gap={2} data-category-order={categoryId}>
      <Cluster gap={2}>
        <form action={submit} onSubmit={() => setLastDirection('up')}>
          <input type="hidden" name="category_id" value={categoryId} />
          <input type="hidden" name="direction" value="up" />
          <Button type="submit" size="sm" disabled={isFirst || pending} aria-label={labels.moveUp}>
            ↑
          </Button>
        </form>
        <form action={submit} onSubmit={() => setLastDirection('down')}>
          <input type="hidden" name="category_id" value={categoryId} />
          <input type="hidden" name="direction" value="down" />
          <Button type="submit" size="sm" disabled={isLast || pending} aria-label={labels.moveDown}>
            ↓
          </Button>
        </form>
        {needsAcknowledge ? (
          <form action={submit}>
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="direction" value={lastDirection} />
            <input type="hidden" name="acknowledge" value="1" />
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
              {labels.confirm}
            </Button>
          </form>
        ) : null}
      </Cluster>
      {error === undefined ? null : (
        <Text
          size="sm"
          tone="secondary"
          data-form-error=""
          data-priority-warning={needsAcknowledge ? '' : undefined}
        >
          {error}
        </Text>
      )}
    </Stack>
  )
}
