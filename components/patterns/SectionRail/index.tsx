import * as React from 'react'

import type { PageReferences } from '@/lib/cms/references'
import { siteString } from '@/lib/cms/strings'
import type { SiteStrings } from '@/lib/cms/strings'
import type { PageSection } from '@/lib/supabase/schemas'
import { cn } from '@/lib/ui/cn'

/**
 * RC-245 — the page-section index (DESIGN_SYSTEM §7.15, amendment A48).
 *
 * A fixed 56px column at the inline start of wide viewports, listing the page's bands as numbered
 * links. It is the reference's most recognisable navigation device — its own markup calls the
 * element `data-slot="cure-line"` and numbers thirteen of fifteen homepage sections — and it is
 * what REDESIGN §A3's "a compact page-section index where it helps navigation" asks for.
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
  /**
   * The page's resolved references, so the rail can tell a band that will draw something from one
   * that will draw nothing. Optional: a page with no reference-backed block has none, and the rail
   * is then decided by the eyebrow alone.
   */
  readonly references?: PageReferences
}

/**
 * Exported for the test: the rule for what appears is the part that can be wrong.
 *
 * A LABEL IS NOT ENOUGH — THE BAND MUST ALSO DRAW SOMETHING, and that second condition was missing
 * until `tests/e2e/section-rail.spec.ts` caught it. Roughly twenty renderers decline at runtime,
 * returning null rather than an empty frame. Most of those guards read
 * `items.length === 0 && !hasSectionCopy(section)`, and `hasSectionCopy` is true whenever an eyebrow
 * exists — so the rail's own rule satisfies them and they can be ignored here. What it does NOT
 * satisfy is the family that hides itself when its REFERENCE resolves to nothing:
 * `journal-strip`, `selected-works`, `portfolio-strip`, `secondary-objects`, `material-palette`,
 * `project-gallery` and `featured-collections` all return null with an eyebrow set and no content.
 * On the seeded homepage `journal-strip` does exactly that, and the rail linked to
 * `#section-<id>` for a band that emitted no element — a dead link in a navigation device, which is
 * worse than no navigation device.
 *
 * THE TEST IS UNIFORM RATHER THAN PER-BLOCK, deliberately. Every selector reports
 * `result.reason` as `OK`, `EMPTY` or `NOT_YET_BUILT`, so "did this band's reference find anything"
 * is one field and needs no table of block types to stay correct as renderers change. A table would
 * be a second place to update and would rot the first time somebody added a guard.
 *
 * IT IS CONSERVATIVE, AND THAT IS THE RIGHT DIRECTION. A reference-backed band that resolves EMPTY
 * but has copy — `category-grid`, say — renders a visible empty state and is now left out of the
 * index. That is a missing entry rather than a dead link, and an empty state is not a destination
 * worth sending somebody to. The residue runs the other way and is small: `empty-state`,
 * `quote` and `commission-configurator` decline on payload rather than on a reference, so a band of
 * one of those types with an eyebrow and no payload would still be listed. The browser spec is the
 * backstop for that, and it is the thing that found this class in the first place.
 */
export function railEntries(
  sections: readonly PageSection[],
  references?: PageReferences,
): readonly { readonly id: string; readonly label: string }[] {
  const entries: { id: string; label: string }[] = []
  for (const section of sections) {
    const eyebrow = section.eyebrow
    if (eyebrow === null || eyebrow.trim() === '') continue

    const reference = references?.get(section.id)
    if (reference !== undefined && reference.result.reason !== 'OK') continue

    entries.push({ id: section.id, label: eyebrow })
  }
  return entries
}

export function SectionRail({
  sections,
  strings,
  references,
}: SectionRailProps): React.ReactElement | null {
  const label = siteString(strings, 'UI_LABEL.section_rail.label')
  if (label === null) return null

  const entries = railEntries(sections, references)
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
