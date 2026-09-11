import type { ReactNode } from 'react'

import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { PageHeader } from '@/components/studio/PageHeader'
import { LibraryCheckPanel } from '@/components/studio/research/LibraryCheckPanel'
import { SimilarityLegend } from '@/components/studio/research/SimilarityLegend'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { flagStates } from '@/lib/flags'
import { hashCoverage } from '@/lib/supabase/repositories/media-hashes'
import { listSimilarityRuns } from '@/lib/supabase/repositories/research/similarity'
import type { SimilarityRunRow } from '@/lib/supabase/schemas/similarity'
import { createClient } from '@/lib/supabase/server'

import { runLibraryCheckAction } from './actions'

/**
 * /studio/research/similarity — Phase 33, the first-party half.
 *
 * Four regions, in the order a reader needs them: the owner's decision (competitor images are
 * referenced by URL and never fetched) with the two flags that record it; the band legend with
 * its "does not mean" column, above anything that could be read as a result; the Rivya library —
 * how much of it is hashed, and the self-check that compares it with itself; and the run history.
 *
 * NO RESULT HERE SAYS TWO THINGS ARE THE SAME PRODUCT. The legend is not collapsible.
 */
export const metadata = studioMetadata('/studio/research/similarity')

const PATH = '/studio/research/similarity'

export default async function Page() {
  const session = await requirePermission('research.read')
  const client = await createClient()
  const [flags, runs, coverage] = await Promise.all([
    flagStates(),
    listSimilarityRuns(client, 25),
    hashCoverage(client),
  ])
  const canRun = roleHasPermission(session.role, 'research.similarity.run')
  const hashingFlag = flags.find((flag) => flag.key === 'research_image_hashing')
  const embeddingFlag = flags.find((flag) => flag.key === 'advanced_similarity')
  const images = coverage.find((row) => row.kind === 'IMAGE')
  const videos = coverage.find((row) => row.kind === 'VIDEO')

  const flagBadge = (label: string, enabled: boolean | undefined): ReactNode => (
    <Badge tone={enabled === true ? 'warning' : 'neutral'} data-flag={label}>
      {`${label}: ${enabled === true ? t('studio.research.simFlagOn') : t('studio.research.simFlagOff')}`}
    </Badge>
  )

  const columns: readonly Column<SimilarityRunRow>[] = [
    {
      id: 'started',
      header: t('studio.research.simColStarted'),
      cell: (row) => <Text size="sm">{row.started_at.slice(0, 16).replace('T', ' ')}</Text>,
    },
    {
      id: 'scope',
      header: t('studio.research.simColScope'),
      cell: (row) => <Text size="sm">{row.scope_type}</Text>,
    },
    {
      id: 'method',
      header: t('studio.research.simColMethod'),
      cell: (row) => (
        <Text size="sm" tone="secondary">
          {row.method}
        </Text>
      ),
    },
    {
      id: 'status',
      header: t('studio.research.simColStatus'),
      cell: (row) => (
        <Badge
          tone={
            row.status === 'SUCCEEDED' ? 'neutral' : row.status === 'FAILED' ? 'danger' : 'info'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      id: 'hashed',
      header: t('studio.research.simColHashed'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.images_hashed)}</Text>,
    },
    {
      id: 'considered',
      header: t('studio.research.simColConsidered'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.pairs_considered)}</Text>,
    },
    {
      id: 'stored',
      header: t('studio.research.simColStored'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.pairs_stored)}</Text>,
    },
    {
      id: 'exact',
      header: t('studio.research.simColExact'),
      numeric: true,
      cell: (row) => <Text size="sm">{String(row.pairs_exact)}</Text>,
    },
    {
      id: 'skipped',
      header: t('studio.research.simColSkipped'),
      cell: (row) => (
        <Text size="xs" tone="secondary" className="break-words">
          {Object.entries(row.sources_skipped)
            .map(([slug, reason]) => `${slug}: ${reason}`)
            .join(' · ') || '—'}
        </Text>
      ),
    },
  ]

  return (
    <StudioPage path={PATH}>
      <Stack gap={6}>
        <Surface level={1} className="p-6" data-similarity-header="">
          <Stack gap={3}>
            <PageHeader
              level={2}
              title={t('studio.research.simHeading')}
              description={t('studio.research.simBody')}
            />
            <Stack gap={2} data-owner-decision="">
              <Text size="sm" as="span">
                {t('studio.research.simOwnerDecision')}
              </Text>
              <Text size="sm" tone="secondary">
                {t('studio.research.simDecision')}
              </Text>
            </Stack>
            <Cluster gap={2}>
              <Text size="xs" tone="secondary" as="span">
                {t('studio.research.simFlags')}
              </Text>
              {flagBadge('research_image_hashing', hashingFlag?.isEnabled)}
              {flagBadge('advanced_similarity', embeddingFlag?.isEnabled)}
            </Cluster>
            <Text size="xs" tone="secondary" data-not-built="">
              {t('studio.research.simNotBuilt')}
            </Text>
          </Stack>
        </Surface>

        <SimilarityLegend />

        <Surface level={1} className="p-6" data-library-panel="">
          <Stack gap={3}>
            <Heading level={2} size="display-xs">
              {t('studio.research.simLibraryHeading')}
            </Heading>
            <Text size="sm" tone="secondary">
              {t('studio.research.simLibraryBody')}
            </Text>
            <Cluster gap={2}>
              <Badge tone="neutral" data-coverage="IMAGE">
                {`${t('studio.research.simCoverageImages')}: ${String(images?.withPhash ?? 0)} ${t('studio.research.simCoverageOf')} ${String(images?.assets ?? 0)}`}
              </Badge>
              <Badge tone="neutral" data-coverage="VIDEO">
                {`${t('studio.research.simCoverageVideos')}: ${String(videos?.hashed ?? 0)} ${t('studio.research.simCoverageOf')} ${String(videos?.assets ?? 0)}`}
              </Badge>
            </Cluster>
            {(images?.hashed ?? 0) < (images?.assets ?? 0) ||
            (videos?.hashed ?? 0) < (videos?.assets ?? 0) ? (
              <Text size="xs" tone="secondary" data-backfill-hint="">
                {t('studio.research.simBackfillHint')}
              </Text>
            ) : null}
            {canRun ? (
              <LibraryCheckPanel
                action={runLibraryCheckAction}
                labels={{
                  button: t('studio.research.simRunLibrary'),
                  help: t('studio.research.simRunLibraryHelp'),
                  running: t('studio.research.simRunning'),
                  done: t('studio.research.simRunDone'),
                  noPairs: t('studio.research.simNoPairs'),
                  pairsHeading: t('studio.research.simPairsHeading'),
                  distance: t('studio.research.simDistance'),
                  exact: t('studio.research.simExact'),
                  compared: t('studio.research.simCompared'),
                }}
              />
            ) : null}
          </Stack>
        </Surface>

        <Surface level={1} className="p-6" data-similarity-history="">
          <Stack gap={3}>
            <Heading level={2} size="display-xs">
              {t('studio.research.simHistoryHeading')}
            </Heading>
            <DataTable
              caption={t('studio.research.simHistoryHeading')}
              columns={columns}
              rows={runs}
              rowKey={(row) => row.id}
              empty={{
                reason: 'empty',
                heading: t('studio.research.simHistoryEmpty'),
                body: t('studio.research.simRunLibraryHelp'),
              }}
            />
          </Stack>
        </Surface>
      </Stack>
    </StudioPage>
  )
}
