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
import { listMaterialsForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { createClient } from '@/lib/supabase/server'
import type { Material } from '@/lib/supabase/schemas'

import { saveMaterialAction } from '../actions'

/**
 * /studio/catalog/materials — the vocabulary the collection filters by.
 *
 * THE FAMILY LIST IS CLOSED, and it is closed in the database: `materials_family_allowed` permits
 * resin, timber, metal, stone and finish. It is restated here as the select's options rather than
 * read from the catalogue, because a free-text field would let "wood" and "timber" become two
 * families that mean one thing and split every filter between them. The constraint is the
 * guarantee; this is the interface that never has to hit it.
 *
 * THE CREATE FORM IS ON THE LIST, not behind a route. A material is four fields; a page of its own
 * for four fields is a navigation step that buys nothing.
 */
export const metadata = studioMetadata('/studio/catalog/materials')

/** Mirrors `materials_family_allowed`. A value not in this list is refused by the database. */
const FAMILIES = ['resin', 'timber', 'metal', 'stone', 'finish'] as const

export default async function Page() {
  const session = await requirePermission('catalog.read')
  const materials = await listMaterialsForStudio(await createClient())
  const canWrite = roleHasPermission(session.role, 'catalog.write')

  return (
    <StudioPage path="/studio/catalog/materials">
      <Stack gap={8}>
        <DataTable<Material>
          caption={t('studio.catalog.materials.caption')}
          rows={materials}
          rowKey={(material) => material.id}
          empty={{
            reason: 'empty',
            heading: t('studio.catalog.materials.emptyHeading'),
            body: t('studio.catalog.materials.emptyBody'),
          }}
          columns={[
            {
              id: 'name',
              header: t('studio.catalog.materials.colName'),
              cell: (material) => material.name,
            },
            {
              id: 'slug',
              header: t('studio.catalog.materials.colSlug'),
              cell: (material) => material.slug,
            },
            {
              id: 'family',
              header: t('studio.catalog.materials.colFamily'),
              cell: (material) => material.family,
            },
            {
              id: 'status',
              header: t('studio.catalog.materials.colStatus'),
              cell: (material) => <StatusPill status={material.status} />,
            },
          ]}
        />

        {canWrite ? (
          <>
            <Divider />
            <PageHeader level={2} title={t('studio.catalog.materials.newHeading')} />
            <EntityForm
              id={null}
              action={saveMaterialAction}
              submitLabelKey="studio.catalog.material.save"
              canWrite
              fields={[
                { name: 'name', labelKey: 'studio.catalog.material.name', required: true },
                { name: 'slug', labelKey: 'studio.catalog.material.slug', required: true },
                {
                  name: 'family',
                  labelKey: 'studio.catalog.material.family',
                  kind: 'select',
                  required: true,
                  options: FAMILIES.map((family) => ({ value: family, label: family })),
                },
                {
                  name: 'description',
                  labelKey: 'studio.catalog.material.description',
                  kind: 'textarea',
                  rows: 4,
                },
              ]}
            />
          </>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
