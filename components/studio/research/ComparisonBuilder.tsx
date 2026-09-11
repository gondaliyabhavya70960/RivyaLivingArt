import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { EmptyState } from '@/components/studio/EmptyState'
import type { StudioFormAction } from '@/components/studio/form-state'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import type { ComparisonMemberRow } from '@/lib/supabase/schemas/research-analytics'

/**
 * RC-322 `ComparisonBuilder` — the members of a set: add a whole source or one research row,
 * move, remove.
 *
 * SERVER-RENDERED FORMS, NOT A DRAG LIST. Every control is a Server Action behind a plain form,
 * so the builder works with no JavaScript and every change is judged by RLS as the person. Reorder
 * is a pair of move buttons rather than a drag handle: it is the operation, without a client
 * island whose only job would be to feel nicer.
 */
export function ComparisonBuilder({
  setId,
  members,
  sources,
  productLabels,
  canWrite,
  actions,
}: {
  readonly setId: string
  readonly members: readonly ComparisonMemberRow[]
  readonly sources: readonly { readonly id: string; readonly name: string }[]
  readonly productLabels: ReadonlyMap<string, string>
  readonly canWrite: boolean
  readonly actions: {
    readonly add: StudioFormAction
    readonly remove: StudioFormAction
    readonly move: StudioFormAction
  }
}) {
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))
  return (
    <Surface level={1} className="p-6" data-comparison-builder="">
      <Stack gap={4}>
        <PageHeader level={2} title={t('studio.research.compareMembers')} />

        {members.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.compareMembersEmpty')}
            body={t('studio.research.compareMembersEmptyBody')}
          />
        ) : (
          <ol className="flex flex-col gap-2" data-member-list="">
            {members.map((member, index) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3"
                data-member={member.id}
                data-member-position={String(index)}
              >
                <Text size="xs" tone="secondary" as="span">
                  {member.member_type === 'SOURCE'
                    ? t('studio.research.compareMemberSource')
                    : t('studio.research.compareMemberProduct')}
                </Text>
                <Text size="sm" as="span" className="break-all">
                  {member.member_type === 'SOURCE'
                    ? (sourceNames.get(member.source_id ?? '') ?? member.source_id)
                    : (productLabels.get(member.research_product_id ?? '') ??
                      member.research_product_id)}
                </Text>
                {member.note === null ? null : (
                  <Text size="xs" tone="secondary" as="span">
                    {member.note}
                  </Text>
                )}
                {canWrite ? (
                  <Cluster gap={1}>
                    <ActionForm action={actions.move}>
                      <input type="hidden" name="set_id" value={setId} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button type="submit" variant="quiet" size="sm" disabled={index === 0}>
                        {t('studio.research.compareMoveUp')}
                      </Button>
                    </ActionForm>
                    <ActionForm action={actions.move}>
                      <input type="hidden" name="set_id" value={setId} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="quiet"
                        size="sm"
                        disabled={index === members.length - 1}
                      >
                        {t('studio.research.compareMoveDown')}
                      </Button>
                    </ActionForm>
                    <ActionForm action={actions.remove}>
                      <input type="hidden" name="set_id" value={setId} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <Button
                        type="submit"
                        variant="quiet"
                        size="sm"
                        data-remove-member={member.id}
                      >
                        {t('studio.research.compareRemove')}
                      </Button>
                    </ActionForm>
                  </Cluster>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {canWrite ? (
          <Stack gap={3}>
            <ActionForm action={actions.add}>
              <input type="hidden" name="set_id" value={setId} />
              <Cluster gap={3} align="end">
                <label className="flex min-w-48 flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.compareAddSource')}
                  </Text>
                  <Select name="source_id" defaultValue="">
                    <option value="">{t('studio.research.filterAll')}</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex min-w-64 flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.compareAddProduct')}
                  </Text>
                  <Input name="research_product_id" placeholder="" />
                </label>
                <label className="flex min-w-48 flex-col gap-1">
                  <Text size="xs" tone="secondary" as="span">
                    {t('studio.research.compareNote')}
                  </Text>
                  <Input name="note" />
                </label>
                <Button type="submit" variant="secondary" data-add-member="">
                  {t('studio.research.compareAdd')}
                </Button>
              </Cluster>
            </ActionForm>
          </Stack>
        ) : null}
      </Stack>
    </Surface>
  )
}
