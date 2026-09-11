'use client'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { ConfirmDestructive, PreviewTable, type PreviewRow } from '@/components/studio/bulk'
import { PageHeader } from '@/components/studio/PageHeader'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'

/**
 * Steps three and four on a research surface: read what would happen, then confirm and apply.
 *
 * IT REPLACES THE SELECTION RATHER THAN SITTING BELOW IT. The operator has finished choosing; what
 * they need now is to read — including the rows that are excluded and why, which is the half of a
 * bulk action nobody reads when it is rendered beside the checkboxes they were just clicking.
 *
 * EVERY PIECE OF MACHINERY HERE IS PHASE 24'S. `PreviewTable` counts the outcomes, and
 * `ConfirmDestructive` asks for the row count as digits — a fixed word becomes muscle memory within
 * a week, and the number is different every time and is the one fact the operator most needs to
 * have registered. The server refuses a wrong number as well; this is what makes them stop and read
 * it.
 *
 * THE TOKEN IS A HIDDEN FIELD THE SERVER PUT THERE, never a URL parameter — so a preview link
 * pasted to a colleague opens the preview and cannot apply it. Their own render fetches the token,
 * which is right, because they hold `bulk.execute` or they see nothing.
 */
export function ResearchBulkPreview({
  kind,
  operationId,
  confirmationToken,
  isDestructive,
  rows,
  willApply,
  surface,
  backHref,
  applyAction,
}: {
  readonly kind: string
  readonly operationId: string
  readonly confirmationToken: string
  readonly isDestructive: boolean
  readonly rows: readonly PreviewRow[]
  readonly willApply: number
  readonly surface: string
  readonly backHref: string
  readonly applyAction: StudioFormAction
}): React.ReactElement {
  return (
    <Surface level={1} className="p-6" data-research-bulk-preview={kind}>
      <Stack gap={6}>
        <PageHeader level={2} title={kind} />

        <Text size="sm" tone="secondary">
          {t('studio.research.confirmMeaning')}
        </Text>

        <PreviewTable rows={rows} />

        <ActionForm action={applyAction}>
          <input type="hidden" name="operation_id" value={operationId} />
          <input type="hidden" name="confirmation_token" value={confirmationToken} />
          <input type="hidden" name="surface" value={surface} />
          {isDestructive ? (
            <ConfirmDestructive expectedCount={willApply} actionLabel={t('studio.bulk.apply')} />
          ) : (
            <button
              type="submit"
              className="border-ink tracking-technical border px-4 py-2 text-sm uppercase"
              data-bulk-apply=""
            >
              {t('studio.bulk.apply')}
            </button>
          )}
        </ActionForm>

        <a href={backHref} className="text-sm underline underline-offset-4" data-bulk-back="">
          {t('studio.research.bulkBack')}
        </a>
      </Stack>
    </Surface>
  )
}
