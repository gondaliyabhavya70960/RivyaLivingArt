import type { NavigationItem } from '@/lib/supabase/schemas'

import { resolveInternalTarget } from './resolve-target'

/**
 * `navigation_items` rows into the two shapes the chrome renders.
 *
 * PURE, AND SEPARATE FROM THE FETCH, because this is the part that can be wrong in a way nobody
 * sees. A menu that silently drops a child, or renders a column heading as a link that reloads the
 * page, looks completely normal in a screenshot. Keeping the transformation free of I/O means
 * `tests/unit/site-menu.test.ts` can assert every one of those cases against fixtures.
 *
 * `is_visible` IS FILTERED HERE AND NOT BY RLS, DELIBERATELY AND NECESSARILY.
 * `navigation_items_select_public` admits `status = 'PUBLISHED'` and says nothing about
 * visibility — unlike `pages` and `page_sections`, whose public policies carry the whole window.
 * That asymmetry is real: hiding an item is an editorial act an editor can undo, not a publication
 * state. It does mean that forgetting this filter would publish every hidden item to the live
 * menu, so it is applied once, here, on the way into every menu shape.
 */
export type MenuItem = {
  readonly id: string
  readonly label: string
  readonly href: string
  /** `_self` or `_blank`, from the row. Applied by the renderer, never assumed. */
  readonly target: string
  readonly children: readonly MenuItem[]
}

/**
 * A footer column: a heading and the links beneath it.
 *
 * `href` IS NULL FOR A HEADING THAT IS NOT A DESTINATION. Phase 09 seeds those with `href = '#'`,
 * because the column is `not null` and an empty string resolves to the current page — a heading
 * that looks like a link and reloads when clicked. `#` is the seed's inert marker and this is the
 * only place that knows it: everything downstream sees `null` and renders plain text.
 */
export type FooterColumn = {
  readonly id: string
  readonly heading: string
  readonly href: string | null
  readonly links: readonly MenuItem[]
}

/** The seed's marker for "this row is a heading, not a destination". */
const INERT_HREF = '#'

function visible(rows: readonly NavigationItem[], menu: string): NavigationItem[] {
  return rows
    .filter((row) => row.menu === menu && row.is_visible)
    .slice()
    .sort(byPosition)
}

/**
 * Position, then label, then id.
 *
 * THREE KEYS FOR THE SAME REASON `listSectionsForPage` USES THREE. Positions are seeded ten apart
 * and nothing stops an editor giving two items the same number; a menu whose order changes between
 * two renders of the same data is a bug that cannot be reproduced on demand. `id` last makes the
 * order total.
 */
function byPosition(a: NavigationItem, b: NavigationItem): number {
  if (a.position !== b.position) return a.position - b.position
  if (a.label !== b.label) return a.label.localeCompare(b.label)
  return a.id.localeCompare(b.id)
}

function toItem(row: NavigationItem, children: readonly MenuItem[]): MenuItem {
  return { id: row.id, label: row.label, href: row.href, target: row.target, children }
}

/**
 * One menu as a two-level tree.
 *
 * TWO LEVELS, NOT N. `navigation_items.parent_id` is self-referential and would permit any depth,
 * but D3's menu is Collection with its seven categories and nothing deeper, and the mega menu's
 * keyboard model is written for exactly two. Building arbitrary depth here would produce a tree no
 * renderer can display, and the failure would appear as a silently missing third level rather than
 * as an error. A grandchild is dropped, which is visible in Studio's navigation screen.
 */
export function buildMenu(
  rows: readonly NavigationItem[],
  menu: string,
  livePaths?: ReadonlySet<string>,
): readonly MenuItem[] {
  const items = visible(rows, menu).filter((row) => reachable(row, livePaths))
  const byParent = new Map<string, NavigationItem[]>()
  for (const row of items) {
    if (row.parent_id === null) continue
    const siblings = byParent.get(row.parent_id)
    if (siblings === undefined) byParent.set(row.parent_id, [row])
    else siblings.push(row)
  }

  return items
    .filter((row) => row.parent_id === null)
    .map((row) =>
      toItem(
        row,
        (byParent.get(row.id) ?? []).map((child) => toItem(child, [])),
      ),
    )
}

/**
 * May this row be offered to a visitor?
 *
 * A SIGNPOST TO NOWHERE IS WORSE THAN NO SIGNPOST — Phase 45, and this is the one place in the
 * product where the rule differs from the rule for a page body.
 *
 * `resolveInternalTarget` renders a card or a call to action whose destination is not live as TEXT,
 * because that content has copy of its own — a title, a description, sometimes a picture — which is
 * still true when the destination is not ready, and deleting an editor's words over a URL would be
 * the worse failure. A navigation item has no copy: its entire payload IS the destination.
 * "Furniture" as an inert span in a mega menu informs nobody, is correctly not focusable and so
 * cannot be reached by keyboard at all, and reads as a disabled control with no explanation of what
 * would enable it. So the chrome omits it. The `navigation_items` row is untouched and the item
 * returns the moment its destination is live, exactly as a call to action does.
 *
 * WHAT THIS FIXES. Ten destinations in the published menus answered 404: the seven
 * `/collection/<slug>` routes, whose `categories` rows are all DRAFT, and `/faq`, `/privacy` and
 * `/terms`, whose `pages` rows are published with no published sections. The header, the mega menu,
 * the mobile drawer and the footer all rendered them as anchors, because none of the four consulted
 * the live set the chrome had already computed.
 *
 * WHY HERE AND NOT IN THE FOUR RENDERERS. `buildMenu` and `footerColumns` are the single pure
 * transformation every chrome surface reads, so one filter covers all four and cannot be forgotten
 * by a fifth surface added later. `NavLink` was the other candidate and is wrong: its own contract
 * is that it carries no default styling and is never where menu appearance is decided, and a
 * component that sometimes returns a `span` would silently change three call sites' layout.
 *
 * THE INERT HEADING IS DECIDED BEFORE THE LIVE CHECK. The seed writes `#` for a footer column
 * heading that is not a destination; it is not a dead link and must survive, or all four footer
 * headings vanish.
 *
 * OMITTING `livePaths` MEANS "DO NOT CHECK", which matches `SectionActions`. A caller with no
 * oracle — a unit test, a Studio preview — gets the unfiltered menu rather than an empty one.
 */
function reachable(row: NavigationItem, livePaths?: ReadonlySet<string>): boolean {
  if (livePaths === undefined) return true
  if (row.href.trim() === INERT_HREF) return true
  return resolveInternalTarget(row.href, livePaths) !== null
}

/**
 * The footer's columns (SEED §24).
 *
 * A column is a top-level FOOTER row; its links are that row's children. A top-level row with a
 * real `href` and no children is still rendered as a column heading that links — the seed does not
 * produce one, but an editor can, and dropping it would make an item they added disappear with no
 * explanation.
 */
export function footerColumns(
  rows: readonly NavigationItem[],
  livePaths?: ReadonlySet<string>,
): readonly FooterColumn[] {
  /*
   * A COLUMN THAT HAD LINKS AND LOST ALL OF THEM RENDERS NOTHING — but a column that never had any
   * is kept, and the distinction is load-bearing. `SiteFooter` identifies the contact column as
   * "the column with no links": its heading is a `navigation_items` row, its content comes from
   * `chrome.contact`, and a rule phrased as "drop empty columns" would delete it.
   */
  const hadLinks = new Set(
    buildMenu(rows, 'FOOTER')
      .filter((item) => item.children.length > 0)
      .map((item) => item.id),
  )

  return buildMenu(rows, 'FOOTER', livePaths)
    .filter((item) => item.children.length > 0 || !hadLinks.has(item.id))
    .map((item) => ({
      id: item.id,
      heading: item.label,
      href: item.href.trim() === INERT_HREF ? null : item.href,
      links: item.children,
    }))
}
