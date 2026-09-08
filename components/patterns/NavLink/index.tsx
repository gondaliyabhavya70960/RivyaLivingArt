import type { Route } from 'next'
import Link from 'next/link'
import * as React from 'react'

/**
 * One `navigation_items` row as a link.
 *
 * WHY A COMPONENT FOR SOMETHING THIS SMALL. The choice it makes has to be made identically in
 * three places — the header, the mobile drawer and the footer — and getting it wrong is invisible
 * in each of them:
 *
 *   * An internal destination must be a `next/link`, or every click on the menu is a full document
 *     load. The page still appears, so nothing looks broken; the site is just slow in a way that
 *     only shows up in a trace. `@next/next/no-html-link-for-pages` catches the literal `/` case
 *     and nothing else, because every other href here comes out of the database.
 *   * An external destination must NOT be a `next/link` — the router would try to prefetch and
 *     client-navigate a URL it does not own — and it must carry `rel="noopener noreferrer"` when
 *     it opens a new tab, or the opened page gets a handle on `window.opener`.
 *
 * THE DECISION IS THE HREF'S SHAPE, NOT THE `target` COLUMN. An editor can set `_blank` on an
 * internal page, and a link to another site with `_self` is still a link to another site. `//host`
 * is treated as external precisely because it looks relative and is not.
 *
 * NO DEFAULT STYLING. It renders whatever `className` it is given, so the three call sites keep
 * their own treatment and this file never becomes a place where menu appearance is decided.
 */

export type NavLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  readonly href: string
  /** The row's `target` column: `_self` or `_blank`. */
  readonly target?: string
}

/** Site-relative: one leading slash, and not `//`, which a browser reads as a protocol-relative host. */
export function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

export function NavLink({ href, target, children, ...rest }: NavLinkProps): React.ReactElement {
  const newTab = target === '_blank'
  const shared = {
    ...rest,
    ...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
  }

  if (isInternalHref(href) && !newTab) {
    return (
      /*
       * `as Route` — the one cast in this file, and it is unavoidable rather than convenient.
       * `typedRoutes` validates literal hrefs against the route map at compile time, which is
       * exactly what cannot be done for a value that arrives from `navigation_items` at runtime.
       * Next's own documentation names this cast for non-literal hrefs.
       *
       * WHAT REPLACES THE LOST CHECK is not nothing. `isInternalHref` has already established the
       * shape above; a link to a path with no route renders and 404s with the seeded copy rather
       * than throwing; and Phase 10 adds a resolved-URL preview to `/studio/content/navigation` so
       * an editor sees whether an href resolves BEFORE they publish it. That is the right place
       * for the check — the person typing the href — rather than a build that cannot know.
       */
      <Link href={href as Route} {...shared}>
        {children}
      </Link>
    )
  }

  return (
    <a href={href} {...shared}>
      {children}
    </a>
  )
}
