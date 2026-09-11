import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'

/**
 * The Phase 29 action bar for ONE research row, on a surface that is not the change queue.
 *
 * IT CALLS THE SAME SERVER ACTIONS THE QUEUE CALLS. `shortlistAction`, `rejectAction` and
 * `confirmAction` all accept a bare `product_id` — Phase 29 wrote them that way deliberately, for
 * the row a person reaches without a change to hang it on — so a merchandiser who has found a piece
 * in the large-format workspace decides it here rather than searching the queue for it. Nothing is
 * reimplemented: the same append-only log, the same stage move, the same undo.
 *
 * **CONFIRM SAYS WHAT IT DOES NOT DO, IN SEEDED COPY.** That sentence is one of the four
 * never-auto-import guarantees and the only one aimed at people rather than at code: three guards
 * stop a developer adding an import, and this stops a reader concluding that a screen full of
 * confirmed competitor rows is a catalogue somebody approved.
 *
 * A SERVER COMPONENT. Each control is a form posting to a Server Action, so it works with the
 * keyboard, in a screen reader and before any JavaScript arrives.
 */
export function RowActionBar({
  productId,
  label,
  canConfirm,
  actions,
}: {
  readonly productId: string
  readonly label: string
  readonly canConfirm: boolean
  readonly actions: {
    readonly shortlist: StudioFormAction
    readonly reject: StudioFormAction
    readonly confirm: StudioFormAction
  }
}): React.ReactElement {
  return (
    <Surface level={2} className="p-6" data-row-action-bar={productId}>
      <Stack gap={4}>
        <PageHeader level={2} title={t('studio.research.rowActions')} />
        <Text size="sm" className="break-words">
          {label}
        </Text>

        {canConfirm ? (
          <Stack gap={4}>
            <Cluster gap={3} align="end">
              <ActionForm action={actions.shortlist}>
                <input type="hidden" name="product_id" value={productId} />
                <Button type="submit" variant="secondary" size="sm">
                  {t('studio.research.actionShortlist')}
                </Button>
              </ActionForm>
            </Cluster>

            {/* PHASE 35: CONFIRM CARRIES ITS DECISION NOTE IN THE SAME FORM AS THE BUTTON. The
                movement table requires one for SHORTLISTED → CONFIRMED and the row-level CHECK on
                research_confirmations refuses a blank; asking beside the control is what stops the
                person meeting either refusal. */}
            <ActionForm action={actions.confirm}>
              <input type="hidden" name="product_id" value={productId} />
              <Stack gap={2}>
                <label className="flex max-w-md flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.decisionNoteHelp')}
                  </Text>
                  <textarea
                    name="reason"
                    rows={2}
                    className="border-line bg-surface border px-3 py-2 text-sm"
                    data-decision-note=""
                  />
                </label>
                <div>
                  <Button type="submit" variant="secondary" size="sm" data-confirm-row="">
                    {t('studio.research.actionConfirm')}
                  </Button>
                </div>
              </Stack>
            </ActionForm>

            <Text size="xs" tone="secondary">
              {t('studio.research.confirmMeaning')}
            </Text>

            {/* REJECT CARRIES ITS REASON IN THE SAME FORM AS THE BUTTON. The workflow refuses a
                reasonless rejection and the row-level CHECK refuses it again; asking for it beside
                the control is what stops the person meeting either refusal. */}
            <ActionForm action={actions.reject}>
              <input type="hidden" name="product_id" value={productId} />
              <Stack gap={2}>
                <label className="flex max-w-md flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.reasonRequired')}
                  </Text>
                  <textarea
                    name="reason"
                    rows={2}
                    className="border-line bg-surface border px-3 py-2 text-sm"
                  />
                </label>
                <Button type="submit" variant="quiet" size="sm">
                  {t('studio.research.actionReject')}
                </Button>
              </Stack>
            </ActionForm>
          </Stack>
        ) : (
          <Text size="sm" tone="secondary">
            {t('studio.research.decidedElsewhere')}
          </Text>
        )}
      </Stack>
    </Surface>
  )
}
