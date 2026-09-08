'use client'

import * as React from 'react'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { Drawer } from '@/components/patterns/Drawer'
import { ConfirmDialog } from '@/components/studio/ConfirmDialog'
import { EmptyState } from '@/components/studio/EmptyState'
import type { PickerAsset } from '@/components/studio/MediaPicker'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import { blockModuleFor } from '@/lib/cms/registry'
import { allowedTransitions } from '@/lib/cms/transitions'
import type { Permission } from '@/lib/auth/permissions'
import type { PageSection } from '@/lib/supabase/schemas'

import { SectionForm } from './SectionForm'
import { toFormValues, type SectionFormValues } from './section-form-values'

/**
 * The page's blocks, in order, with everything an editor does to one of them.
 *
 * ORDERING IS OPTIMISTIC AND THEN CORRECTED. Moving a block redraws the list immediately and calls
 * `cms_reorder_sections`; if that refuses, the list is put back and the reason is shown. The
 * alternative — waiting for the round trip before redrawing — makes reordering a page of ten
 * blocks feel broken even when it works.
 *
 * A BLOCK WITH NO RENDERER IS SHOWN, NOT HIDDEN. A `block_type` this build does not know, or one
 * still PLANNED, renders nothing on the public site — silently and correctly, because a
 * placeholder card would tell a visitor about our internals. Here the opposite is right: this is
 * where the person who can fix it is looking, so it says so explicitly.
 */

export type SectionBoardProps = {
  readonly pageId: string
  readonly sections: readonly PageSection[]
  readonly assets: readonly PickerAsset[]
  readonly slotKeys: readonly string[]
  readonly canWrite: boolean
  readonly canDelete: boolean
  /**
   * The permissions this editor actually holds, resolved on the server.
   *
   * THE STATUS BUTTONS ARE FILTERED BY THEM, not merely by which edges exist. A merchandiser
   * looking at a DRAFT section should not see an "APPROVED" button that will refuse them: an
   * offered control that always fails is worse than an absent one, because it reads as a bug in
   * the product rather than as a boundary. `lib/cms/publishing.ts` still checks server-side —
   * this only decides what is drawn.
   */
  readonly permissions: readonly Permission[]
  readonly onSave: (values: SectionFormValues) => Promise<{ ok: boolean; error?: string }>
  readonly onDelete: (sectionId: string) => Promise<{ ok: boolean; error?: string }>
  readonly onReorder: (sectionIds: readonly string[]) => Promise<{ ok: boolean; error?: string }>
  readonly onTransition: (
    sectionId: string,
    from: string,
    to: string,
  ) => Promise<{ ok: boolean; error?: string }>
}

export function SectionBoard({
  pageId,
  sections,
  assets,
  slotKeys,
  canWrite,
  canDelete,
  permissions,
  onSave,
  onDelete,
  onReorder,
  onTransition,
}: SectionBoardProps): React.ReactElement {
  const [order, setOrder] = React.useState<readonly PageSection[]>(sections)
  const [editing, setEditing] = React.useState<PageSection | null>(null)
  const [deleting, setDeleting] = React.useState<PageSection | null>(null)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  /**
   * The server is the source of truth: a revalidation after any mutation re-renders this component
   * with fresh rows, and the local order must follow rather than pin the stale one.
   *
   * ADJUSTED DURING RENDER, NOT IN AN EFFECT. `useEffect(() => setOrder(sections), [sections])`
   * is the same idea and is a bug: it commits the stale order to the DOM first and then replaces
   * it, so a reorder that the server rejected flickers back to the wrong position before
   * correcting. Setting state during render is what React documents for exactly this — it
   * re-renders immediately without committing the intermediate output.
   */
  const [seen, setSeen] = React.useState(sections)
  if (seen !== sections) {
    setSeen(sections)
    setOrder(sections)
  }

  async function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= order.length) return

    const next = [...order]
    const [moved] = next.splice(index, 1)
    if (moved === undefined) return
    next.splice(target, 0, moved)

    const previous = order
    setOrder(next)
    setError(null)

    const result = await onReorder(next.map((section) => section.id))
    if (!result.ok) {
      setOrder(previous)
      setError(result.error ?? null)
    }
  }

  if (order.length === 0) {
    return (
      <EmptyState
        reason="empty"
        heading={t('studio.content.page.emptyHeading')}
        body={t('studio.content.page.emptyBody')}
      />
    )
  }

  return (
    <Stack gap={4}>
      {error === null ? null : (
        <Text size="sm" tone="secondary">
          {error}
        </Text>
      )}

      <ol className="flex list-none flex-col gap-3">
        {order.map((section, index) => {
          const block = blockModuleFor(section.block_type)
          const edges = allowedTransitions(section.status, permissions)

          return (
            <li key={section.id}>
              <Surface level={1} className="p-4">
                <Stack gap={3}>
                  <Cluster gap={3} className="items-center justify-between">
                    <Cluster gap={3} className="items-center">
                      <Text size="sm" tone="tertiary">
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      <Heading level={3} size="display-xs">
                        {block?.label ?? section.block_type}
                      </Heading>
                      <StatusPill status={section.status} />
                      {section.is_visible ? null : (
                        <Badge tone="neutral">{t('studio.content.section.hiddenLabel')}</Badge>
                      )}
                    </Cluster>

                    <Cluster gap={2}>
                      {canWrite ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={index === 0}
                            aria-label={t('studio.content.section.moveUpLabel')}
                            onClick={() => void move(index, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={index === order.length - 1}
                            aria-label={t('studio.content.section.moveDownLabel')}
                            onClick={() => void move(index, 1)}
                          >
                            ↓
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setError(null)
                              setEditing(section)
                            }}
                          >
                            {t('studio.content.section.editLabel')}
                          </Button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleting(section)}
                        >
                          {t('studio.content.section.deleteLabel')}
                        </Button>
                      ) : null}
                    </Cluster>
                  </Cluster>

                  {section.heading === null ? null : <Text size="sm">{section.heading}</Text>}

                  {block === null || block.state !== 'BUILT' ? (
                    <Text size="sm" tone="tertiary">
                      {t('studio.content.section.noRenderer')}
                    </Text>
                  ) : null}

                  {section.schedule_state !== 'BLOCKED' ? null : (
                    <Stack gap={1}>
                      <Text size="sm" tone="secondary">
                        {t('studio.content.section.scheduleBlocked')}
                      </Text>
                      {section.schedule_error === null ? null : (
                        <Text size="xs" tone="tertiary">
                          {section.schedule_error}
                        </Text>
                      )}
                    </Stack>
                  )}

                  {edges.length === 0 ? null : (
                    <Cluster gap={2}>
                      {edges.map((edge) => (
                        <Button
                          key={edge.to}
                          type="button"
                          variant="quiet"
                          size="sm"
                          onClick={() => {
                            setError(null)
                            void onTransition(section.id, section.status, edge.to).then(
                              (result) => {
                                if (!result.ok) setError(result.error ?? null)
                              },
                            )
                          }}
                        >
                          {edge.to}
                        </Button>
                      ))}
                    </Cluster>
                  )}
                </Stack>
              </Surface>
            </li>
          )
        })}
      </ol>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing === null
            ? t('studio.content.section.editLabel')
            : (blockModuleFor(editing.block_type)?.label ?? editing.block_type)
        }
        closeLabel={t('studio.content.section.closeLabel')}
      >
        {editing === null ? null : (
          <SectionForm
            block={blockModuleFor(editing.block_type) ?? FALLBACK_BLOCK}
            values={toFormValues(editing)}
            assets={assets}
            slotKeys={slotKeys}
            pending={pending}
            error={error}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => {
              setPending(true)
              setError(null)
              void onSave({ ...values, pageId }).then((result) => {
                setPending(false)
                if (result.ok) setEditing(null)
                else setError(result.error ?? null)
              })
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('studio.content.section.deleteConfirmTitle')}
        body={t('studio.content.section.deleteConfirmBody')}
        confirmLabel={t('studio.content.section.deleteLabel')}
        cancelLabel={t('studio.content.section.cancelLabel')}
        closeLabel={t('studio.content.section.closeLabel')}
        onConfirm={() => {
          const target = deleting
          setDeleting(null)
          if (target === null) return
          void onDelete(target.id).then((result) => {
            if (!result.ok) setError(result.error ?? null)
          })
        }}
      />
    </Stack>
  )
}

/**
 * What the form falls back to for a `block_type` this build does not know.
 *
 * It renders the chrome and nothing else — no copy fields, no payload fields — so an editor can
 * still change the visibility, schedule and classification of a section whose block arrived from a
 * newer deploy. Guessing at its fields would be worse than showing none: a form built from the
 * wrong schema saves a payload that the real block will refuse.
 */
const FALLBACK_BLOCK = {
  type: 'statement',
  state: 'PLANNED',
  label: 'Unknown block',
  description: '',
  sharedFields: [],
  schema: { safeParse: (value: unknown) => ({ success: true as const, data: value }) },
  defaults: {},
  payloadFields: [],
  mediaSlots: [],
  layoutVariants: [],
  allowedPages: null,
} as const as unknown as NonNullable<ReturnType<typeof blockModuleFor>>
