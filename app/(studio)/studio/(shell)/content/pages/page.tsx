import type { Route } from 'next'
import Link from 'next/link'

import { DataTable } from '@/components/studio/DataTable'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listPages } from '@/lib/supabase/repositories/cms'
import { createClient } from '@/lib/supabase/server'
import type { Page as CmsPage } from '@/lib/supabase/schemas'

/**
 * /studio/content/pages — every page on the site.
 *
 * READS THROUGH THE REQUEST-SCOPED CLIENT, so the list is exactly what this editor's role is
 * allowed to see. The service role would return the same rows today and would stop being a
 * meaningful check the moment a policy narrows.
 *
 * A SYSTEM PAGE HAS NO PATH and says so rather than showing a blank cell. `pages.path` is nullable
 * precisely so the reserved `slug = 'global'` row cannot be served to a visitor — an empty cell
 * would read as missing data rather than as a deliberate absence.
 */
export const metadata = studioMetadata('/studio/content/pages')

export default async function Page() {
  await requirePermission('content.read')

  const pages = await listPages(await createClient())

  return (
    <StudioPage path="/studio/content/pages">
      <DataTable<CmsPage>
        caption={t('studio.content.pages.caption')}
        rows={pages}
        rowKey={(page) => page.id}
        empty={{
          reason: 'empty',
          heading: t('studio.content.pages.emptyHeading'),
          body: t('studio.content.pages.emptyBody'),
        }}
        columns={[
          {
            id: 'title',
            header: t('studio.content.pages.colTitle'),
            cell: (page) => (
              <Link
                href={`/studio/content/pages/${page.id}` as Route}
                className="underline underline-offset-4"
              >
                {page.title}
              </Link>
            ),
          },
          {
            id: 'path',
            header: t('studio.content.pages.colPath'),
            cell: (page) => page.path ?? t('studio.content.pages.systemPath'),
          },
          {
            id: 'kind',
            header: t('studio.content.pages.colKind'),
            cell: (page) => page.kind,
          },
          {
            id: 'status',
            header: t('studio.content.pages.colStatus'),
            cell: (page) => <StatusPill status={page.status} />,
          },
          {
            id: 'updated',
            header: t('studio.content.pages.colUpdated'),
            cell: (page) => <RelativeTime value={page.updated_at} />,
          },
        ]}
      />
    </StudioPage>
  )
}
