import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import type { StudioFormAction } from '@/components/studio/form-state'

/**
 * Their words, mapped to Rivya's seven categories — or explicitly dismissed.
 *
 * THE THIRD STATE IS DRAWN, NOT HIDDEN. A row whose Rivya category has since been deleted reads
 * `UNRESOLVED`: the label somebody observed is still evidence, and the decision has to be made
 * again. Rendering it as an ordinary unmapped row would lose the fact that a decision was once
 * made here; rendering nothing would lose the row. See the long note on `mapping_state` in
 * migration 0240.
 *
 * NOTHING ON THIS SURFACE GUESSES. There is no "suggest mappings" control and there will not be
 * one: a suggested category accepted without thought is a category assignment nobody made, and
 * every chart in Phases 31 onwards inherits it.
 */

export interface CategoryMappingRow {
  readonly id: string
  readonly source_label: string
  readonly source_path: string | null
  readonly category_id: string | null
  readonly is_ignored: boolean
  readonly mapping_state: string
}

export interface CategoryOption {
  readonly id: string
  readonly name: string
}

export function CategoryMapEditor({
  sourceId,
  mappings,
  categories,
  canWrite,
  canDelete,
  saveAction,
  deleteAction,
}: {
  readonly sourceId: string
  readonly mappings: readonly CategoryMappingRow[]
  readonly categories: readonly CategoryOption[]
  readonly canWrite: boolean
  readonly canDelete: boolean
  readonly saveAction: StudioFormAction
  readonly deleteAction: StudioFormAction
}) {
  const nameById = new Map(categories.map((category) => [category.id, category.name]))

  return (
    <Surface level={1} className="p-6">
      <Stack gap={5}>
        <PageHeader level={2} title={t('studio.research.mappingHeading')} />
        <Text tone="secondary">{t('studio.research.mappingBody')}</Text>

        {mappings.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noMappings')}
            body={t('studio.research.noMappingsBody')}
          />
        ) : (
          <div className="border-line overflow-x-auto border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t('studio.research.mappingHeading')}</caption>
              <thead className="bg-surface-raised">
                <tr>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.mappingLabel')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.mappingPath')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.mappingCategory')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    <span className="sr-only">{t('studio.research.remove')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((row) => (
                  <tr key={row.id} className="border-line border-t" data-mapping-id={row.id}>
                    <td className="p-2">{row.source_label}</td>
                    <td className="text-ink-secondary p-2 font-mono text-xs">
                      {row.source_path ?? '—'}
                    </td>
                    <td className="p-2" data-mapping-state={row.mapping_state}>
                      {row.mapping_state === 'MAPPED' ? (
                        <Text size="sm" as="span">
                          {nameById.get(row.category_id ?? '') ?? row.category_id}
                        </Text>
                      ) : row.mapping_state === 'IGNORED' ? (
                        <Badge tone="neutral">{t('studio.research.mappingIgnore')}</Badge>
                      ) : (
                        <Badge tone="warning">UNRESOLVED</Badge>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {canDelete ? (
                        <ActionForm action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="source_id" value={sourceId} />
                          <Button type="submit" variant="quiet" size="sm">
                            {t('studio.research.remove')}
                          </Button>
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canWrite ? (
          <ActionForm action={saveAction}>
            <Stack gap={3}>
              <input type="hidden" name="source_id" value={sourceId} />
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.mappingLabel')}
                </Text>
                <Input name="source_label" />
              </label>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.mappingPath')}
                </Text>
                <Input name="source_path" className="font-mono" />
              </label>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.mappingCategory')}
                </Text>
                <Select name="category_id">
                  <option value="">—</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox name="is_ignored" />
                <Text size="sm" as="span">
                  {t('studio.research.mappingIgnore')}
                </Text>
              </label>
              <div>
                <Button type="submit" variant="secondary">
                  {t('studio.research.add')}
                </Button>
              </div>
            </Stack>
          </ActionForm>
        ) : null}
      </Stack>
    </Surface>
  )
}
