import type { Route } from 'next'
import Link from 'next/link'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { visibleNav } from '@/lib/auth/nav-visibility'
import type { StaffSession } from '@/lib/auth/session'
import { STUDIO_HOME_LEAF } from '@/lib/auth/studio-nav'

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
export function StudioShell({
  session,
  children,
}: {
  session: StaffSession
  children: React.ReactNode
}) {
  const groups = visibleNav(session.role)

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
              {/* The role is chrome, not a claim: it tells someone why a link is missing before
                  they conclude the Studio is broken. */}
              <Text size="xs" tone="tertiary">
                {session.displayName ?? session.email ?? t('studio.shell.unnamedAccount')} ·{' '}
                {session.role}
              </Text>
            </Stack>

            <Stack as="ul" gap={5} className="list-none p-0">
              <li>
                <Link href={route(STUDIO_HOME_LEAF.href)} className="rounded-sm">
                  <Text size="sm">{t(STUDIO_HOME_LEAF.labelKey)}</Text>
                </Link>
              </li>

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

            <form action="/api/auth/sign-out" method="post">
              <button type="submit" className="rounded-sm">
                <Text size="sm" tone="secondary">
                  {t('studio.shell.signOut')}
                </Text>
              </button>
            </form>
          </Stack>
        </nav>

        {/* The PAGE supplies the h1, through StudioPage. A heading here as well would give every
            Studio surface two h1s, and a screen-reader user navigating by heading would land on the
            product name rather than on what they opened. */}
        <main id="studio-main" className="min-w-0 flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
