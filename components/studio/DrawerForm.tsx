'use client'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Drawer } from '@/components/patterns/Drawer'

/**
 * A form in a side panel: create and edit, without leaving the list.
 *
 * IT COMPOSES `patterns/Drawer`, which already owns the focus trap, Escape, focus restoration and
 * the labelling contract. Nothing about those is re-implemented here.
 *
 * IT IS A REAL `<form>` WITH AN `action`, not an onSubmit handler. A Server Action passed as
 * `action` means the browser submits it — so the drawer works before hydration, the fields are
 * uncontrolled and survive a re-render, and errors come back from the server rather than being
 * duplicated in client validation that can disagree with the schema. Zod on the server is the
 * single source of what is valid (house rule: Zod at every trust boundary).
 *
 * The drawer is a Client Component only because `open`/`onClose` are callbacks; the form inside it
 * is ordinary markup, and `children` are Server Components rendered by the page.
 */
export function DrawerForm({
  open,
  onClose,
  title,
  closeLabel,
  action,
  submitLabel,
  cancelLabel,
  pending = false,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Resolved copy. Never a literal at the call site. */
  title: string
  closeLabel: string
  /** The Server Action this form posts to. */
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  cancelLabel: string
  pending?: boolean
  children: React.ReactNode
}) {
  return (
    <Drawer open={open} onClose={onClose} title={title} closeLabel={closeLabel} side="right">
      <form action={action}>
        <Stack gap={5}>
          {children}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {cancelLabel}
            </Button>
            {/* `loading` rather than a disabled button with swapped text: the primitive keeps the
                accessible name stable while it is busy, so a screen-reader user is not told the
                button became a different button. */}
            <Button type="submit" variant="primary" loading={pending}>
              {submitLabel}
            </Button>
          </div>
        </Stack>
      </form>
    </Drawer>
  )
}
