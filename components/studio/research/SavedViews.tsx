import Link from 'next/link'
import type { Route } from 'next'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import {
  viewToSearchParams,
  type SavedViewRow,
  type ViewSurface,
} from '@/lib/supabase/repositories/research/saved-views'

/**
 * Named filter sets, per surface, each one a link.
 *
 * A VIEW IS A LINK AND THAT IS THE WHOLE FEATURE. "Large dining tables, one currency, in stock,
 * last thirty days" written down as a set of instructions is something a colleague reproduces
 * approximately; written down as a URL it is something they open. The filters are stored as data
 * and rebuilt into query parameters here, so a view and a hand-typed URL are the same thing.
 *
 * THE CURRENT FILTERS ARE WHAT GETS SAVED, taken from the page's own `searchParams` rather than
 * from a second form. A save control with its own filter inputs is a second way to express the
 * same state, and the two drift.
 *
 * A SHARED VIEW IS SOMEBODY ELSE'S ROW AND IS MARKED AS ONE. It is readable and not editable — the
 * policy says so and this says so too, because a control that looks editable and then fails is
 * worse than one that does not appear.
 */

export function SavedViews({
  surface,
  views,
  currentFilters,
  currentUserId,
  basePath,
  saveAction,
  deleteAction,
}: {
  readonly surface: ViewSurface
  readonly views: readonly SavedViewRow[]
  readonly currentFilters: Readonly<Record<string, string>>
  readonly currentUserId: string
  readonly basePath: string
  readonly saveAction: StudioFormAction
  readonly deleteAction: StudioFormAction
}) {
  return (
    <Surface level={1} className="p-4" data-saved-views={surface}>
      <Stack gap={3}>
        <PageHeader level={2} title={t('studio.research.savedViews')} />

        {views.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t('studio.research.savedViewNone')}
          </Text>
        ) : (
          <Stack gap={2}>
            {views.map((view) => {
              const params = viewToSearchParams(view.filters)
              const href = (
                params.toString() === '' ? basePath : `${basePath}?${params.toString()}`
              ) as Route
              const mine = view.owner_user_id === currentUserId

              return (
                <Cluster key={view.id} gap={2} data-saved-view={view.id}>
                  <Link href={href}>{view.name}</Link>
                  {view.is_shared ? <Badge tone="info">shared</Badge> : null}
                  {mine ? (
                    <ActionForm action={deleteAction}>
                      <input type="hidden" name="view_id" value={view.id} />
                      <Button type="submit" variant="quiet" size="sm">
                        {t('studio.research.savedViewDelete')}
                      </Button>
                    </ActionForm>
                  ) : (
                    // SOMEBODY ELSE'S VIEW, READ-ONLY. The policy refuses the write; this refuses
                    // to offer it, so nobody meets a failure they could not have predicted.
                    <Badge tone="neutral">read only</Badge>
                  )}
                </Cluster>
              )
            })}
          </Stack>
        )}

        <ActionForm action={saveAction}>
          <input type="hidden" name="surface" value={surface} />
          {/* THE CURRENT FILTERS, CARRIED AS HIDDEN FIELDS. What is saved is exactly what is on
              screen — there is no second set of inputs to drift from it. */}
          {Object.entries(currentFilters).map(([key, value]) => (
            <input key={key} type="hidden" name={`filter_${key}`} value={value} />
          ))}
          <Cluster gap={2} align="end">
            <label className="flex flex-1 flex-col gap-1">
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.savedViewName')}
              </Text>
              <Input name="name" required maxLength={80} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="is_shared" value="true" />
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.savedViewShare')}
              </Text>
            </label>
            <Button type="submit" variant="secondary" size="sm">
              {t('studio.research.apply')}
            </Button>
          </Cluster>
        </ActionForm>
      </Stack>
    </Surface>
  )
}
