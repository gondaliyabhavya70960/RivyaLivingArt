'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/studio/ConfirmDialog'

/**
 * Activate a draft model, behind the confirm dialog. Dialog state is the only reason this is a
 * client island; the activation is a plain server-action form it submits on confirm.
 */
export function ActivateModelButton({
  modelId,
  action,
  labels,
}: {
  readonly modelId: string
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
        <input type="hidden" name="model_id" value={modelId} />
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setOpen(true)}
          data-activate-model={modelId}
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
