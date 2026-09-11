'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { Dialog } from '@/components/patterns/Dialog'

/**
 * RC-335 `StartProductDialog` — the bridge's dialog: a slug, a category, the seeded
 * acknowledgement, and no other field.
 *
 * THE SUBMIT DEPENDS ON THE CHECKBOX, WHICH STARTS UNTICKED. The acknowledgement's sentence is
 * `labels.acknowledge`, resolved from seeded copy by the page — never a literal here — and states
 * that no competitor data is being imported. The Server Action refuses a POST without it, so the
 * disabled button is the courtesy and the action is the gate.
 *
 * WHEN THE BRIDGE CANNOT RUN — flag off, no `catalog.write`, or the decision is archived — the
 * button renders DISABLED with the reason beside it rather than absent: an absent control teaches
 * a person the feature does not exist; a disabled one with a sentence teaches them why.
 */

export type BridgeDialogState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly code: string; readonly message: string }
  | { readonly status: 'started'; readonly productId: string; readonly slug: string }

export function StartProductDialog({
  confirmationId,
  categories,
  disabledReason,
  action,
  productHref,
  labels,
}: {
  readonly confirmationId: string
  readonly categories: readonly { readonly id: string; readonly name: string }[]
  /** Null when the bridge may run; otherwise the sentence shown beside the disabled button. */
  readonly disabledReason: string | null
  readonly action: (state: BridgeDialogState, form: FormData) => Promise<BridgeDialogState>
  readonly productHref: (productId: string) => string
  readonly labels: {
    readonly button: string
    readonly title: string
    readonly intro: string
    readonly slug: string
    readonly slugHelp: string
    readonly category: string
    readonly acknowledge: string
    readonly submit: string
    readonly cancel: string
    readonly close: string
    readonly started: string
    readonly openProduct: string
  }
}) {
  const [open, setOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [slug, setSlug] = useState('')
  const [state, submit, pending] = useActionState(action, { status: 'idle' } as BridgeDialogState)

  const canSubmit = acknowledged && slug.trim() !== '' && categories.length > 0 && !pending

  return (
    <div data-start-product={confirmationId}>
      <Stack gap={1}>
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabledReason !== null}
            onClick={() => setOpen(true)}
            data-start-product-button=""
          >
            {labels.button}
          </Button>
        </div>
        {disabledReason === null ? null : (
          <Text size="xs" tone="secondary" data-start-product-disabled="">
            {disabledReason}
          </Text>
        )}
        {state.status === 'started' ? (
          <Text size="xs" data-start-product-started={state.productId}>
            {labels.started}{' '}
            <a href={productHref(state.productId)} className="underline underline-offset-4">
              {labels.openProduct}
            </a>
          </Text>
        ) : null}
      </Stack>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={labels.title}
        description={labels.intro}
        closeLabel={labels.close}
      >
        <form action={submit} data-start-product-form="">
          <input type="hidden" name="confirmation_id" value={confirmationId} />
          <Stack gap={4}>
            <label className="flex flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {labels.slug}
              </Text>
              <Input
                name="slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                autoComplete="off"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                data-bridge-slug=""
              />
              <Text size="xs" tone="secondary" as="span">
                {labels.slugHelp}
              </Text>
            </label>

            <label className="flex flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {labels.category}
              </Text>
              <Select
                name="category_id"
                defaultValue={categories[0]?.id ?? ''}
                data-bridge-category=""
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </label>

            {/* UNTICKED ON OPEN, EVERY TIME. The value the action requires is the literal `yes`;
                an unticked box posts nothing, and the action refuses nothing. */}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="acknowledged"
                value="yes"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                data-bridge-acknowledge=""
              />
              <Text size="xs" as="span">
                {labels.acknowledge}
              </Text>
            </label>

            {state.status === 'error' ? (
              <Text size="xs" tone="secondary" data-bridge-error={state.code}>
                {state.message}
              </Text>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!canSubmit}
                data-bridge-submit=""
              >
                {labels.submit}
              </Button>
              <Button type="button" variant="quiet" size="sm" onClick={() => setOpen(false)}>
                {labels.cancel}
              </Button>
            </div>
          </Stack>
        </form>
      </Dialog>
    </div>
  )
}
