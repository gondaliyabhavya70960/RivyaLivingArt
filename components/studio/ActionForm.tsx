'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { errorFor } from '@/components/studio/FormField'

import type { CollectionActionState } from '@/app/(studio)/studio/(shell)/catalog/collections/[collectionId]/actions'

import { fieldIssues } from './catalog/tab-issues'

/**
 * A form around a `useActionState` action, for the buttons that are not their own component.
 *
 * IT EXISTS BECAUSE THE TWO SHAPES DO NOT MATCH. A Server Action bound straight to `<form action>`
 * receives one argument, `FormData`; an action written for `useActionState` receives the previous
 * state first. Passing a two-argument action to a plain form type-errors — and if it did not, it
 * would be CALLED with the FormData as the previous state and no form data at all, which fails at
 * runtime in a way that looks like the form did nothing.
 *
 * SO THE WRAPPER IS THE HONEST FIX rather than writing a second one-argument copy of each action.
 * A duplicate would be a second permission check and a second audit shape to keep in step, and the
 * refusal message an editor sees would come from whichever copy the page happened to call.
 *
 * IT RENDERS THE REFUSAL, which is the other half of its reason. A confirm button that submits and
 * silently does nothing — because a trigger refused it — is the worst outcome available on this
 * screen; the message goes directly under the control that caused it.
 *
 * THE CHILDREN ARE SERVER-RENDERED. They are passed through the boundary as an already-rendered
 * tree, so the buttons and their copy stay on the server and this component adds only the state.
 */

const IDLE: CollectionActionState = { status: 'idle' }

export function ActionForm({
  action,
  children,
  className,
}: {
  readonly action: (state: CollectionActionState, form: FormData) => Promise<CollectionActionState>
  readonly children: React.ReactNode
  readonly className?: string
}): React.ReactElement {
  const [state, submit] = useActionState(action, IDLE)
  const error = errorFor(fieldIssues(state), '_form')

  return (
    <Stack gap={2}>
      <form action={submit} className={className}>
        {children}
      </form>
      {error === undefined ? null : (
        <Text size="sm" tone="secondary" data-form-error="">
          {error}
        </Text>
      )}
    </Stack>
  )
}
