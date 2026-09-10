'use client'

import { ActionForm } from '@/components/studio/ActionForm'
import { UndoBanner } from '@/components/studio/bulk'

import { undoBulkAction } from '@/app/(studio)/studio/(shell)/catalog/bulk/actions'

/**
 * The undo control, on the audit page rather than on the bulk surface.
 *
 * AN UNDO IS SOMETHING YOU DECIDE HAVING READ WHAT HAPPENED, and what happened is on this page.
 * Putting it on the bulk surface would offer it to somebody who has just finished selecting rows
 * for a different operation.
 *
 * THE BANNER SAYS WHAT UNDO WILL NOT DO. "Rows edited since will be left as they are" is the skip
 * rule stated before the click rather than discovered in the result — the operator should know
 * they are about to get a partial restore, not learn it afterwards.
 */
export function UndoPanel({
  operationId,
  deadlineAt,
}: {
  readonly operationId: string
  readonly deadlineAt: string | null
}): React.ReactElement {
  return (
    <ActionForm action={undoBulkAction}>
      <input type="hidden" name="operation_id" value={operationId} />
      {/* The banner's button is a real submit, so this works before any JavaScript arrives. */}
      <UndoBanner deadlineAt={deadlineAt} />
    </ActionForm>
  )
}
