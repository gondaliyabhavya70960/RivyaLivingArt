import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { TextLink } from '@/components/primitives/TextLink'
import { Tabs, type TabItem } from '@/components/patterns/Tabs'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { LexiconEditor } from '@/components/studio/research/LexiconEditor'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { parseCoverage } from '@/lib/supabase/repositories/research/explorer'
import { listLexicon } from '@/lib/supabase/repositories/research/lexicon'
import { countUnresolvedCategoryMappings } from '@/lib/supabase/repositories/research/source-config'
import { listResearchSources } from '@/lib/supabase/repositories/research/sources'
import { tallyIssues } from '@/lib/supabase/repositories/research/validation-issues'
import { createClient } from '@/lib/supabase/server'

import { deleteLexiconEntryAction, saveLexiconEntryAction } from './actions'

/**
 * /studio/operations/data-quality — what the checks are finding, and where the parser is not
 * keeping up.
 *
 * TWO TABS, TWO WORLDS, AND THEY ARE NOT THE SAME QUESTION. Rivya's own products are validated as
 * they are edited and the answer lives on each product's readiness checklist — a per-row workflow
 * with a person already looking at it. Scraped rows are validated by a background pass over
 * thousands of pages nobody is watching, so the only place their findings become visible is an
 * aggregate like this one. Putting both on one page under one heading would suggest they are two
 * views of one dataset; they are two datasets with one shared vocabulary of rules.
 *
 * THE RESEARCH TAB IS ABSENT WITHOUT `research.read`, not empty. An editor is the one role that
 * does not hold it, and a tab that rendered with no rows would tell them a research corpus exists
 * and they may not see it — which is a disclosure, small but real, and the same reasoning the
 * command palette's provider registry uses.
 *
 * PARSE FAILURES ARE COUNTED FROM THE COLUMNS, NOT FROM THE ISSUE TABLE, and the difference
 * matters. An issue row says a RULE fired; a parse state says a value was not read. A source that
 * publishes no measurements anywhere raises nothing at all — every row is `ABSENT`, which is not a
 * failure — and a tab built only on issue counts would report it as perfectly healthy while a
 * whole column of the comparison sits empty.
 */
export const metadata = studioMetadata('/studio/operations/data-quality')

function Tile({
  label,
  value,
  tone,
}: {
  readonly label: string
  readonly value: string
  readonly tone?: 'danger' | 'warning' | 'neutral'
}) {
  return (
    <Surface level={2} className="min-w-40 p-4" data-tile={label}>
      <Stack gap={1}>
        <Text size="2xs" uppercase tone="tertiary">
          {label}
        </Text>
        <Cluster gap={2}>
          <Text size="lg">{value}</Text>
          {tone === undefined ? null : <Badge tone={tone}>{tone}</Badge>}
        </Cluster>
      </Stack>
    </Surface>
  )
}

async function ResearchTab({
  canWrite,
  canDelete,
}: {
  readonly canWrite: boolean
  readonly canDelete: boolean
}) {
  const client = await createClient()
  const [tallies, coverage, sources, lexicon, unmapped] = await Promise.all([
    tallyIssues(client),
    parseCoverage(client),
    listResearchSources(client),
    listLexicon(client),
    countUnresolvedCategoryMappings(client),
  ])

  const sourceNames = new Map(sources.map((source) => [source.id, source.name]))
  const errors = tallies
    .filter((entry) => entry.severity === 'ERROR')
    .reduce((n, e) => n + e.count, 0)
  const warnings = tallies
    .filter((entry) => entry.severity === 'WARNING')
    .reduce((n, e) => n + e.count, 0)

  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <PageHeader level={2} title={t('studio.research.dataQualityHeading')} />
        <Text tone="secondary">{t('studio.research.dataQualityBody')}</Text>
      </Stack>

      <Cluster gap={3}>
        <Tile label="errors" value={String(errors)} tone={errors > 0 ? 'danger' : undefined} />
        <Tile
          label="warnings"
          value={String(warnings)}
          tone={warnings > 0 ? 'warning' : undefined}
        />
        <Tile label={t('studio.research.unmappedCategories')} value={String(unmapped)} />
      </Cluster>

      <Surface level={1} className="p-6">
        <Stack gap={4}>
          <PageHeader level={3} title={t('studio.research.issuesHeading')} />
          {tallies.length === 0 ? (
            <EmptyState
              reason="empty"
              heading={t('studio.research.noIssues')}
              body={t('studio.research.noIssuesBody')}
            />
          ) : (
            <div className="border-line overflow-x-auto border">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t('studio.research.issuesHeading')}</caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th scope="col" className="p-2 text-left">
                      rule
                    </th>
                    <th scope="col" className="p-2 text-left">
                      severity
                    </th>
                    <th scope="col" className="p-2 text-right">
                      rows
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tallies.map((entry) => (
                    <tr
                      key={`${entry.rule}:${entry.severity}`}
                      className="border-line border-t"
                      data-tally-rule={entry.rule}
                    >
                      <td className="p-2 font-mono">
                        {/* A COUNT THAT LINKS TO THE ROWS BEHIND IT. A number nobody can act on is a
                            number people learn to ignore. */}
                        <TextLink href={`/studio/research/explorer?severity=${entry.severity}`}>
                          {entry.rule}
                        </TextLink>
                      </td>
                      <td className="p-2">{entry.severity}</td>
                      <td className="p-2 text-right">{entry.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      </Surface>

      <Surface level={1} className="p-6">
        <Stack gap={4}>
          <PageHeader level={3} title={t('studio.research.parseFailures')} />
          {coverage.length === 0 ? (
            <EmptyState
              reason="empty"
              heading={t('studio.research.noProducts')}
              body={t('studio.research.noProductsBody')}
            />
          ) : (
            <div className="border-line overflow-x-auto border">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t('studio.research.parseFailures')}</caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th scope="col" className="p-2 text-left">
                      source
                    </th>
                    <th scope="col" className="p-2 text-right">
                      rows
                    </th>
                    <th scope="col" className="p-2 text-right">
                      no measurements
                    </th>
                    <th scope="col" className="p-2 text-right">
                      ambiguous
                    </th>
                    <th scope="col" className="p-2 text-right">
                      no price
                    </th>
                    <th scope="col" className="p-2 text-right">
                      no materials
                    </th>
                    <th scope="col" className="p-2 text-right">
                      no category
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((entry) => (
                    <tr
                      key={entry.sourceId}
                      className="border-line border-t"
                      data-coverage-source={entry.sourceId}
                    >
                      <td className="p-2">{sourceNames.get(entry.sourceId) ?? entry.sourceId}</td>
                      <td className="p-2 text-right">{entry.total}</td>
                      <td className="p-2 text-right">{entry.dimensionsUnparsed}</td>
                      <td className="p-2 text-right">{entry.dimensionsAmbiguous}</td>
                      <td className="p-2 text-right">{entry.priceUnknown}</td>
                      <td className="p-2 text-right">{entry.noMaterials}</td>
                      <td className="p-2 text-right">{entry.unmatched}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      </Surface>

      <LexiconEditor
        entries={lexicon}
        canWrite={canWrite}
        canDelete={canDelete}
        saveAction={saveLexiconEntryAction}
        deleteAction={deleteLexiconEntryAction}
      />
    </Stack>
  )
}

function ProductsTab() {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={3}>
        <PageHeader level={2} title={t('studio.research.productsHeading')} />
        <Text tone="secondary">{t('studio.research.productsBody')}</Text>
        <TextLink href="/studio/catalog/products">{t('studio.command.groupProducts')}</TextLink>
      </Stack>
    </Surface>
  )
}

export default async function Page() {
  const session = await requirePermission('catalog.read')
  const canReadResearch = roleHasPermission(session.role, 'research.read')

  const items: readonly TabItem[] = [
    { id: 'products', label: t('studio.research.tabProducts'), content: <ProductsTab /> },
    // THE ROLE IS RESOLVED ONCE, AT THE TOP, AND PASSED DOWN. `requirePermission` writes an audit
    // row every time it runs; calling it again per control would put three rows in the log for one
    // page view and make "who looked at what" a count of components rather than of visits.
    ...(canReadResearch
      ? [
          {
            id: 'research',
            label: t('studio.research.tabResearch'),
            content: await ResearchTab({
              canWrite: roleHasPermission(session.role, 'research.write'),
              // `destructive.execute`, matching the delete policy the permission matrix gives
              // this table — not `research.confirm`, which a merchandiser holds and which RLS
              // would then refuse.
              canDelete: roleHasPermission(session.role, 'destructive.execute'),
            }),
          },
        ]
      : []),
  ]

  return (
    <StudioPage path="/studio/operations/data-quality">
      <Tabs items={items} label={t('studio.research.dataQualityHeading')} defaultValue="products" />
    </StudioPage>
  )
}
