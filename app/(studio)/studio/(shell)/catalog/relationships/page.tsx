import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { interpolate, siteString, siteStrings } from '@/lib/cms/strings'
import { suggestRelations, type Suggestion } from '@/lib/relations/rules'
import { listProductsForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { listGlobalContent } from '@/lib/supabase/repositories/cms'
import { listProductRelations } from '@/lib/supabase/repositories/product-edges'
import { createClient } from '@/lib/supabase/server'
import { isReciprocal } from '@/lib/supabase/schemas'

import { acceptSuggestionAction, dismissSuggestionAction, removeRelationAction } from './actions'
import { RelationRow, SuggestionRow } from './rows'

/**
 * /studio/catalog/relationships — the relationship workspace.
 *
 * THE D4 LEAF THIS PHASE FILLS. It was a stub with a real permission check and an unbuilt body;
 * the gate is unchanged, which is the point of having added it early.
 *
 * WHAT AN EDITOR CAN DO HERE, AND THE LIST IS EXACTLY FOUR: accept a suggestion, dismiss one,
 * remove an edge, and reorder within a relation type. Creating an edge by hand still happens on the
 * product's own Related tab, where the editor is already looking at the piece — a second create
 * form here would be a second place for the same act to go wrong.
 *
 * SUGGESTIONS ARE COMPUTED ON DEMAND AND NEVER STORED. `lib/relations/rules.ts` cannot write; this
 * page calls it per piece, and what comes back has no id of its own until somebody accepts it. That
 * is FEAT §11's rule made structural rather than remembered.
 *
 * THE COVERAGE PANEL COUNTS, IT DOES NOT WARN. A published piece with no hand-made connections
 * renders Phase 15's honest "More in {Category}" fallback, which is a correct page. The count is
 * work outstanding, not a defect list, and the seeded sentence says so.
 *
 * EVERY REASON A READER SEES IS `global_content`. The panel furniture is Studio chrome and comes
 * from `components/studio/strings.ts`; the four rule reasons are seeded rows, because what a rule
 * claims to have observed is copy an editor may need to reword.
 */
export const metadata = studioMetadata('/studio/catalog/relationships')

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('catalog.read')
  const canWrite = roleHasPermission(session.role, 'catalog.write')

  const params = await searchParams
  const rawId = params['product']
  const productId = (Array.isArray(rawId) ? rawId[0] : rawId) ?? null

  const client = await createClient()
  const [products, contentRows] = await Promise.all([
    listProductsForStudio(client),
    listGlobalContent(client),
  ])
  const strings = siteStrings(contentRows)

  const titleById = new Map(products.map((row) => [row.id, row.title ?? row.slug]))
  const published = products.filter((row) => row.status === 'PUBLISHED')

  const selected =
    productId === null ? null : (products.find((row) => row.id === productId) ?? null)

  const relations = selected === null ? [] : await listProductRelations(client, selected.id)
  const suggestions: Suggestion[] =
    selected === null ? [] : await suggestRelations(client, { type: 'product', id: selected.id })

  /**
   * COVERAGE IS COUNTED OVER PUBLISHED PIECES ONLY, and over HAND-MADE edges only.
   *
   * A draft has no public page, so a missing connection on one is not a gap a visitor can reach. And
   * an edge accepted from a rule still counts as made by hand — somebody pressed Accept — which is
   * why `origin` is not filtered here even though it is recorded.
   */
  const withEdges = new Set<string>()
  if (published.length > 0) {
    const { data } = await client
      .from('product_relations')
      .select('source_product_id')
      .in(
        'source_product_id',
        published.map((row) => row.id),
      )
    for (const row of data ?? []) withEdges.add(row.source_product_id)
  }
  const uncovered = published.length - withEdges.size
  const coverageTemplate = siteString(strings, 'UI_LABEL.relations.coverage')

  return (
    <StudioPage path="/studio/catalog/relationships">
      <Stack gap={8}>
        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.relationships.coverageHeading')} />
          {coverageTemplate === null ? null : (
            <Text tone="secondary" className="mt-2" data-coverage-count={uncovered}>
              {interpolate(coverageTemplate, { count: String(uncovered) })}
            </Text>
          )}
        </Surface>

        <Surface level={1} className="p-6">
          <PageHeader level={2} title={t('studio.relationships.pickerLabel')} />
          {/*
           * A plain list of links, not a client-side picker. The page is server-rendered per piece
           * so that a suggestion panel is always computed from the database the editor is looking
           * at, and a URL for one piece's relationships is a URL somebody can send to a colleague.
           */}
          <ul className="mt-4 flex flex-wrap gap-2 list-none">
            {products.map((product) => (
              <li key={product.id}>
                <a
                  href={`/studio/catalog/relationships?product=${product.id}`}
                  aria-current={product.id === selected?.id ? 'true' : undefined}
                  className={
                    product.id === selected?.id
                      ? 'border border-ink px-3 py-1 text-sm'
                      : 'border border-line px-3 py-1 text-sm text-ink-secondary hover:text-ink'
                  }
                >
                  {product.title ?? product.slug}
                </a>
              </li>
            ))}
          </ul>
        </Surface>

        {selected === null ? (
          <EmptyState
            reason="empty"
            heading={t('studio.relationships.pickHeading')}
            body={t('studio.relationships.pickBody')}
          />
        ) : (
          <>
            <Surface level={1} className="p-6">
              <PageHeader
                level={2}
                title={t('studio.relationships.edgesHeading')}
                actions={<Badge tone="neutral">{`${relations.length}`}</Badge>}
              />
              {relations.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    reason="empty"
                    heading={t('studio.relationships.emptyHeading')}
                    body={t('studio.relationships.emptyBody')}
                  />
                </div>
              ) : (
                <ul className="mt-4 list-none" data-relation-list>
                  {relations.map((relation) => (
                    <RelationRow
                      key={relation.id}
                      id={relation.id}
                      relationType={relation.relation_type}
                      targetLabel={
                        relation.target_type === 'product'
                          ? (titleById.get(relation.target_id) ?? relation.target_id)
                          : relation.target_id
                      }
                      targetType={relation.target_type}
                      origin={relation.origin}
                      ruleKey={relation.rule_key}
                      reciprocal={isReciprocal(relation.relation_type)}
                      canWrite={canWrite}
                      removeAction={removeRelationAction}
                    />
                  ))}
                </ul>
              )}
            </Surface>

            <Surface level={1} className="p-6">
              <PageHeader
                level={2}
                title={t('studio.relationships.suggestionsHeading')}
                actions={<Badge tone="neutral">{`${suggestions.length}`}</Badge>}
              />
              {suggestions.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    reason="empty"
                    heading={t('studio.relationships.noSuggestionsHeading')}
                    body={t('studio.relationships.noSuggestionsBody')}
                  />
                </div>
              ) : (
                <ul className="mt-4 list-none" data-suggestion-list>
                  {suggestions.map((suggestion) => (
                    <SuggestionRow
                      key={`${suggestion.ruleKey}:${suggestion.targetType}:${suggestion.targetId}`}
                      sourceId={selected.id}
                      suggestion={suggestion}
                      // A rule whose reason has not been seeded renders no sentence rather than its
                      // key: an editor must never be shown an internal identifier, and a suggestion
                      // with no stated reason is one they cannot judge.
                      reason={siteString(strings, `UI_LABEL.${suggestion.reasonKey}`)}
                      canWrite={canWrite}
                      acceptAction={acceptSuggestionAction}
                      dismissAction={dismissSuggestionAction}
                    />
                  ))}
                </ul>
              )}
            </Surface>
          </>
        )}
      </Stack>
    </StudioPage>
  )
}
