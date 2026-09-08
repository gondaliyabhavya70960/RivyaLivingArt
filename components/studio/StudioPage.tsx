import { togglePinnedRouteAction } from '@/app/(studio)/studio/(shell)/actions'
import { Breadcrumbs } from '@/components/primitives/Breadcrumbs'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { readMyChrome } from '@/lib/auth/preferences'
import { groupForPath, leafForPath, type StudioNavLeaf } from '@/lib/auth/studio-nav'

/**
 * The frame every Studio surface renders inside: breadcrumb, heading, actions, body.
 *
 * IT TAKES A PATH, NOT A TITLE. The heading and the trail are read from the navigation manifest, so
 * a page cannot disagree with the sidebar about what it is called — which is the drift that makes
 * an interface feel untrustworthy, and which no test would catch because both would be "correct".
 * A page that wants a different title is a page that should change the manifest.
 *
 * IT IS NOT A PERMISSION GATE. It renders; it does not decide. The page's own
 * `requirePermission()` call, in its body, before this is reached, is the decision. Putting the
 * check in here would be quietly convenient and quietly wrong: a component that renders nothing is
 * indistinguishable from one that was never called, so a page that forgot to gate would look
 * identical to one that gated correctly.
 */
export async function StudioPage({
  path,
  actions,
  children,
}: {
  /** The route this page serves. Must be a leaf in lib/auth/studio-nav.ts. */
  path: string
  /** Buttons for the surface's own operations, aligned with the heading. */
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const leaf = leafForPath(path)
  const group = groupForPath(path)
  const chrome = await readMyChrome()

  // Unreachable through the generated routes, which are produced FROM the manifest. Reachable if
  // somebody hand-writes a page under /studio without adding it — and then the honest thing is a
  // heading saying so, not a crash and not a blank frame that looks deliberate.
  if (leaf === null) {
    return (
      <Stack gap={2}>
        <Heading level={1} size="display-md">
          {path}
        </Heading>
        <Text tone="secondary">{t('studio.stub.unregisteredRoute')}</Text>
      </Stack>
    )
  }

  return (
    <Stack gap={6}>
      {/* Overview → this page. The GROUP is deliberately not a crumb: `/studio/catalog` is not a
          route, so a crumb for it would either be a dead label or a link to a 404, and Phase 39's
          BreadcrumbList needs a real URL for every position. The group name is visible in the
          sidebar, which is where it belongs. */}
      {group !== null && (
        <Breadcrumbs
          aria-label={t('studio.shell.breadcrumbLabel')}
          items={[
            { label: t('studio.nav.overview'), href: '/studio' },
            { label: t(leaf.labelKey), href: leaf.href },
          ]}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <Heading level={1} size="display-md">
          {t(leaf.labelKey)}
        </Heading>
        <div className="flex flex-wrap items-center gap-3">
          {actions}
          {/* A form rather than a button with a handler, for the same reason as the collapse
              control: this page is server-rendered, and a form works before hydration. The action
              re-validates the path against the manifest — a hidden field is whatever the client
              chose to send. */}
          <form action={togglePinnedRouteAction}>
            <input type="hidden" name="path" value={leaf.href} />
            <button type="submit" className="rounded-sm underline underline-offset-4">
              <Text as="span" size="xs" tone="tertiary">
                {chrome.pinned_routes.includes(leaf.href)
                  ? t('studio.page.unpin')
                  : t('studio.page.pin')}
              </Text>
            </button>
          </form>
        </div>
      </div>

      {children ?? <StubNotice leaf={leaf} />}
    </Stack>
  )
}

/**
 * What a route with no implementation shows.
 *
 * It names the phase that will build the surface. That is deliberate and it is not filler: "Coming
 * Soon" is forbidden by SEED §55 because it promises a date nobody has set, whereas a phase number
 * is a checkable fact about this project that a reader can look up in the roadmap. The page also
 * states plainly that nothing reads or writes here, so an owner does not mistake an empty table for
 * "we have no products".
 */
function StubNotice({ leaf }: { leaf: StudioNavLeaf }) {
  const phase = leaf.phases[0]

  return (
    <Surface level={1} className="p-6">
      <Stack gap={2}>
        <Heading level={2} size="display-xs">
          {t('studio.stub.heading')}
        </Heading>
        <Text tone="secondary">{t('studio.stub.body')}</Text>
        {phase !== undefined && (
          <Text size="sm" tone="tertiary">
            {t('studio.stub.owningPhase')} {String(phase).padStart(2, '0')}
          </Text>
        )}
      </Stack>
    </Surface>
  )
}

/**
 * The browser-tab title for a Studio route, read from the manifest.
 *
 * Exported so each route's `metadata` is one line that cannot drift from its heading. A hand-typed
 * title is the same duplication as a hand-typed heading, and worse for being invisible on screen.
 */
export function studioMetadata(path: string): { title: string } {
  const leaf = leafForPath(path)
  const product = t('studio.shell.productName')
  return { title: leaf === null ? product : `${t(leaf.labelKey)} · ${product}` }
}
