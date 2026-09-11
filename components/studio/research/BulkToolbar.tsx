'use client'

import * as React from 'react'

import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectionBar } from '@/components/studio/bulk'
import { PageHeader } from '@/components/studio/PageHeader'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'

/**
 * Row selection on a research surface, and the Phase 24 toolbar over it.
 *
 * **THE ONE CLIENT ISLAND ON THIS SCREEN, AND IT BUYS TWO THINGS ONLY**: the running count in the
 * selection bar, and showing the field an operation needs rather than all three at once. The
 * checkboxes, the table, the operation list and the submit are server-rendered and inside a real
 * form — so selecting forty rows and previewing works with no JavaScript at all. That is the same
 * bargain `BulkWorkspace` makes on the catalogue surface, and it is why this island holds no copy
 * of the selection: it READS the form rather than owning it.
 *
 * THE TABLE IS PASSED IN AS CHILDREN. A client component cannot render a Server Component, but it
 * can render one it is handed — so the rows, their copy and their formatting stay on the server and
 * this adds the form around them. The checkbox lives in a column of that table, named `selection`,
 * which is the only contract between the two halves.
 *
 * IT DOES NOT APPLY. Apply is on the preview the action redirects to, because an operator should
 * read what will happen on a surface that is not the one where they were clicking checkboxes a
 * second ago. Select → Preview → Confirm → Apply, and collapsing the middle two is how the middle
 * two stop happening.
 */

export interface ResearchOperationChoice {
  readonly kind: string
  readonly isDestructive: boolean
  readonly available: boolean
}

export interface ResearchTagChoice {
  readonly id: string
  readonly name: string
}

/** Which extra field an operation needs. Derived from the kind, so a new operation is one case. */
function fieldFor(kind: string): 'reason' | 'survivor' | 'tag' | 'none' {
  if (
    kind === 'research.reject' ||
    // Phase 35: the decision note, the closing reason and the archival reason.
    kind === 'research.confirm' ||
    kind === 'research.close_entry' ||
    kind === 'research.archive_confirmation'
  ) {
    return 'reason'
  }
  if (kind === 'research.mark_duplicate') return 'survivor'
  if (kind === 'research.set_tags') return 'tag'
  return 'none'
}

export function ResearchBulkToolbar({
  surface,
  filters,
  operations,
  tags,
  canDestroy,
  maxSelection,
  previewAction,
  children,
}: {
  readonly surface: string
  readonly filters: string
  readonly operations: readonly ResearchOperationChoice[]
  readonly tags: readonly ResearchTagChoice[]
  readonly canDestroy: boolean
  readonly maxSelection: number
  readonly previewAction: StudioFormAction
  readonly children: React.ReactNode
}): React.ReactElement {
  const [kind, setKind] = React.useState(operations[0]?.kind ?? '')
  const [count, setCount] = React.useState(0)

  /*
   * THE COUNT IS READ FROM THE FORM, NOT MIRRORED IN STATE.
   *
   * Two copies of a selection is how a screen comes to disagree with what it is about to submit —
   * a re-render, a browser restoring checked boxes on back-navigation, or a row that disappeared
   * from the list while the operator was reading. `FormData` of the form element is the truth the
   * server will receive, so it is what the bar counts.
   */
  const recount = (event: React.ChangeEvent<HTMLElement>): void => {
    const form = (event.target as HTMLInputElement).form
    if (form === null) return
    setCount(new FormData(form).getAll('selection').filter((value) => value !== '').length)
  }

  const needs = fieldFor(kind)

  return (
    <ActionForm action={previewAction}>
      <div onChange={recount}>
        <Stack gap={5}>
          <Surface level={1} className="p-6" data-research-bulk={surface}>
            <Stack gap={4}>
              <Stack gap={1}>
                <PageHeader level={2} title={t('studio.research.bulkHeading')} />
                <Text size="xs" tone="secondary">
                  {t('studio.research.bulkNote')}
                </Text>
              </Stack>

              <input type="hidden" name="surface" value={surface} />
              <input type="hidden" name="filters" value={filters} />

              <label className="flex max-w-md flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.bulk.chooseOperation')}
                </Text>
                <Select
                  name="kind"
                  required
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  data-operation-select=""
                >
                  {operations.map((operation) => {
                    // DISABLED RATHER THAN HIDDEN for a role without `destructive.execute`: absent,
                    // it teaches the operator the feature does not exist; disabled, it teaches them
                    // who to ask. The engine refuses either way.
                    const blocked = operation.isDestructive && !canDestroy
                    return (
                      <option
                        key={operation.kind}
                        value={operation.kind}
                        disabled={blocked || !operation.available}
                      >
                        {operation.kind}
                      </option>
                    )
                  })}
                </Select>
              </label>

              {needs === 'reason' ? (
                <label className="flex max-w-md flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.reasonRequired')}
                  </Text>
                  <textarea
                    name="reason"
                    rows={2}
                    className="border-line bg-surface border px-3 py-2 text-sm"
                    data-bulk-reason=""
                  />
                </label>
              ) : null}

              {needs === 'survivor' ? (
                <label className="flex max-w-md flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.bulkSurvivor')}
                  </Text>
                  <input
                    name="surviving_product_id"
                    className="border-line bg-surface border px-3 py-2 text-sm"
                    data-bulk-survivor=""
                  />
                </label>
              ) : null}

              {needs === 'tag' ? (
                tags.length === 0 ? (
                  <Text size="sm" tone="secondary">
                    {t('studio.research.bulkNoTags')}
                  </Text>
                ) : (
                  <Stack gap={2}>
                    <label className="flex max-w-md flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.actionTag')}
                      </Text>
                      <Select name="tag_id" defaultValue={tags[0]?.id ?? ''}>
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="remove" value="true" />
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.bulkTagRemove')}
                      </Text>
                    </label>
                  </Stack>
                )
              ) : null}
            </Stack>
          </Surface>

          {children}

          <SelectionBar selectedCount={count} maxSelection={maxSelection}>
            <button
              type="submit"
              className="border-ink tracking-technical border px-4 py-2 text-sm uppercase"
              data-bulk-preview=""
            >
              {t('studio.bulk.preview')}
            </button>
          </SelectionBar>
        </Stack>
      </div>
    </ActionForm>
  )
}
