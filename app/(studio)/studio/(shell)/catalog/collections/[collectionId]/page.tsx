import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as React from 'react'

import { Divider } from '@/components/primitives/Divider'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { Button } from '@/components/primitives/Button'
import { CollectionCurator } from '@/components/studio/CollectionCurator'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { RelatedContentPicker } from '@/components/studio/RelatedContentPicker'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import {
  getCollectionByIdForStudio,
  listProductsForStudio,
} from '@/lib/supabase/repositories/catalog-admin'
import { getCollectionPageId, listCuratedEntries } from '@/lib/supabase/repositories/collections'
import {
  RELATION_ENTITIES,
  RELATION_KINDS,
  getRelations,
} from '@/lib/supabase/repositories/entity-relations'
import { NotFoundError } from '@/lib/supabase/errors'
import { createClient } from '@/lib/supabase/server'

import {
  addCuratedProductAction,
  createExhibitionPageAction,
  reorderCuratedProductAction,
  setConceptStateAction,
  setRelationAction,
} from './actions'

/**
 * /studio/catalog/collections/[collectionId] — where a concept becomes a collection.
 *
 * THE CONFIRMATION IS THE POINT OF THIS SCREEN, and it is separated from everything else on it.
 * FEAT §9 says a collection is a CONCEPT until the owner confirms it is real; the database refuses
 * to publish one that is not confirmed, and refuses the confirmation itself to anyone but an owner
 * or an administrator. This page shows that state first, in its own band, with the reason — rather
 * than as a dropdown among the fields, where it would read as a setting instead of a decision.
 *
 * NOTHING HERE PUBLISHES. Confirming makes a collection publishABLE; publication happens on the
 * exhibition page, through the content workflow, and carries across by trigger. The two acts belong
 * to different people answering different questions, and the phase ships with zero published
 * collections either way.
 *
 * ONE SCREEN RATHER THAN TABS, unlike the product editor. A product has four genuinely separate
 * bodies of work; a collection has one short form, a list of pieces and a list of links, and
 * splitting them would put three clicks between an editor and the thing they came to check — which
 * is usually whether the concept is confirmed.
 */
export const metadata = studioMetadata('/studio/catalog/collections')

export default async function Page({
  params,
}: {
  readonly params: Promise<{ collectionId: string }>
}) {
  const session = await requirePermission('catalog.read')
  const { collectionId } = await params

  const client = await createClient()
  const collection = await getCollectionByIdForStudio(client, collectionId).catch(
    (error: unknown) => {
      // A collection this role cannot see and one that does not exist are indistinguishable under
      // RLS, and must stay that way.
      if (error instanceof NotFoundError) return null
      throw error
    },
  )
  if (collection === null) notFound()

  const [curated, relations, pageId, products] = await Promise.all([
    listCuratedEntries(client, collection.id),
    getRelations(client, 'COLLECTION', collection.id),
    getCollectionPageId(client, collection.id),
    listProductsForStudio(client, {}),
  ])

  const canWrite = roleHasPermission(session.role, 'catalog.write')
  const canVerify = roleHasPermission(session.role, 'content.verify')
  const confirmed = collection.concept_state === 'OWNER_CONFIRMED'

  /*
   * THE TITLES COME FROM THE STUDIO PRODUCT LIST, NOT FROM A JOIN. `listCuratedEntries` returns
   * exactly what the curator is arranging — every piece, published or not — and a piece whose row
   * is not in this list still appears, by id. That is the honest failure: a curated piece the
   * editor cannot see is a permission fact worth showing, not a row to drop.
   */
  const titles = new Map(products.map((product) => [product.id, product]))
  const rows = curated.map((entry) => {
    const product = titles.get(entry.productId)
    return {
      productId: entry.productId,
      title: product?.title ?? null,
      slug: product?.slug ?? entry.productId,
      status: product?.status ?? '—',
    }
  })

  return (
    <StudioPage path="/studio/catalog/collections">
      <Stack gap={8}>
        <PageHeader
          level={1}
          title={collection.name ?? t('studio.catalog.collection.untitled')}
          description={collection.slug}
          actions={<StatusPill status={collection.status} />}
        />

        <Link
          href={'/studio/catalog/collections' as Route}
          className="underline underline-offset-4"
        >
          <Text size="sm" as="span">
            {t('studio.catalog.collection.back')}
          </Text>
        </Link>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.catalog.collection.conceptHeading')} />
          <Text size="sm" tone="secondary">
            {t('studio.catalog.collection.conceptBody')}
          </Text>
          <Text size="sm" data-concept-state={collection.concept_state}>
            {collection.concept_state}
          </Text>
          {/*
            THE CONTROLS ARE ABSENT FOR A ROLE THAT MAY NOT USE THEM, not disabled. A disabled
            confirm button on a merchandiser's screen reads as "ask someone to enable this", which
            is the wrong idea: the decision is not theirs to make at all. The Server Action checks
            `content.verify` again regardless — this is the affordance, not the guard.
          */}
          {canVerify ? (
            <ActionForm action={setConceptStateAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={collection.id} />
              <Button
                type="submit"
                name="concept_state"
                value={confirmed ? 'DRAFT_COLLECTION_CONCEPT' : 'OWNER_CONFIRMED'}
              >
                {confirmed
                  ? t('studio.catalog.collection.reopen')
                  : t('studio.catalog.collection.confirm')}
              </Button>
              <Button type="submit" name="concept_state" value="RETIRED" variant="secondary">
                {t('studio.catalog.collection.withdraw')}
              </Button>
            </ActionForm>
          ) : null}
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.catalog.collection.pageHeading')} />
          {pageId === null ? (
            <>
              <Text size="sm" tone="secondary">
                {t('studio.catalog.collection.pageAbsent')}
              </Text>
              {canWrite ? (
                <ActionForm action={createExhibitionPageAction}>
                  <input type="hidden" name="id" value={collection.id} />
                  <input type="hidden" name="slug" value={collection.slug} />
                  <input type="hidden" name="name" value={collection.name} />
                  <Button type="submit">{t('studio.catalog.collection.pageCreate')}</Button>
                </ActionForm>
              ) : null}
            </>
          ) : (
            <Link
              href={`/studio/content/pages/${pageId}` as Route}
              className="underline underline-offset-4"
              data-exhibition-page={pageId}
            >
              <Text size="sm" as="span">
                {t('studio.catalog.collection.pageEdit')}
              </Text>
            </Link>
          )}
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.catalog.collection.curationHeading')} />
          <CollectionCurator
            collectionId={collection.id}
            rows={rows}
            canWrite={canWrite}
            addAction={addCuratedProductAction}
            reorderAction={reorderCuratedProductAction}
          />
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.catalog.collection.relationsHeading')} />
          <RelatedContentPicker
            sourceId={collection.id}
            rows={relations.map((edge) => ({
              id: edge.id,
              targetType: edge.target_type,
              targetId: edge.target_id,
              relationType: edge.relation_type,
              note: edge.note,
            }))}
            targetTypes={RELATION_ENTITIES}
            relationTypes={RELATION_KINDS}
            canWrite={canWrite}
            action={setRelationAction}
          />
        </Stack>
      </Stack>
    </StudioPage>
  )
}
