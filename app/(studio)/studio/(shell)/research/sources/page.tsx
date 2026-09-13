import type { Route } from 'next'

import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { TextLink } from '@/components/primitives/TextLink'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { ListPage } from '@/components/studio/ListPage'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioActionLink } from '@/components/studio/StudioAction'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { HealthPill } from '@/components/studio/research/HealthPill'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import {
  listSourceHealth,
  type SourceHealth,
} from '@/lib/supabase/repositories/research/source-health'
import {
  listResearchSources,
  type ResearchSourceRow,
} from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

/**
 * /studio/research/sources — the list, and the two facts anybody opening it is checking.
 *
 * MAY WE READ THIS SITE, AND IS IT WORKING. Phase 25 answered the first with a policy column; this
 * phase adds the second, and it is a VIEW rather than a stored column so it cannot be out of date
 * at the moment somebody looks — which is during an incident, when a cached health value is most
 * likely to be wrong and most likely to be believed.
 *
 * THE HEALTH READ IS ONE QUERY FOR THE WHOLE LIST, not one per row. `research_source_health_v`
 * aggregates run history, queue depth and schedule cadence, and asking it per source would be four
 * joins repeated once per line of the table.
 */
export const metadata = studioMetadata('/studio/research/sources')

type Row = ResearchSourceRow & { readonly health: SourceHealth | null }

export default async function Page() {
  const session = await requirePermission('research.read')
  const client = await createClient()

  const [sources, health] = await Promise.all([
    listResearchSources(client),
    listSourceHealth(client),
  ])
  const byId = new Map(health.map((entry) => [entry.sourceId, entry]))
  const rows: Row[] = sources.map((source) => ({
    ...source,
    health: byId.get(source.id) ?? null,
  }))

  const canWrite = roleHasPermission(session.role, 'research.write')

  const columns: readonly Column<Row>[] = [
    {
      id: 'name',
      header: t('studio.research.sourceName'),
      cell: (row) => (
        <Stack gap={1}>
          <TextLink href={`/studio/research/sources/${row.id}` as Route}>{row.name}</TextLink>
          <Text size="xs" tone="tertiary" className="font-mono">
            {row.base_url}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'health',
      header: t('studio.research.healthHeading'),
      cell: (row) => <HealthPill health={row.health?.health ?? null} />,
    },
    {
      id: 'policy',
      header: t('studio.research.policyHeading'),
      cell: (row) => (
        <Badge tone={row.policy_status === 'APPROVED' ? 'neutral' : 'danger'}>
          {row.policy_status}
        </Badge>
      ),
    },
    {
      id: 'readiness',
      header: t('studio.research.readinessHeading'),
      cell: (row) => (
        <Text size="sm" tone="secondary">
          {row.readiness}
        </Text>
      ),
    },
    {
      id: 'last-run',
      header: t('studio.research.lastRun'),
      cell: (row) =>
        row.health?.lastRunAt === null || row.health?.lastRunAt === undefined ? (
          <Text size="sm" tone="tertiary">
            —
          </Text>
        ) : (
          <Text size="sm" tone="secondary">
            {row.health.lastRunAt.slice(0, 16).replace('T', ' ')}
          </Text>
        ),
    },
    {
      id: 'queue',
      header: t('studio.research.queueDepth'),
      numeric: true,
      cell: (row) => <Text size="sm">{row.health?.queueDepth ?? 0}</Text>,
    },
    {
      id: 'adapter',
      header: t('studio.research.sourceAdapter'),
      cell: (row) => (
        <Text size="sm" tone="secondary" className="font-mono">
          {row.adapter_key}
        </Text>
      ),
    },
  ]

  return (
    <StudioPage
      path="/studio/research/sources"
      /*
       * "Add source" MOVED UP OUT OF THE POLICY CARD. §8's checklist wants the primary action
       * visible without scrolling, and every other Studio list now puts it beside the page's own
       * heading. Leaving it nested inside a notice card meant the one control on the screen sat
       * wherever that card happened to end up.
       */
      actions={
        canWrite ? (
          <StudioActionLink
            href="/studio/research/sources/new"
            label={t('studio.research.addSource')}
            tone="primary"
          />
        ) : undefined
      }
    >
      <Stack gap={8}>
        <ListPage
          filters={
            /* Not a filter — the standing policy notice, in the slot that keeps the rows starting
               at the same height as every other Studio list. This screen is the one in §7's table
               whose name does not tell you its job: "sources" reads as a feed list until you know
               the scraper is off by default and each row needs a written policy note. */
            <Surface level={1} className="p-6">
              <PageHeader level={2} title={t('studio.research.policyOwnerOnly')} />
              <Text tone="secondary" className="mt-3">
                {t('studio.research.policyOwnerOnlyBody')}
              </Text>
            </Surface>
          }
        >
          <DataTable
            caption={t('studio.research.sourcesHeading')}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            empty={{
              reason: 'empty',
              heading: t('studio.research.noSources'),
              body: t('studio.research.noSourcesBody'),
              /*
               * An empty source list is the CORRECT state of this repository — the pack's 60
               * comparators ship disabled and `research_sources` is deliberately not seeded. The
               * CTA opens the form where a policy note gets written; it does not enable anything,
               * and it appears only for a role that could act on it.
               */
              ...(canWrite
                ? {
                    actionHref: '/studio/research/sources/new',
                    actionLabel: t('studio.research.addSource'),
                  }
                : {}),
            }}
          />
        </ListPage>

        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.research.healthHeading')} />
          <Text tone="secondary" className="mt-3">
            {t('studio.research.healthBody')}
          </Text>
        </Surface>
      </Stack>
    </StudioPage>
  )
}
