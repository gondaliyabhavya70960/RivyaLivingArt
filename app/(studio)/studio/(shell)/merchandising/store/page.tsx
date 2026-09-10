import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable } from '@/components/studio/DataTable'
import { CategoryOrderControls } from '@/components/studio/merchandising/CategoryOrderControls'
import { loadEntityLists, loadSlot } from '@/components/studio/merchandising/load'
import { SlotEditor } from '@/components/studio/merchandising/SlotEditor'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { categorySlotKey } from '@/lib/cms/merchandising-register'
import { listCategoriesForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { listSlotsOwnedBy } from '@/lib/supabase/repositories/merchandising'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/lib/supabase/schemas'

import {
  addEntryAction,
  entryAction,
  moveCategoryAction,
  restoreCategoryOrderAction,
  saveSlotSettingsAction,
} from '../actions'

/**
 * /studio/merchandising/store — the order of the categories, and the pieces pinned in each.
 *
 * ORDER IS `categories.sort_order`, THE PHASE 03 COLUMN, and nothing new: the mega menu, the
 * catalogue's facets and every category list already read it, so a move here is visible
 * everywhere at once. The default is SEED §13's order and one button restores it. Moving Gifts or
 * Décor above Furniture is refused once with the SEED §56 warning and allowed on the second submit
 * — the drift the guard exists to name, named, and then the owner's decision.
 *
 * EACH CATEGORY'S PINNED SLOT IS EDITED BESIDE IT. The seven `CATEGORY_PINNED_*` slots are owned
 * here and nowhere else; a category whose slot is missing says so rather than drawing an editor
 * for nothing.
 */
export const metadata = studioMetadata('/studio/merchandising/store')

const ROUTE = '/studio/merchandising/store'

/** SEED §56: Gifts or Décor above Furniture. Named on the screen, not just refused in the action. */
function invertsPriority(ordered: readonly Category[]): boolean {
  const slugs = ordered.map((category) => category.slug)
  const furniture = slugs.indexOf('furniture')
  if (furniture === -1) return false
  return ['gifts', 'decor'].some((slug) => {
    const at = slugs.indexOf(slug)
    return at !== -1 && at < furniture
  })
}

export default async function Page() {
  const session = await requirePermission('catalog.read')
  const canWrite = roleHasPermission(session.role, 'merchandising.write')
  const client = await createClient()

  const [categories, owned, lists] = await Promise.all([
    listCategoriesForStudio(client),
    listSlotsOwnedBy(client, ROUTE),
    loadEntityLists(client, ['PRODUCT']),
  ])
  const primary = categories.filter((category) => category.parent_id === null)
  const loaded = new Map(
    await Promise.all(owned.map(async (slot) => [slot.key, await loadSlot(client, slot)] as const)),
  )
  const inverted = invertsPriority(primary)

  return (
    <StudioPage path={ROUTE}>
      <Stack gap={10}>
        <HelpText>{t('studio.merchandising.store.help')}</HelpText>
        {canWrite ? null : <HelpText>{t('studio.merchandising.readOnlyNote')}</HelpText>}

        <Stack
          gap={4}
          data-category-order-panel=""
          data-priority-inverted={inverted ? '' : undefined}
        >
          <PageHeader level={2} title={t('studio.merchandising.store.orderHeading')} />
          {inverted ? (
            <Text size="sm" tone="secondary" data-priority-warning="">
              {t('studio.merchandising.store.priorityWarning')}
            </Text>
          ) : null}
          <DataTable<Category>
            caption={t('studio.merchandising.store.orderCaption')}
            rows={primary}
            rowKey={(category) => category.id}
            empty={{
              reason: 'empty',
              heading: t('studio.merchandising.store.orderHeading'),
              body: t('studio.merchandising.store.restoreHelp'),
            }}
            columns={[
              {
                id: 'category',
                header: t('studio.merchandising.store.colCategory'),
                cell: (category) => category.name,
              },
              {
                id: 'status',
                header: t('studio.merchandising.store.colStatus'),
                cell: (category) => <StatusPill status={category.status} />,
              },
              {
                id: 'order',
                header: t('studio.merchandising.store.colOrder'),
                cell: (category) => {
                  const index = primary.findIndex((candidate) => candidate.id === category.id)
                  return canWrite ? (
                    <CategoryOrderControls
                      categoryId={category.id}
                      isFirst={index === 0}
                      isLast={index === primary.length - 1}
                      action={moveCategoryAction}
                      labels={{
                        moveUp: t('studio.merchandising.entry.moveUp'),
                        moveDown: t('studio.merchandising.entry.moveDown'),
                        confirm: t('studio.merchandising.store.priorityConfirm'),
                      }}
                    />
                  ) : (
                    String(category.sort_order)
                  )
                },
              },
            ]}
          />
          {canWrite ? (
            <ActionForm action={restoreCategoryOrderAction}>
              <Stack gap={2}>
                <HelpText>{t('studio.merchandising.store.restoreHelp')}</HelpText>
                <div>
                  <Button type="submit" data-restore-order="">
                    {t('studio.merchandising.store.restore')}
                  </Button>
                </div>
              </Stack>
            </ActionForm>
          ) : null}
        </Stack>

        <Divider />
        <PageHeader
          level={2}
          title={t('studio.merchandising.store.pinnedHeading')}
          description={t('studio.merchandising.store.pinnedHelp')}
        />
        {primary.map((category) => {
          const entry = loaded.get(categorySlotKey(category.slug))
          return (
            <Stack key={category.id} gap={4} data-category-pinned={category.slug}>
              {entry === undefined ? (
                <>
                  <PageHeader level={3} title={category.name} />
                  <HelpText>{t('studio.merchandising.store.noSlot')}</HelpText>
                </>
              ) : (
                <SlotEditor
                  slot={entry.slot}
                  entries={entry.entries}
                  labels={lists.labels}
                  candidates={lists.candidates}
                  preview={entry.preview}
                  route={ROUTE}
                  canWrite={canWrite}
                  addAction={addEntryAction}
                  entryAction={entryAction}
                  settingsAction={saveSlotSettingsAction}
                />
              )}
            </Stack>
          )
        })}
      </Stack>
    </StudioPage>
  )
}
