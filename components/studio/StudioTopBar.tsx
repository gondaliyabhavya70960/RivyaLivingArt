import { collapseSidebarAction } from '@/app/(studio)/studio/(shell)/actions'
import { Badge } from '@/components/primitives/Badge'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { StaffSession } from '@/lib/auth/session'

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
}: {
  session: StaffSession
  sidebarCollapsed: boolean
}) {
  const environment = environmentLabel()

  return (
    <div className="border-line bg-surface-raised flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* A form, not a button with a handler: this renders on the server, and a plain form means
            the control works before hydration and with JavaScript off. The NEXT state is submitted
            rather than a toggle, so two fast clicks converge instead of racing. */}
        <form action={collapseSidebarAction}>
          <input type="hidden" name="collapsed" value={sidebarCollapsed ? 'false' : 'true'} />
          <button type="submit" className="rounded-sm underline underline-offset-4">
            <Text as="span" size="xs">
              {sidebarCollapsed
                ? t('studio.shell.expandSidebar')
                : t('studio.shell.collapseSidebar')}
            </Text>
          </button>
        </form>

        {/* A visible affordance for ⌘K. A keyboard shortcut nobody is told about is a shortcut
            only its author uses; this is not a button because the palette is opened by the
            shortcut, and a button that says "press ⌘K" would be a control that does nothing when
            clicked. */}
        <Text size="xs" tone="tertiary">
          {t('studio.shell.searchHint')}
        </Text>
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
          <button type="submit" className="rounded-sm underline underline-offset-4">
            <Text as="span" size="xs">
              {t('studio.shell.signOut')}
            </Text>
          </button>
        </form>
      </div>
    </div>
  )
}
