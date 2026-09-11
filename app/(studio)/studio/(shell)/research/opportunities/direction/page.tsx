import type { Route } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listDirectionBriefs } from '@/lib/supabase/repositories/research/direction'
import type { DirectionBriefRow } from '@/lib/supabase/schemas/research-direction'
import { createClient } from '@/lib/supabase/server'

import { createBriefAction } from './actions'

/**
 * /studio/research/opportunities/direction — the brief list, and where a brief begins.
 *
 * A LEAF OF ITS OWN UNDER RESEARCH (amendment A34). The phase document mounts briefs as a nested
 * segment of `opportunities`; the manifest test governs every static route, so the list is a leaf
 * and the `[briefId]` editor is governed through it.
 *
 * A NEW BRIEF IS A TITLE AND NOTHING ELSE. The nine sections are never pre-filled.
 */
export const metadata = studioMetadata('/studio/research/opportunities/direction')

const PATH = '/studio/research/opportunities/direction'

export default async function Page() {
  const session = await requirePermission('research.read')
  const client = await createClient()
  const briefs = await listDirectionBriefs(client)
  const canWrite = roleHasPermission(session.role, 'research.direction.write')

  const columns: readonly Column<DirectionBriefRow>[] = [
    {
      id: 'title',
      header: t('studio.research.dirColTitle'),
      cell: (row) => (
        <Link href={`${PATH}/${row.id}` as Route} className="underline" data-brief-link={row.id}>
          <Text size="sm" as="span">
            {row.title}
          </Text>
        </Link>
      ),
    },
    {
      id: 'status',
      header: t('studio.research.dirColStatus'),
      cell: (row) => <StatusPill status={row.status} />,
    },
    {
      id: 'category',
      header: t('studio.research.dirColCategory'),
      cell: (row) => (
        <Text size="sm" tone="secondary">
          {row.target_category_slug ?? t('studio.research.dirCategoryNone')}
        </Text>
      ),
    },
    {
      id: 'updated',
      header: t('studio.research.dirColUpdated'),
      cell: (row) => <Text size="sm">{row.updated_at.slice(0, 16).replace('T', ' ')}</Text>,
    },
    {
      id: 'approved',
      header: t('studio.research.dirColApproved'),
      cell: (row) =>
        row.approved_at === null ? (
          <Text size="sm" tone="secondary">
            —
          </Text>
        ) : (
          <Badge tone="info">{row.approved_at.slice(0, 10)}</Badge>
        ),
    },
  ]

  return (
    <StudioPage path="/studio/research/opportunities/direction">
      <Stack gap={6}>
        <Surface level={1} className="p-6" data-direction-header="">
          <Stack gap={3}>
            <PageHeader
              level={2}
              title={t('studio.research.dirHeading')}
              description={t('studio.research.dirBody')}
            />
            <Text size="xs" tone="secondary" data-direction-banner="">
              {t('studio.research.dirBanner')}
            </Text>
            {canWrite ? (
              <ActionForm action={createBriefAction}>
                <Cluster gap={3} align="end">
                  <label className="flex min-w-72 flex-col gap-1">
                    <Text size="xs" tone="secondary" as="span">
                      {t('studio.research.dirTitle')}
                    </Text>
                    <Input name="title" required data-brief-title-input="" />
                  </label>
                  <label className="flex min-w-56 flex-col gap-1">
                    <Text size="xs" tone="secondary" as="span">
                      {t('studio.research.dirSlug')}
                    </Text>
                    <Input name="slug" />
                  </label>
                  <Button type="submit" variant="primary" data-create-brief="">
                    {t('studio.research.dirCreate')}
                  </Button>
                </Cluster>
              </ActionForm>
            ) : null}
          </Stack>
        </Surface>

        <DataTable
          caption={t('studio.research.dirHeading')}
          columns={columns}
          rows={briefs}
          rowKey={(row) => row.id}
          empty={{
            reason: 'empty',
            heading: t('studio.research.dirEmpty'),
            body: t('studio.research.dirEmptyBody'),
          }}
        />
      </Stack>
    </StudioPage>
  )
}
