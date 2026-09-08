import { DataTable } from '@/components/studio/DataTable'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { resolveHref, type HrefResolution } from '@/lib/site/href-resolution'
import { listNavigationItems, listPages } from '@/lib/supabase/repositories/cms'
import { createClient } from '@/lib/supabase/server'
import type { NavigationItem } from '@/lib/supabase/schemas'

/**
 * /studio/content/navigation — every menu item, and whether its address goes anywhere.
 *
 * THE RESOLVES COLUMN IS THE POINT OF THIS SCREEN. A menu item pointing at a path with no route is
 * a link that 404s, and nothing about it looks wrong from inside Studio: the item renders, the
 * label is right, and the failure appears only when a visitor clicks it. It is also the one class
 * of mistake the build cannot catch — `href` arrives from the database long after compilation, so
 * `components/patterns/NavLink.tsx` has to cast it past `typedRoutes`. This is the compensating
 * control named in that file, and it belongs here because this is where the href is typed.
 *
 * "RESOLVES" IS CHECKED AGAINST TWO THINGS. `lib/site/routes.ts` holds the thirteen static D3
 * paths — `/search` among them, which deliberately has no `pages` row — and `pages.path` supplies
 * everything the CMS addresses, including the seven CATEGORY pages under `/collection/`. An href
 * matching neither is site-relative and points at nothing.
 *
 * IT READS THROUGH THE REQUEST-SCOPED CLIENT, so an editor sees the rows their role admits. The
 * service role would return the same rows today and would stop being a real check the moment a
 * policy narrows.
 */
export const metadata = studioMetadata('/studio/content/navigation')

/** The four outcomes as words an editor reads. Never the enum value. */
function resolutionLabel(resolution: HrefResolution): string {
  switch (resolution) {
    case 'RESOLVED':
      return t('studio.content.navigation.resolved')
    case 'EXTERNAL':
      return t('studio.content.navigation.external')
    case 'HEADING':
      return t('studio.content.navigation.heading')
    case 'UNKNOWN':
      return t('studio.content.navigation.unknown')
  }
}

export default async function Page() {
  await requirePermission('content.read')

  const client = await createClient()
  const [items, pages] = await Promise.all([listNavigationItems(client), listPages(client)])

  // Every address the CMS can serve. A SYSTEM page has `path = null` and is structurally
  // unreachable from a menu, so it contributes nothing.
  const pagePaths = pages.map((page) => page.path).filter((path): path is string => path !== null)

  return (
    <StudioPage path="/studio/content/navigation">
      <DataTable<NavigationItem>
        caption={t('studio.content.navigation.caption')}
        rows={items}
        rowKey={(item) => item.id}
        empty={{
          reason: 'empty',
          heading: t('studio.content.navigation.emptyHeading'),
          body: t('studio.content.navigation.emptyBody'),
        }}
        columns={[
          {
            id: 'menu',
            header: t('studio.content.navigation.colMenu'),
            cell: (item) => item.menu,
          },
          {
            id: 'label',
            header: t('studio.content.navigation.colLabel'),
            cell: (item) => (
              <>
                {/* A child is indented rather than labelled "child of…": the tree is two levels
                    deep and the indent says so faster than a sentence would. */}
                {item.parent_id === null ? null : <span aria-hidden="true">— </span>}
                {item.label}
                {item.is_visible ? null : (
                  <span className="ml-2 text-xs text-ink-tertiary">
                    {t('studio.content.navigation.hidden')}
                  </span>
                )}
              </>
            ),
          },
          {
            id: 'href',
            header: t('studio.content.navigation.colHref'),
            cell: (item) => <code className="text-xs">{item.href}</code>,
          },
          {
            id: 'resolves',
            header: t('studio.content.navigation.colResolves'),
            cell: (item) => {
              const resolution = resolveHref(item.href, pagePaths)
              return (
                <span
                  className={resolution === 'UNKNOWN' ? 'text-state-danger' : 'text-ink-secondary'}
                >
                  {resolutionLabel(resolution)}
                </span>
              )
            },
          },
          {
            id: 'status',
            header: t('studio.content.navigation.colStatus'),
            cell: (item) => <StatusPill status={item.status} />,
          },
        ]}
      />
    </StudioPage>
  )
}
