'use client'

import { useId, useState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Label } from '@/components/primitives/Label'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { Dialog } from '@/components/patterns/Dialog'

/**
 * The confirmation every destructive action must pass through (FEAT §20).
 *
 * IT COMPOSES `patterns/Dialog` RATHER THAN REBUILDING ONE. Focus trapping, Escape, restoring focus
 * to the trigger, scroll locking and the labelling contract were all solved in Phase 02 and are
 * covered by that component's tests. A second dialog here would be a second set of those bugs.
 *
 * TWO STRENGTHS, AND THE STRONGER ONE IS NOT DECORATION. An ordinary confirm is a button; a
 * `typeToConfirm` confirm requires typing an exact phrase, usually the record's name. Reserve it
 * for actions that destroy something unrecoverable — the point is to break the muscle memory of
 * clicking through a dialog, which is the failure mode a plain "Are you sure?" has after the tenth
 * time somebody sees it.
 *
 * THE ACTION IS STILL AUTHORISED SERVER-SIDE. This is a speed bump for a person, not a permission
 * check: the Server Action it submits to has its own `withPermission(...)`, and `destructive.execute`
 * is what actually decides. A confirmation nobody can bypass in the UI is still bypassed by `curl`.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  cancelLabel,
  closeLabel,
  typeToConfirm,
  typeToConfirmLabel,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  /** Resolved copy. Never a literal at the call site. */
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  /** Accessible name for the dialog's own close control. Required by patterns/Dialog. */
  closeLabel: string
  /** When set, the confirm button stays disabled until this exact string is typed. */
  typeToConfirm?: string
  typeToConfirmLabel?: string
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  const inputId = useId()

  const gated = typeToConfirm !== undefined
  // Trimmed, because a trailing space from a paste is not a different intention. Case-sensitive,
  // because the phrase is usually a record's name and matching loosely defeats the purpose.
  const satisfied = !gated || typed.trim() === typeToConfirm

  return (
    <Dialog
      open={open}
      onClose={() => {
        setTyped('')
        onClose()
      }}
      title={title}
      closeLabel={closeLabel}
      size="sm"
    >
      <Stack gap={4}>
        <Text tone="secondary">{body}</Text>

        {gated && typeToConfirmLabel !== undefined && (
          <Stack gap={1}>
            <Label htmlFor={inputId}>{typeToConfirmLabel}</Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </Stack>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {/* Cancel is first in the DOM so Tab reaches the safe option before the destructive
              one. The confirm is `danger`, not `primary`: the design system has a variant that
              says "this destroys something", and using the ordinary primary here would make a
              deletion look like a save. */}
          <Button
            variant="secondary"
            onClick={() => {
              setTyped('')
              onClose()
            }}
          >
            {cancelLabel}
          </Button>
          <Button variant="danger" disabled={!satisfied} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Stack>
    </Dialog>
  )
}
