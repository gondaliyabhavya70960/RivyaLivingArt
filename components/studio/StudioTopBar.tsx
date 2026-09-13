import { collapseSidebarAction } from '@/app/(studio)/studio/(shell)/actions'
import { Badge } from '@/components/primitives/Badge'
import { Text } from '@/components/primitives/Text'
import {
  StudioMobileNav,
  StudioSearchButton,
  type StudioNavProps,
} from '@/components/studio/StudioChrome'
import { t } from '@/components/studio/strings'
import type { StaffSession } from '@/lib/auth/session'

/**
 * The 44px floor, in one place. §9 of the implementation guide puts every Studio target at 44×44,
 * and the two controls here were `underline underline-offset-4` text — roughly 20px tall on the
 * owner's phone. Sized rather than overlaid: these sit in a wrapping flex row, where an
 * `rv-hit-44` overlay would reach into whatever wrapped beside it.
 */
const TOP_BAR_CONTROL =
  'border-line bg-surface flex min-h-11 items-center rounded-sm border px-3 ' +
  'transition-colors duration-(--rv-duration-fast) ease-standard motion-reduce:transition-none ' +
  'hover:border-(--rv-ink-accent)'

/**
 * The Studio top bar: who you are, where you are deployed, and how to search.
 *
 * THE ENVIRONMENT BADGE IS THE POINT OF THIS COMPONENT. Every other element here is a convenience;
 * this one exists so nobody publishes to production believing they are on preview. It is rendered
 * for every environment EXCEPT production — a badge that is always present is furniture and stops
 * being read, whereas its absence meaning "this is the real site" is a distinction the eye keeps.
 *
 * It names the environment and NOTHING else. `VERCEL_ENV` is a public, three-valued string;
 * anything more — a URL, a commit, a region — starts down the road D8 and Phase 41 forbid, which is
 * a Studio page that displays deployment configuration to whoever is looking at the screen.
 *
 * `NEXT_PUBLIC_VERCEL_ENV` rather than `VERCEL_ENV`: this renders on the server today, but a top
 * bar is the first thing that becomes interactive, and a server-only variable read here would fail
 * at the moment somebody adds a click handler.
 */
function environmentLabel(): string | null {
  /**
   * ONLY THE TWO VALUES WE RECOGNISE render a badge. Everything else — production, an unset
   * variable, an empty string, an unknown value from a host that is not Vercel — renders nothing.
   *
   * The first draft was `env !== 'production' ? … : null` with a ternary picking the word, which
   * meant an ABSENT variable rendered "Development". That is a claim about where this is deployed,
   * derived from the absence of information — the same shape of mistake as a dashboard card
   * rendering `0` for a table that does not exist. A test caught it.
   */
  switch (process.env.NEXT_PUBLIC_VERCEL_ENV) {
    case 'preview':
      return t('studio.shell.envPreview')
    case 'development':
      return t('studio.shell.envDevelopment')
    default:
      return null
  }
}

export function StudioTopBar({
  session,
  sidebarCollapsed,
  nav,
  labels,
}: {
  session: StaffSession
  sidebarCollapsed: boolean
  /** The resolved link list, for the mobile drawer. See `StudioShell`. */
  nav: Omit<StudioNavProps, 'onNavigate'>
  /** Resolved copy for the controls this bar owns. */
  labels: {
    search: string
    searchShortcut: string
    openNav: string
    closeNav: string
    navDialogTitle: string
  }
}) {
  const environment = environmentLabel()

  return (
    /*
     * STICKY — Phase A. On a phone the top bar carries the only way into the navigation and the
     * only way into search, and a bar that scrolls away takes both with it. `z-30` sits under the
     * Drawer's own layer so the open dialog is never underneath the control that opened it.
     */
    <div className="border-line bg-surface-raised sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* The drawer trigger, below `lg` only: above it the rail is always there. */}
        <StudioMobileNav
          {...nav}
          openLabel={labels.openNav}
          closeLabel={labels.closeNav}
          title={labels.navDialogTitle}
          className="lg:hidden"
        />
        {/* A form, not a button with a handler: this renders on the server, and a plain form means
            the control works before hydration and with JavaScript off. The NEXT state is submitted
            rather than a toggle, so two fast clicks converge instead of racing. */}
        <form action={collapseSidebarAction}>
          <input type="hidden" name="collapsed" value={sidebarCollapsed ? 'false' : 'true'} />
          {/* `hidden lg:flex`: this collapses the DESKTOP rail. Below `lg` there is no rail to
              collapse — the navigation is the drawer — so the control would toggle a preference
              with no visible effect. */}
          <button type="submit" className={`${TOP_BAR_CONTROL} hidden lg:flex`}>
            <Text as="span" size="xs">
              {sidebarCollapsed
                ? t('studio.shell.expandSidebar')
                : t('studio.shell.collapseSidebar')}
            </Text>
          </button>
        </form>

        {/*
         * A CONTROL, NOT A SENTENCE — Phase A, and the reasoning it replaces was sound but wrong
         * for the owner's device. This used to read "Press Ctrl-K or Cmd-K to search" as inert
         * text, on the argument that a button saying "press ⌘K" would do nothing when clicked. An
         * Android phone has neither key, so Studio search had NO entry point at all on the machine
         * it is actually used from. The button opens the same palette; the shortcut is now a hint
         * inside it, shown at `lg` and above.
         */}
        <StudioSearchButton label={labels.search} shortcutHint={labels.searchShortcut} />
        {environment !== null && <Badge tone="warning">{environment}</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Text size="xs" tone="tertiary">
          {session.displayName ?? session.email ?? t('studio.shell.unnamedAccount')}
        </Text>
        {/* The role, always visible. It is the answer to "why can I not see that page", and a
            staff member who cannot see their own role has to ask somebody. */}
        <Badge tone="neutral">{session.role}</Badge>
        <form action="/api/auth/sign-out" method="post">
          <button type="submit" className={TOP_BAR_CONTROL}>
            <Text as="span" size="xs">
              {t('studio.shell.signOut')}
            </Text>
          </button>
        </form>
      </div>
    </div>
  )
}
