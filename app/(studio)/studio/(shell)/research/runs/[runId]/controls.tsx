'use client'

import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'

import { cancelRunAction, retryFailedAction } from '../../scrape/actions'

/**
 * Cancel, and retry the failures. The one client island on this page.
 *
 * IT IS A CLIENT COMPONENT ONLY BECAUSE `ActionForm` IS — the two buttons are plain submits with a
 * hidden field and would work with no JavaScript at all. What the island buys is the pending state
 * and the error rendering, not the feature.
 *
 * THE CANCELLATION CAVEAT IS RENDERED BESIDE THE BUTTON, NOT AFTER IT. "Cancelling stops the next
 * page, not the one in flight" is something an operator needs to read BEFORE they press — a
 * message in the response arrives after the decision it was supposed to inform.
 */
export function RunControls({
  runId,
  isActive,
  hasFailures,
}: {
  readonly runId: string
  readonly isActive: boolean
  readonly hasFailures: boolean
}): React.ReactElement | null {
  if (!isActive && !hasFailures) return null

  return (
    <Surface level={1} className="p-6">
      <PageHeader level={2} title={t('studio.research.runsHeading')} />
      <Stack gap={4} className="mt-4">
        {isActive ? (
          <ActionForm action={cancelRunAction}>
            <input type="hidden" name="run_id" value={runId} />
            <Stack gap={2}>
              <Text tone="secondary">{t('studio.research.cancelNote')}</Text>
              <button
                type="submit"
                className="self-start border border-ink px-4 py-2 text-sm uppercase tracking-technical"
                data-cancel-run
              >
                {t('studio.research.cancelRun')}
              </button>
            </Stack>
          </ActionForm>
        ) : null}

        {hasFailures ? (
          <ActionForm action={retryFailedAction}>
            <input type="hidden" name="run_id" value={runId} />
            <button
              type="submit"
              className="self-start border border-ink px-4 py-2 text-sm uppercase tracking-technical"
              data-retry-failed
            >
              {t('studio.research.retryFailed')}
            </button>
          </ActionForm>
        ) : null}
      </Stack>
    </Surface>
  )
}
