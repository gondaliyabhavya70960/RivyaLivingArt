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
 *
 * THE "ON SITE" COLUMN IS PHASE 10's, and it answers the question an editor actually has after
 * making a change: what does this look like to a visitor? A published page links straight to its
 * path; an unpublished one goes through `/api/preview`, which checks `content.read` and turns
 * draft mode on before forwarding. Without the second case the link would be useless on exactly
 * the pages someone is working on, because every seeded section starts DRAFT and the public route
 * answers 404 until an editor publishes it.
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
          {
            id: 'on-site',
            header: t('studio.content.pages.colOnSite'),
            cell: (page) =>
              page.path === null ? null : page.status === 'PUBLISHED' ? (
                <Link href={page.path as Route} className="underline underline-offset-4">
                  {t('studio.content.pages.viewLive')}
                </Link>
              ) : (
                /**
                 * A PLAIN ANCHOR, NOT `Link`. `/api/preview` is a Route Handler whose whole effect
                 * is the `Set-Cookie` on its response — draft mode IS that cookie — and a
                 * client-side navigation never issues the document request that would receive it.
                 * The router would change the URL and the page would show published content, which
                 * on a draft page means a 404. Same reasoning as `components/studio/content/
                 * PageEditor.tsx`, and the same shape.
                 */
                <a
                  href={`/api/preview?path=${encodeURIComponent(page.path)}`}
                  className="underline underline-offset-4"
                >
                  {t('studio.content.pages.viewDraft')}
                </a>
              ),
          },
        ]}
      />
    </StudioPage>
  )
}
