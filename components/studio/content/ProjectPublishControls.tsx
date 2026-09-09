'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { IDLE_FORM_STATE, type StudioFormAction, type StudioFormState } from '../form-state'

/**
 * Publish and unpublish a project, with the refusal shown where the button is.
 *
 * THE BUTTON IS NEVER HIDDEN WHEN THE GATES ARE UNMET, and that is deliberate. This component has a
 * rendered copy of the row and could work out that publishing will fail — but a second opinion that
 * can disagree with the one that counts is worse than none. The action recomputes the gates from the
 * SAVED row, refuses there, and writes a DENIED audit row as it does; a hidden button would produce
 * no record and no explanation, only a control that is mysteriously absent.
 *
 * THE UNMET GATES ARE LISTED HERE VERBATIM, not summarised. The action returns one issue per gate
 * carrying its own sentence, and they appear next to the button that just refused — the panel higher
 * up the page says the same things, but an editor who pressed Publish is looking here.
 */
export function ProjectPublishControls({
  projectId,
  isPublished,
  publishAction,
  unpublishAction,
}: {
  readonly projectId: string
  readonly isPublished: boolean
  readonly publishAction: StudioFormAction
  readonly unpublishAction: StudioFormAction
}): React.ReactElement {
  const action = isPublished ? unpublishAction : publishAction
  const [state, submit, pending] = useActionState<StudioFormState, FormData>(
    action,
    IDLE_FORM_STATE,
  )
  const issues = state.status === 'error' ? state.issues : []

  return (
    <Stack gap={2} data-project-publish="">
      <form action={submit}>
        <input type="hidden" name="id" value={projectId} />
        <Button type="submit" variant={isPublished ? 'secondary' : 'primary'} disabled={pending}>
          {isPublished ? t('studio.portfolio.unpublish') : t('studio.portfolio.publish')}
        </Button>
      </form>

      {issues.length === 0 ? null : (
        <ul role="list" data-publish-refused="">
          {issues.map((issue) => (
            <li key={issue.code}>
              <Text size="sm" tone="secondary">
                {issue.message}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  )
}
