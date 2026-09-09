'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { TextField } from '@/components/studio/FormField'
import { t } from '@/components/studio/strings'

import { IDLE_FORM_STATE, type StudioFormAction, type StudioFormState } from '../form-state'

/**
 * Publish or unpublish an article, with a date and the refusals shown where the button is.
 *
 * THE DATE FIELD IS THE SCHEDULING MECHANISM, and it is the same field either way. The public read
 * is gated on `published_at <= now()`, so publishing with tomorrow's date puts the article live
 * tomorrow and publishing with an empty field puts it live now. There is no separate "schedule"
 * button, because there is no separate act: a piece set to appear on Thursday IS published, and
 * saying otherwise would need a second state the database does not have.
 *
 * THE BUTTON IS NEVER HIDDEN WHEN A GATE IS UNMET. The action recomputes them from the saved row,
 * refuses there, and writes a DENIED audit row as it does. A hidden button produces no record and
 * no explanation — only a control that is mysteriously absent.
 *
 * THE DATE DISAPPEARS ON A PUBLISHED ARTICLE. Changing when something that is already live
 * "appeared" is rewriting history, and the way to move it is to take it down and put it back up —
 * which is two deliberate acts rather than one field nobody notices.
 */
export function ArticlePublishControls({
  articleId,
  isPublished,
  publishedAt,
  publishAction,
  unpublishAction,
}: {
  readonly articleId: string
  readonly isPublished: boolean
  readonly publishedAt: string | null
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
    <Stack gap={2} data-article-publish="">
      <form action={submit} className="grid max-w-md gap-4">
        <input type="hidden" name="id" value={articleId} />
        {isPublished ? null : (
          <TextField
            name="published_at"
            type="date"
            label={t('studio.journal.fieldPublishedAt')}
            defaultValue={publishedAt === null ? '' : publishedAt.slice(0, 10)}
          />
        )}
        <div>
          <Button type="submit" variant={isPublished ? 'secondary' : 'primary'} disabled={pending}>
            {isPublished ? t('studio.journal.unpublish') : t('studio.journal.publish')}
          </Button>
        </div>
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
