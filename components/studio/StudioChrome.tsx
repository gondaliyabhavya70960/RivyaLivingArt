'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { Drawer } from '@/components/patterns/Drawer'
import { IconButton } from '@/components/primitives/IconButton'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { STUDIO_COMMAND_OPEN_EVENT } from '@/components/studio/command/CommandPalette'
import { cn } from '@/lib/ui/cn'

/**
 * ONE FILE, THREE CONTROLS, AND ONE ISLAND — and the last part is why they share a file.
 *
 * `scripts/site/check-island-budget.mjs` counts a `'use client'` MODULE as an island when a Server
 * Component imports it; a client module imported by another client module is part of that island's
 * bundle rather than a boundary of its own. These three began as three files, the shell and the top
 * bar imported them separately, and two Studio routes went from six islands to nine against a
 * budget of eight. Nothing about the shipped JavaScript needed to change — only how many boundaries
 * the server opens into it.
 *
 * So they are one module: the sidebar's link list, the drawer that carries it on a phone, and the
 * search control. They are the interactive parts of the Studio chrome and nothing else, which makes
 * the grouping honest rather than a trick to satisfy a counter. Anything that is not chrome does
 * not belong here.
 */

/**
 * The Studio sidebar's link list, and the one part of the shell that knows which page you are on.
 *
 * WHY THIS IS A CLIENT COMPONENT WHEN `StudioShell` IS NOT. The shell stays a Server Component
 * because the route map depends on the session role, and rendering the whole tree on the client
 * would ship every leaf to every browser. The ACTIVE state needs the current pathname, which no
 * server component in this tree has: a layout does not receive one, and nothing in `proxy.ts`
 * publishes it as a header today. The implementation guide names both options and puts a "small
 * client wrapper only around the link list" second to `headers()`; this is that wrapper, and it is
 * deliberately the smallest thing that could work.
 *
 * IT CARRIES NO MANIFEST. Every label is resolved by `t()` on the server and arrives here already a
 * string, so the string map stays server-side — which is the same reason `StudioShell` passes the
 * palette its labels rather than importing `t` into it. And the hrefs it receives are exactly the
 * ones it renders, which the browser was going to be given anyway as `href` attributes. Nothing
 * crosses the boundary that was not already crossing it.
 *
 * THE LONGEST-PREFIX RULE, OVER THE RENDERED SET. `leafForPath` in the manifest picks the longest
 * matching leaf so `/studio/catalog/products/some-id` resolves to the products leaf rather than to
 * `/studio`. The same rule is applied here, over the links actually rendered rather than over the
 * whole manifest — importing `STUDIO_LEAVES` would pull the map into the client bundle and undo
 * the paragraph above. It differs in exactly one way, and `activeHrefFor` below says why: the home
 * leaf matches exactly rather than as a prefix, because over a PARTIAL set `/studio` would
 * otherwise win on any route whose own leaf this role cannot see.
 */

export type StudioNavLinkData = {
  readonly href: string
  /** Already resolved through `t()` on the server. */
  readonly label: string
}

export type StudioNavGroupData = {
  readonly id: string
  readonly label: string
  readonly leaves: readonly StudioNavLinkData[]
}

export type StudioNavProps = {
  readonly home: StudioNavLinkData
  readonly pinned: readonly StudioNavLinkData[]
  readonly pinnedHeading: string
  readonly groups: readonly StudioNavGroupData[]
  /** Called after a link is followed, so the mobile drawer can close itself. */
  readonly onNavigate?: () => void
}

/**
 * The rule `leafForPath` uses, applied to the hrefs this component was given.
 *
 * `homeHref` MATCHES EXACTLY AND NEVER AS A PREFIX, which is the one place this deliberately
 * differs from the manifest's version, and a test is what forced the question. `/studio` is a
 * prefix of every route in the application, so under a plain longest-prefix rule it wins whenever
 * no longer leaf is rendered — and then Overview is marked current while you are standing on
 * `/studio/operations/audit`. In the manifest that case cannot arise, because every leaf is in the
 * set and a longer one always matches; here the set is only what this role can see.
 *
 * A confident wrong answer is worse than no answer: a reader who sees Overview lit learns the
 * indicator cannot be trusted, which costs more than the indicator was worth. So an unknown route
 * marks nothing, and that is the honest output.
 */
function activeHrefFor(
  pathname: string,
  hrefs: readonly string[],
  homeHref: string,
): string | null {
  let best: string | null = null
  for (const href of hrefs) {
    const matches =
      href === homeHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
    if (!matches) continue
    if (best === null || href.length > best.length) best = href
  }
  return best
}

function NavRow({
  link,
  active,
  onNavigate,
  tone,
}: {
  link: StudioNavLinkData
  active: boolean
  onNavigate?: () => void
  tone: 'primary' | 'secondary'
}) {
  return (
    <Link
      href={link.href as Route}
      onClick={onNavigate}
      /*
       * `aria-current="page"` IS THE ACTUAL FIX. The gold rule is how a sighted person sees where
       * they are; this is how everyone else does, and before Phase A nothing in the sidebar carried
       * it — only the Overview tabs did. A screen-reader user had to read the page's `h1` to learn
       * their position in a fifty-leaf tree.
       */
      aria-current={active ? 'page' : undefined}
      className={cn(
        /*
         * 44px ROWS, because this list is the whole navigation on a phone and §9 of the guide puts
         * the floor at 44×44. `flex items-center` centres the label in the taller row; the rows
         * stack with a small gap, so sizing the row itself is right where an `rv-hit-44` overlay
         * would reach into its neighbours.
         */
        'flex min-h-11 items-center rounded-sm border-l-2 px-2',
        'transition-colors duration-(--rv-duration-fast) ease-standard motion-reduce:transition-none',
        active
          ? // The one accent, on the one active item — the reference's rule, in this repo's token.
            'border-(--rv-ink-accent) bg-surface'
          : 'border-transparent hover:bg-surface',
      )}
    >
      <Text size="sm" tone={active ? undefined : tone === 'primary' ? undefined : 'secondary'}>
        {link.label}
      </Text>
    </Link>
  )
}

export function StudioNav({
  home,
  pinned,
  pinnedHeading,
  groups,
  onNavigate,
}: StudioNavProps): React.ReactElement {
  const pathname = usePathname()

  const hrefs = React.useMemo(
    () => [
      home.href,
      ...pinned.map((l) => l.href),
      ...groups.flatMap((g) => g.leaves.map((l) => l.href)),
    ],
    [home.href, pinned, groups],
  )
  const active = activeHrefFor(pathname, hrefs, home.href)

  return (
    <Stack as="ul" gap={5} className="list-none p-0">
      <li>
        <NavRow link={home} active={active === home.href} onNavigate={onNavigate} tone="primary" />
      </li>

      {pinned.length > 0 && (
        <li>
          <Stack gap={2}>
            <Text size="2xs" uppercase tone="tertiary">
              {pinnedHeading}
            </Text>
            <Stack as="ul" gap={1} className="list-none p-0">
              {pinned.map((leaf) => (
                <li key={`pinned:${leaf.href}`}>
                  <NavRow
                    link={leaf}
                    active={active === leaf.href}
                    onNavigate={onNavigate}
                    tone="secondary"
                  />
                </li>
              ))}
            </Stack>
          </Stack>
        </li>
      )}

      {groups.map((group) => (
        <li key={group.id}>
          <Stack gap={2}>
            {/* `uppercase` is required by the Text primitive at 2xs, not decoration: DESIGN_SYSTEM
                §3.3 permits 11px only for uppercase eyebrow text, and the prop is typed so the
                pairing cannot be separated. */}
            <Text size="2xs" uppercase tone="tertiary">
              {group.label}
            </Text>
            <Stack as="ul" gap={1} className="list-none p-0">
              {group.leaves.map((leaf) => (
                <li key={leaf.href}>
                  <NavRow
                    link={leaf}
                    active={active === leaf.href}
                    onNavigate={onNavigate}
                    tone="secondary"
                  />
                </li>
              ))}
            </Stack>
          </Stack>
        </li>
      ))}
    </Stack>
  )
}

/**
 * The Studio navigation on a phone: a labelled dialog, not a wall of links above the page.
 *
 * WHAT IT REPLACES. Below `lg` the sidebar was a full-width `border-b` stack rendered ABOVE the
 * main landmark — eight groups and fifty-odd leaves of it. On the owner's 1440×3088 Android
 * viewport that is a very long scroll before the first word of the page they opened, on every
 * navigation. §3.7 of the implementation guide calls this out; the exit criterion for Phase A is
 * reaching Products in two taps, and this is the component that makes it two.
 *
 * IT COMPOSES `patterns/Drawer`, so the focus trap, Escape, scroll lock and focus restoration are
 * the ones Phase 02 built and tested rather than a second implementation of each. `returnFocusTo`
 * is the trigger, which survives the drawer here — passing it anyway is the RC-031 habit and costs
 * nothing.
 *
 * CLOSED MEANS ABSENT, which is the rule the server shell already follows for a collapsed sidebar:
 * `Drawer` renders nothing at all when `open` is false, so there is no `display:none` landmark
 * left in the accessibility tree offering navigation the person has put away.
 *
 * IT CLOSES ON NAVIGATION. Without `onNavigate` the drawer stays open over the page it just went
 * to, which reads as a tap that did nothing — the link has navigated, but the dialog is still the
 * only thing on screen.
 *
 * THE TRIGGER IS `lg:hidden` AT THE CALL SITE, not here: whether a phone gets this and a desktop
 * gets the rail is the shell's layout decision, and a component that hides itself is harder to
 * place than one that is placed.
 */

/** A hamburger. Three lines, `currentColor`, no icon package — the house has none and adds none. */
const MenuGlyph = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="size-5">
    <path
      d="M4 7h16M4 12h16M4 17h16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

export function StudioMobileNav({
  openLabel,
  closeLabel,
  title,
  className,
  ...nav
}: StudioNavProps & {
  /** Accessible name of the trigger. An icon has no text to fall back on. */
  readonly openLabel: string
  readonly closeLabel: string
  /** The dialog's accessible name. Kept in the tree, off the screen. */
  readonly title: string
  readonly className?: string
}): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  return (
    <>
      <IconButton
        ref={triggerRef}
        type="button"
        aria-label={openLabel}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={className}
      >
        {MenuGlyph}
      </IconButton>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        title={title}
        /*
         * The panel is a list of destinations that names itself, so a visible heading above it is a
         * caption on a caption. Hidden, never dropped: `aria-modal` with no accessible name gives a
         * screen-reader user a dialog called nothing.
         */
        titleHidden
        closeLabel={closeLabel}
        returnFocusTo={triggerRef}
      >
        <StudioNav {...nav} onNavigate={() => setOpen(false)} />
      </Drawer>
    </>
  )
}

/**
 * Search, as a control you can tap.
 *
 * WHAT THIS REPLACES, AND WHY IT WAS A REAL DEFECT. The top bar used to render the sentence
 * "Press Ctrl-K or Cmd-K to search" as inert text, with a comment explaining that it was not a
 * button because "a button that says press ⌘K would be a control that does nothing when clicked".
 * The reasoning was sound and the conclusion was wrong for the owner's device: an Android phone has
 * neither key, so Studio's only search had no entry point at all on the machine it is used from.
 * The fix is not to delete the hint but to make the thing a control and let the hint describe the
 * shortcut for people who have one.
 *
 * THE HINT IS DESKTOP-ONLY, and by media query rather than by user-agent sniffing. `lg:inline`
 * shows "⌘K" where a keyboard is overwhelmingly likely and hides it where it would be a lie. It is
 * inside the button, so it never becomes a second tap target.
 *
 * IT DISPATCHES, IT DOES NOT SIMULATE. `STUDIO_COMMAND_OPEN_EVENT` is the palette's own contract.
 * Faking a `KeyboardEvent` would have worked today and tied this button to the shortcut's shape, so
 * that changing ⌘K later would break a control that does not mention it.
 *
 * `min-h-11` IS THE ROW, NOT AN OVERLAY. §9 of the implementation guide puts every Studio target at
 * 44×44; this control sits in a wrapping flex row beside other controls, where an `rv-hit-44`
 * overlay would reach into its neighbours.
 */
export function StudioSearchButton({
  label,
  shortcutHint,
  className,
}: {
  /** The accessible name and visible text. Resolved by `t()` on the server. */
  readonly label: string
  /** The keyboard shortcut, shown at `lg` and above only. */
  readonly shortcutHint: string
  readonly className?: string
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new Event(STUDIO_COMMAND_OPEN_EVENT))
      }}
      className={cn(
        'border-line bg-surface flex min-h-11 items-center gap-2 rounded-sm border px-3',
        'transition-colors duration-(--rv-duration-fast) ease-standard motion-reduce:transition-none',
        'hover:border-(--rv-ink-accent)',
        className,
      )}
    >
      <Text as="span" size="xs">
        {label}
      </Text>
      {/*
       * `xs`, NOT `2xs`. The Text primitive types 11px as requiring `uppercase`, because
       * DESIGN_SYSTEM §3.3 permits that size only for uppercase eyebrow text — and the pairing is
       * enforced in the type so it cannot be separated. A shortcut hint is neither an eyebrow nor
       * something to shout, so it takes the next size up rather than an exemption.
       */}
      <Text as="span" size="xs" tone="tertiary" className="hidden lg:inline">
        {shortcutHint}
      </Text>
    </button>
  )
}
