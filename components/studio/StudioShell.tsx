import type { Route } from 'next'
import Link from 'next/link'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { StudioTopBar } from '@/components/studio/StudioTopBar'
import { CommandPalette } from '@/components/studio/command/CommandPalette'
import { t } from '@/components/studio/strings'
import { visibleNav } from '@/lib/auth/nav-visibility'
import { roleHasPermission } from '@/lib/auth/permissions'
import { readMyChrome } from '@/lib/auth/preferences'
import type { StaffSession } from '@/lib/auth/session'
import { STUDIO_HOME_LEAF, STUDIO_LEAVES } from '@/lib/auth/studio-nav'

/**
 * The Studio chrome: skip link, sidebar, main landmark.
 *
 * A SERVER COMPONENT. The navigation depends on the session role, which is a server fact; rendering
 * the whole tree and hiding parts on the client would ship the full route map to every browser and
 * flash links a role cannot use. There is no interactivity here yet — the sidebar is links.
 *
 * THE SIDEBAR SHOWS WHAT THE ROLE MAY OPEN, and that set is computed from the same manifest the
 * pages gate on, so a link that appears leads somewhere that will render. The converse matters more:
 * nothing is hidden that the role could still reach by typing the URL, because hiding a reachable
 * link is worse than showing a read-only one — it teaches people the interface is lying.
 */
export async function StudioShell({
  session,
  children,
}: {
  session: StaffSession
  children: React.ReactNode
}) {
  const groups = visibleNav(session.role)
  const chrome = await readMyChrome()

  // Only pins the role can still open. A permission can be revoked after a route was pinned, and a
  // pinned link that refuses is worse than no pin — it is a permanent reminder of something the
  // person cannot do, in the part of the interface meant to be their own shortcuts.
  const pinned = chrome.pinned_routes
    .map((href) => STUDIO_LEAVES.find((leaf) => leaf.href === href))
    .filter((leaf): leaf is (typeof STUDIO_LEAVES)[number] => leaf !== undefined)
    .filter((leaf) => roleHasPermission(session.role, leaf.permission))

  /**
   * `typedRoutes` wants a literal it can check against the app directory; the manifest holds
   * strings. The cast is safe for a reason that is checked rather than assumed: every route under
   * `/studio` is GENERATED from this same manifest, and `tests/unit/studio-nav.test.ts` fails if
   * any manifest href lacks a `page.tsx` on disk. So the guarantee typedRoutes gives at compile
   * time is given here by a test — which is also the only place it could be given, since a route
   * map that is data cannot be a union of literals.
   */
  const route = (href: string) => href as Route

  return (
    <div className="flex min-h-screen flex-col">
      {/* Copy is resolved HERE and passed down: the palette is a Client Component, and `t()` reads
          the server-side string map that Phase 09 will back with `global_content`. Importing `t`
          into a client bundle would ship the whole map to the browser and break that swap. */}
      <CommandPalette
        labels={{
          label: t('studio.command.label'),
          placeholder: t('studio.command.placeholder'),
          noResults: t('studio.command.noResults'),
          incomplete: t('studio.command.incomplete'),
          close: t('studio.command.close'),
        }}
      />

      {/* First focusable element on the page. Without it a keyboard user tabs through every
          sidebar link on every navigation before reaching the content they asked for. */}
      <a
        href="#studio-main"
        // No focus ring classes: app/styles/base.css already styles :focus-visible globally, and
        // `ring-focus` is not a defined utility — Tailwind emits nothing for an undefined name, so
        // the link would have looked styled and had no ring at all. check-utilities caught it.
        className="bg-surface text-ink sr-only rounded-sm px-4 py-2 focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50"
      >
        {t('studio.shell.skipToContent')}
      </a>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Removed from the tree when collapsed, not hidden with CSS: a `display:none` landmark
            is still announced by some assistive technology, offering navigation the person has
            deliberately put away. The control to bring it back is in the top bar, which stays. */}
        {!chrome.sidebar_collapsed && (
          <nav
            aria-label={t('studio.shell.primaryNavLabel')}
            className="border-line bg-surface-raised shrink-0 border-b lg:w-64 lg:border-r lg:border-b-0"
          >
            <Stack gap={6} className="p-4">
              <Stack gap={1}>
                <Link href={route(STUDIO_HOME_LEAF.href)} className="rounded-sm">
                  <Heading level={2} size="display-xs">
                    {t('studio.shell.productName')}
                  </Heading>
                </Link>
              </Stack>

              <Stack as="ul" gap={5} className="list-none p-0">
                <li>
                  <Link href={route(STUDIO_HOME_LEAF.href)} className="rounded-sm">
                    <Text size="sm">{t(STUDIO_HOME_LEAF.labelKey)}</Text>
                  </Link>
                </li>

                {pinned.length > 0 && (
                  <li>
                    <Stack gap={2}>
                      <Text size="2xs" uppercase tone="tertiary">
                        {t('studio.shell.pinnedHeading')}
                      </Text>
                      <Stack as="ul" gap={1} className="list-none p-0">
                        {pinned.map((leaf) => (
                          <li key={`pinned:${leaf.href}`}>
                            <Link href={route(leaf.href)} className="rounded-sm">
                              <Text size="sm" tone="secondary">
                                {t(leaf.labelKey)}
                              </Text>
                            </Link>
                          </li>
                        ))}
                      </Stack>
                    </Stack>
                  </li>
                )}

                {groups.map((group) => (
                  <li key={group.id}>
                    <Stack gap={2}>
                      {/* `uppercase` is required by the Text primitive at 2xs, not decoration:
                        DESIGN_SYSTEM §3.3 permits 11px only for uppercase eyebrow text, and the
                        prop is typed so the pairing cannot be separated. */}
                      <Text size="2xs" uppercase tone="tertiary">
                        {t(group.labelKey)}
                      </Text>
                      <Stack as="ul" gap={1} className="list-none p-0">
                        {group.leaves.map((leaf) => (
                          <li key={leaf.href}>
                            <Link href={route(leaf.href)} className="rounded-sm">
                              <Text size="sm" tone="secondary">
                                {t(leaf.labelKey)}
                              </Text>
                            </Link>
                          </li>
                        ))}
                      </Stack>
                    </Stack>
                  </li>
                ))}
              </Stack>
            </Stack>
          </nav>
        )}

        {/* The top bar sits INSIDE the content column, not above both, so it aligns with the
            content rather than spanning the sidebar — and so the sidebar reaches the full height of
            the page on desktop. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <StudioTopBar session={session} sidebarCollapsed={chrome.sidebar_collapsed} />

          {/* The PAGE supplies the h1, through StudioPage. A heading here as well would give every
              Studio surface two h1s, and a screen-reader user navigating by heading would land on
              the product name rather than on what they opened. */}
          <main id="studio-main" className="min-w-0 flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
