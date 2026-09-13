import * as React from 'react'

import { siteString } from '@/lib/cms/strings'
import type { SiteStrings } from '@/lib/cms/strings'
import type { PageSection } from '@/lib/supabase/schemas'
import { cn } from '@/lib/ui/cn'

/**
 * RC-245 — the page-section index (§7.15, amendment A48).
 *
 * A fixed 56px column at the inline start of wide viewports, listing the page's bands as numbered
 * links. It is the reference's most recognisable navigation device — its own markup calls the
 * element `data-slot="cure-line"` and numbers thirteen of fifteen homepage sections — and it is
 * what §50's "a compact page-section index where it helps navigation" asks for.
 *
 * IT COSTS NO ISLAND AND NO SCROLL LISTENER. A Server Component rendering anchors. There is
 * deliberately NO active-state highlight: tracking which band is on screen needs either a scroll
 * handler (an island on all sixteen CMS routes, which `scripts/site/check-client-boundary.mjs`
 * and the island budget both refuse) or a `view-timeline-name` per section plus a `timeline-scope`
 * listing every name — and that list is static CSS while a page's section count is data. An index
 * without a highlight is still an index; a highlight bought with an island on every route is not
 * worth it.
 *
 * WHAT APPEARS IS DECIDED BY THE CMS, NOT BY THIS FILE. A band appears if and only if it has an
 * `eyebrow`, which is already the short technical label sitting above its heading — the exact role
 * the rail needs, editable where the section is editable. So an editor lengthens the rail by
 * writing an eyebrow and shortens it by clearing one, and this component holds no list.
 *
 * THE NUMBERS COUNT WHAT RENDERED, not what the page declares. They are the rail's own 1-based
 * order over the bands that appear — the same rule `ordinal` follows in `SectionList`, and for the
 * same reason: a page whose second band is withheld for owner verification must read 01, 02, 03
 * rather than 01, 03, 04, which would tell a visitor something is missing and invite them to
 * wonder what.
 *
 * IT IS SHOWN AT `xl` AND ABOVE, AND THE THRESHOLD IS ARITHMETIC RATHER THAN TASTE. The rail is
 * `position: fixed`, so it reserves no space and would sit ON the reading column if that column
 * reached it. `Container` at `default` is 75rem (1200px) centred inside `--rv-gutter`, so the free
 * space before the content starts is `max(0, (vw − 1200) ÷ 2) + gutter`:
 *
 *   1024 →   0 + 47 =  47px   — less than the rail's 56, it would overlap
 *   1280 →  40 + 57 =  97px   — clears it
 *   1440 → 120 + 64 = 184px
 *   1920 → 360 + 64 = 424px
 *
 * So `xl` is the first breakpoint where the column already exists. AN EARLIER VERSION OF THIS
 * COMPONENT SHOWED IT AT `lg` AND PAID FOR THE SPACE by adding the rail's width to the container's
 * start padding through a token. That worked at 1024 and was wrong everywhere above it: at 1440 the
 * container already has a 120px margin, so the extra 120px of padding pushed the copy to 240px
 * while the rail stayed at the viewport edge — a 180px gulf between an index and the thing it
 * indexes. Taking space that is already there is simpler than making more of it, and it leaves
 * `Container` untouched.
 *
 * BELOW THAT IT IS NOT RENDERED AT ALL rather than given a narrow variant. A horizontal version
 * would be a second navigation pattern to learn, and the whole page is still reachable by
 * scrolling, which is what a visitor on a phone does anyway.
 */

export type SectionRailProps = {
  readonly sections: readonly PageSection[]
  readonly strings: SiteStrings
}

/** Exported for the test: the rule for what appears is the part that can be wrong. */
export function railEntries(
  sections: readonly PageSection[],
): readonly { readonly id: string; readonly label: string }[] {
  const entries: { id: string; label: string }[] = []
  for (const section of sections) {
    const eyebrow = section.eyebrow
    if (eyebrow === null || eyebrow.trim() === '') continue
    entries.push({ id: section.id, label: eyebrow })
  }
  return entries
}

export function SectionRail({ sections, strings }: SectionRailProps): React.ReactElement | null {
  const label = siteString(strings, 'UI_LABEL.section_rail.label')
  if (label === null) return null

  const entries = railEntries(sections)
  /*
   * TWO IS THE FLOOR, not one. An index of a single item tells a visitor nothing they cannot see,
   * and it would put a permanent empty column beside every short page on the site.
   */
  if (entries.length < 2) return null

  return (
    <nav
      // A stable hook for the browser tests, which assert the rail appears at xl and not below it
      // and that no page scrolls sideways once it does. An attribute rather than a class because
      // nothing styles it — the styling is all utilities, and a class would invite a rule.
      data-rv-section-rail=""
      aria-label={label}
      className={cn(
        'pointer-events-none fixed inset-y-0 start-0 z-(--rv-z-raised) hidden xl:block',
        'w-(--rv-rail-gutter)',
      )}
    >
      {/*
       * CENTRED IN THE VIEWPORT rather than pinned to the top: the rail is a position indicator
       * for a long document, and a list that starts at the masthead collides with it on every page.
       */}
      <ol className="flex h-full list-none flex-col justify-center gap-3">
        {entries.map((entry, index) => (
          <li key={entry.id} className="flex justify-center">
            <a
              // `pointer-events-none` on the nav, restored here: the column between the links is a
              // 56px strip down the side of the page and must not swallow clicks meant for content.
              href={`#section-${entry.id}`}
              className={cn(
                'pointer-events-auto flex flex-col items-center gap-1 px-1 py-2',
                'font-mono text-2xs tracking-eyebrow text-ink-tertiary uppercase',
                'transition-[color] duration-(--rv-duration-fast) ease-standard',
                'hover:text-ink focus-visible:text-ink',
              )}
            >
              {/*
               * The number is generated, so it is not copy — `check-section-copy.ts` scans string
               * literals and this is an expression. `tabular-nums` so 01 and 11 are the same width
               * in a vertical stack, which is the whole reason the rail is set in mono.
               */}
              <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>
              {/*
               * The eyebrow itself is announced but not drawn. A 56px column cannot show a word
               * legibly, and rotating text on its side is a decoration a screen reader cannot
               * follow and a keyboard user cannot scan. So the visible mark is the number, and the
               * label is the link's accessible name — which is what a person navigating by links
               * actually hears.
               */}
              <span className="sr-only">{entry.label}</span>
              <span aria-hidden="true" className="h-6 w-px bg-line-strong opacity-60" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
