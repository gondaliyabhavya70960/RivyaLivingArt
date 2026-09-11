'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/studio/ConfirmDialog'

/**
 * RC-333 `BriefStatusButton` — Approve or Archive a brief, behind the confirm dialog. Dialog state
 * is the only reason this is a client island; the status change is a plain server-action form it
 * submits on confirm, and the server re-checks the permission the status needs.
 */
export function BriefStatusButton({
  briefId,
  status,
  action,
  labels,
  variant = 'secondary',
}: {
  readonly briefId: string
  readonly status: 'APPROVED' | 'ARCHIVED'
  readonly action: (form: FormData) => Promise<void>
  readonly labels: {
    readonly button: string
    readonly title: string
    readonly body: string
    readonly confirm: string
    readonly cancel: string
    readonly close: string
  }
  readonly variant?: 'primary' | 'secondary'
}) {
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <>
      <form ref={formRef} action={action} className="contents">
        <input type="hidden" name="brief_id" value={briefId} />
        <input type="hidden" name="status" value={status} />
        <Button
          type="button"
          variant={variant}
          size="sm"
          onClick={() => setOpen(true)}
          data-brief-status-button={status}
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
