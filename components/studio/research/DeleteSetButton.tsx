'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/studio/ConfirmDialog'

/**
 * Delete a comparison set, behind the confirm dialog.
 *
 * A CLIENT ISLAND FOR ONE REASON: the dialog needs open/closed state. The deletion itself is a
 * plain server-action form the island submits on confirm, so there is no second delete path and
 * no JavaScript-only route to it — the hidden form is the whole mechanism.
 */
export function DeleteSetButton({
  setId,
  action,
  labels,
}: {
  readonly setId: string
  readonly action: (form: FormData) => Promise<void>
  readonly labels: {
    readonly button: string
    readonly title: string
    readonly body: string
    readonly confirm: string
    readonly cancel: string
    readonly close: string
  }
}) {
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <>
      <form ref={formRef} action={action} className="contents">
        <input type="hidden" name="set_id" value={setId} />
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => setOpen(true)}
          data-delete-set=""
        >
          {labels.button}
        </Button>
      </form>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={labels.title}
        body={labels.body}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        onConfirm={() => {
          setOpen(false)
          formRef.current?.requestSubmit()
        }}
      />
    </>
  )
}
