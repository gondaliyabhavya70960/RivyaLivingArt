'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

import type { CatalogActionState } from '@/app/(studio)/studio/(shell)/catalog/actions'

/**
 * Publish and unpublish, with the refusal shown where the button is.
 *
 * THE REFUSAL NAMES THE UNMET ITEMS. `publishProductAction` returns one issue per unmet required
 * item, carrying the item's own name, and they are listed here verbatim — so "Hero image" appears
 * next to the button that just refused rather than only in the checklist further up the page.
 *
 * THE GATE IS THE SERVER'S. This component does not decide whether publishing is allowed and does
 * not hide the button when the checklist is incomplete: the action recomputes the checklist from
 * the SAVED row and refuses there, writing a DENIED audit row as it does. A client-side gate would
 * be a second opinion that can disagree with the one that counts.
 */
export function PublishControls({
  productId,
  isPublished,
  publishAction,
  unpublishAction,
  canPublish,
}: {
  readonly productId: string
  readonly isPublished: boolean
  readonly publishAction: (state: CatalogActionState, form: FormData) => Promise<CatalogActionState>
  readonly unpublishAction: (
    state: CatalogActionState,
    form: FormData,
  ) => Promise<CatalogActionState>
  readonly canPublish: boolean
}): React.ReactElement | null {
  const action = isPublished ? unpublishAction : publishAction
  const [state, submit, pending] = useActionState(action, { status: 'idle' } as CatalogActionState)

  if (!canPublish) return null

  const issues = state.status === 'error' ? state.issues : []
  const unmet = issues.filter((issue) => issue.code === 'readiness_unmet')
  const other = issues.filter((issue) => issue.code !== 'readiness_unmet')

  return (
    <form action={submit} data-publish-form="">
      <Stack gap={3}>
        <input type="hidden" name="id" value={productId} />
        <Button type="submit" variant={isPublished ? 'secondary' : 'primary'} loading={pending}>
          {isPublished
            ? t('studio.catalog.product.unpublish')
            : t('studio.catalog.product.publish')}
        </Button>

        {unmet.length === 0 ? null : (
          <div data-publish-refused="">
            <Text size="sm">{t('studio.catalog.readiness.refused')}</Text>
            <ul className="mt-1 list-disc pl-5">
              {unmet.map((issue) => (
                <li key={issue.message} data-unmet-item={issue.message}>
                  <Text as="span" size="sm">
                    {issue.message}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        )}

        {other.map((issue) => (
          <Text key={issue.code} size="sm" tone="secondary" data-publish-error="">
            {issue.message}
          </Text>
        ))}
      </Stack>
    </form>
  )
}
