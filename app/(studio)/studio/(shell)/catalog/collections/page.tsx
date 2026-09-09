import type { Route } from 'next'
import Link from 'next/link'

import { Divider } from '@/components/primitives/Divider'
import { Stack } from '@/components/primitives/Stack'
import { DataTable } from '@/components/studio/DataTable'
import { EntityForm } from '@/components/studio/catalog/EntityForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listCollectionsForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { createClient } from '@/lib/supabase/server'
import type { Collection } from '@/lib/supabase/schemas'

import { saveCollectionAction } from '../actions'

/**
 * /studio/catalog/collections — groupings that stay concepts.
 *
 * FEAT §9 IS THE WHOLE SHAPE OF THIS SCREEN. `collection_concept_state` has one value,
 * `DRAFT_COLLECTION_CONCEPT`, and Phase 16 adds the owner confirmation that introduces a second.
 * Until then a collection cannot be published, so there is no publish control here at all — not a
 * disabled one, which would read as a broken interface, and not a hidden one that appears for some
 * roles. The note above the form says why.
 *
 * A collection is still worth creating now: `product_collections` is what the `?collection=` facet
 * filters by, and grouping pieces is editorial work that can happen before the exhibition is real.
 */
export const metadata = studioMetadata('/studio/catalog/collections')

export default async function Page() {
  const session = await requirePermission('catalog.read')
  const collections = await listCollectionsForStudio(await createClient())
  const canWrite = roleHasPermission(session.role, 'catalog.write')

  return (
    <StudioPage path="/studio/catalog/collections">
      <Stack gap={8}>
        <DataTable<Collection>
          caption={t('studio.catalog.collections.caption')}
          rows={collections}
          rowKey={(collection) => collection.id}
          empty={{
            reason: 'empty',
            heading: t('studio.catalog.collections.emptyHeading'),
            body: t('studio.catalog.collections.emptyBody'),
          }}
          columns={[
            {
              id: 'name',
              header: t('studio.catalog.collections.colName'),
              // The name is the way in to the editor, where the concept is confirmed and the
              // exhibition page is created. Phase 16 added that screen; this comment's predecessor
              // said it would.
              cell: (collection) => (
                <Link
                  href={`/studio/catalog/collections/${collection.id}` as Route}
                  className="underline underline-offset-4"
                >
                  {collection.name}
                </Link>
              ),
            },
            {
              id: 'slug',
              header: t('studio.catalog.collections.colSlug'),
              cell: (collection) => collection.slug,
            },
            {
              id: 'concept',
              header: t('studio.catalog.collections.colConcept'),
              cell: (collection) => collection.concept_state,
            },
            {
              id: 'status',
              header: t('studio.catalog.collections.colStatus'),
              cell: (collection) => <StatusPill status={collection.status} />,
            },
          ]}
        />

        {canWrite ? (
          <>
            <Divider />
            <PageHeader level={2} title={t('studio.catalog.collections.newHeading')} />
            <EntityForm
              id={null}
              action={saveCollectionAction}
              submitLabelKey="studio.catalog.collection.save"
              canWrite
              note={t('studio.catalog.collections.conceptNote')}
              fields={[
                { name: 'name', labelKey: 'studio.catalog.collection.name', required: true },
                { name: 'slug', labelKey: 'studio.catalog.collection.slug', required: true },
                {
                  name: 'statement',
                  labelKey: 'studio.catalog.collection.statement',
                  kind: 'textarea',
                  rows: 4,
                },
                { name: 'sort_order', labelKey: 'studio.catalog.collection.sortOrder' },
              ]}
            />
          </>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
