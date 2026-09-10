'use client'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { ActionForm } from '@/components/studio/ActionForm'
import { ConfirmDestructive, PreviewTable, type PreviewRow } from '@/components/studio/bulk'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'

import { applyBulkAction } from './actions'

/**
 * Step three and four: read the preview, then confirm and apply.
 *
 * A SEPARATE SURFACE FROM THE SELECTION, reached by a redirect. The operator arrives here having
 * already decided what to select, and reads a table that says what would happen — including the
 * rows that are excluded and why. Collapsing this into the selection page is how the reading step
 * stops happening.
 *
 * THE TOKEN IS A HIDDEN FIELD THE SERVER PUT THERE. It never reaches the URL, so a preview link an
 * operator pastes to a colleague opens the preview and cannot apply it — the colleague's own page
 * render fetches the token, which is right, because they hold `bulk.execute` or they see nothing.
 */

export function BulkPreviewPanel({
  kind,
  operationId,
  confirmationToken,
  isDestructive,
  rows,
  willApply,
}: {
  readonly kind: string
  readonly operationId: string
  readonly confirmationToken: string
  readonly isDestructive: boolean
  readonly rows: readonly PreviewRow[]
  readonly willApply: number
}): React.ReactElement {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={6}>
        <PageHeader level={2} title={kind} />

        <PreviewTable rows={rows} />

        <ActionForm action={applyBulkAction}>
          <input type="hidden" name="operation_id" value={operationId} />
          <input type="hidden" name="confirmation_token" value={confirmationToken} />
          {/* The typed count is an ordinary field of this form, so the number the server re-checks
              is the number the operator typed — see ConfirmDestructive's own note. */}
          {isDestructive ? (
            <ConfirmDestructive expectedCount={willApply} actionLabel={t('studio.bulk.apply')} />
          ) : (
            <button
              type="submit"
              className="border border-ink px-4 py-2 text-sm uppercase tracking-technical"
              data-bulk-apply
            >
              {t('studio.bulk.apply')}
            </button>
          )}
        </ActionForm>
      </Stack>
    </Surface>
  )
}
