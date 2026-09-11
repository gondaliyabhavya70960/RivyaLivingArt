import Link from 'next/link'
import type { Route } from 'next'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { PageHeader } from '@/components/studio/PageHeader'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listComparisonSets } from '@/lib/supabase/repositories/research/analytics'
import type { ComparisonSetRow } from '@/lib/supabase/schemas/research-analytics'
import { createClient } from '@/lib/supabase/server'

import { createSetAction, duplicateSetAction } from './actions'

/**
 * /studio/research/compare — every comparison set, and the form that creates one.
 *
 * THE PERMISSION CHECK IS THE SAME CALL THE PHASE 30 STUB MADE. `research.read` to see the list;
 * `research.write` to create, duplicate or delete, checked again in every Server Action — the
 * controls below are a courtesy, not the boundary.
 *
 * WHAT A SET IS: a saved question, not evidence. Deleting one removes its snapshots and touches no
 * research row, which is why delete is `research.write` rather than `destructive.execute`.
 */
export const metadata = studioMetadata('/studio/research/compare')

const BASE_PATH = '/studio/research/compare'

export default async function Page() {
  const session = await requirePermission('research.read')
  const client = await createClient()
  const sets = await listComparisonSets(client)
  const canWrite = roleHasPermission(session.role, 'research.write')

  const columns: readonly Column<ComparisonSetRow>[] = [
    {
      id: 'name',
      header: t('studio.research.compareName'),
      cell: (row) => (
        <Link
          href={`${BASE_PATH}/${row.id}` as Route}
          className="underline underline-offset-4"
          data-set-link={row.slug}
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: 'rule',
      header: t('studio.research.compareBandRule'),
      cell: (row) => (
        <Text size="sm" tone="secondary">
          {row.band_rule}
        </Text>
      ),
    },
    {
      id: 'computed',
      header: t('studio.research.compareLastComputed'),
      cell: (row) =>
        row.last_computed_at === null ? (
          <Text size="sm" tone="secondary">
            {t('studio.research.compareNeverComputed')}
          </Text>
        ) : (
          <Text size="sm" tone="secondary">
            <RelativeTime value={row.last_computed_at} />
          </Text>
        ),
    },
    {
      id: 'actions',
      header: t('studio.research.compareOpen'),
      cell: (row) => (
        <Cluster gap={2}>
          <Link
            href={`${BASE_PATH}/${row.id}` as Route}
            className="text-sm underline underline-offset-4"
          >
            {t('studio.research.compareOpen')}
          </Link>
          {canWrite ? (
            <ActionForm action={duplicateSetAction}>
              <input type="hidden" name="set_id" value={row.id} />
              <Button type="submit" variant="quiet" size="sm">
                {t('studio.research.compareDuplicate')}
              </Button>
            </ActionForm>
          ) : null}
        </Cluster>
      ),
    },
  ]

  return (
    <StudioPage path={BASE_PATH}>
      <Stack gap={6}>
        <Text tone="secondary">{t('studio.research.compareSetsBody')}</Text>

        <DataTable
          caption={t('studio.research.compareSetsHeading')}
          columns={columns}
          rows={sets}
          rowKey={(row) => row.id}
          empty={{
            reason: 'empty',
            heading: t('studio.research.compareSetsEmpty'),
            body: t('studio.research.compareSetsEmptyBody'),
          }}
        />

        {canWrite ? (
          <Surface level={1} className="p-6" data-create-set="">
            <Stack gap={4}>
              <PageHeader level={2} title={t('studio.research.compareCreate')} />
              <ActionForm action={createSetAction}>
                <Stack gap={3}>
                  <Cluster gap={3} align="end">
                    <label className="flex min-w-56 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareName')}
                      </Text>
                      <Input name="name" required />
                    </label>
                    <label className="flex min-w-48 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareSlug')}
                      </Text>
                      <Input name="slug" />
                    </label>
                    <label className="flex min-w-56 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareBandRule')}
                      </Text>
                      <Select name="band_rule" defaultValue="QUANTILE">
                        <option value="QUANTILE">
                          {t('studio.research.compareBandRuleQuantile')}
                        </option>
                        <option value="FIXED">{t('studio.research.compareBandRuleFixed')}</option>
                      </Select>
                    </label>
                    <label className="flex min-w-56 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareBandEdges')}
                      </Text>
                      <Input name="band_edges" />
                    </label>
                  </Cluster>
                  <Cluster gap={3} align="end">
                    <label className="flex min-w-72 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareScopeNote')}
                      </Text>
                      <Input name="scope_note" />
                    </label>
                    <label className="flex min-w-72 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {t('studio.research.compareDescription')}
                      </Text>
                      <Input name="description" />
                    </label>
                    <Button type="submit" variant="primary" data-create-set-submit="">
                      {t('studio.research.compareCreate')}
                    </Button>
                  </Cluster>
                </Stack>
              </ActionForm>
            </Stack>
          </Surface>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
