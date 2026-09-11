import { Divider } from '@/components/primitives/Divider'
import { Stack } from '@/components/primitives/Stack'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import { roleHasPermission, type Role } from '@/lib/auth/permissions'
import { deriveEntitySeo, resolveSeo } from '@/lib/seo/resolve'
import { getGlobalSeoEntry, getSeoEntryByPath } from '@/lib/supabase/repositories/cms'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { getSeoEntryForEntity, type SeoEntityType } from '@/lib/supabase/repositories/seo'
import { listGlobalContent } from '@/lib/supabase/repositories/cms'
import { createClient } from '@/lib/supabase/server'

import {
  deleteSeoEntryAction,
  saveSeoEntryAction,
  setSeoEntryStatusAction,
} from '@/app/(studio)/studio/(shell)/content/seo/actions'

import { SeoEntryForm } from './SeoEntryForm'

/**
 * RC-353 `EntitySeoPanel` — the SEO section on the product, collection, project and article
 * editors: the ENTITY-scope `seo_entries` row for this one thing, with the ladder's current answer
 * beside every field.
 *
 * IT SITS BESIDE THE EDITOR'S OWN FORM, NEVER INSIDE IT. A form cannot nest a form, and this one
 * posts to the SEO workspace's action rather than the editor's, so the entity's own save and its
 * SEO save stay two audited acts under two permissions (`catalog.write` or `content.write` for
 * the row, `seo.write` for its metadata).
 */
export async function EntitySeoPanel({
  entityType,
  entityId,
  entityPath,
  name,
  summary,
  ownTitle,
  ownDescription,
  role,
}: {
  readonly entityType: SeoEntityType
  readonly entityId: string
  readonly entityPath: string
  readonly name: string | null
  readonly summary: string | null
  /** The entity's own SEO columns, where the table has them (products, categories). */
  readonly ownTitle?: string | null
  readonly ownDescription?: string | null
  readonly role: Role
}) {
  const client = await createClient()
  const [entry, pathEntry, global, strings, media] = await Promise.all([
    getSeoEntryForEntity(client, entityType, entityId),
    getSeoEntryByPath(client, entityPath),
    getGlobalSeoEntry(client),
    listGlobalContent(client, 'SEO_DEFAULT'),
    listMediaAssets(client, { kind: 'IMAGE', limit: 200 }),
  ])
  const resolved = resolveSeo({
    entity: entry,
    entityOwn: { title: ownTitle ?? null, description: ownDescription ?? null },
    path: pathEntry,
    derived: deriveEntitySeo({ name, summary }),
    global,
  })
  const template = strings.find((row) => row.key === 'title_template')?.value ?? null

  return (
    <Stack gap={3} data-entity-seo-panel={entityType}>
      <Divider />
      <PageHeader
        level={2}
        title={t('studio.seo.entityPanel.heading')}
        description={t('studio.seo.entityPanel.body')}
      />
      <SeoEntryForm
        target={{ scope: 'ENTITY', entityType, entityId }}
        entityPath={entityPath}
        entry={entry}
        resolved={resolved}
        template={template}
        mediaOptions={media.map((asset) => ({
          value: asset.id,
          label: asset.title ?? asset.public_id,
        }))}
        saveAction={saveSeoEntryAction}
        statusAction={setSeoEntryStatusAction}
        deleteAction={deleteSeoEntryAction}
        canWrite={roleHasPermission(role, 'seo.write')}
        canPublish={roleHasPermission(role, 'content.publish')}
        canDelete={roleHasPermission(role, 'destructive.execute')}
      />
    </Stack>
  )
}
