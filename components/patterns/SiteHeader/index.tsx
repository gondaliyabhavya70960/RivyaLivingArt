import * as React from 'react'

import { MegaMenu } from '@/components/patterns/MegaMenu'
import { NavLink } from '@/components/patterns/NavLink'
import { MobileNav } from '@/components/patterns/MobileNav'
import { BlockImage } from '@/components/patterns/MediaSlot'
import { Container } from '@/components/primitives/Container'
import { siteString } from '@/lib/cms/strings'
import type { SiteChrome } from '@/lib/site/chrome'
import type { MenuItem } from '@/lib/site/menu'
import { cn } from '@/lib/ui/cn'
import type { Category, MediaAsset } from '@/lib/supabase/schemas'

/**
 * The masthead.
 *
 * A SERVER COMPONENT. The only client code the header ships is the mega-menu panel's open state
 * and the mobile drawer — two small islands, both of which receive everything they display as
 * props. Nothing here fetches: `getSiteChrome()` ran once in the layout and this component is
 * handed the result.
 *
 * STICKY WITH NO SCROLL LISTENER. The phase document asks for "scroll-state via CSS only", and the
 * reason is not purity: a scroll handler that toggles a class on the header runs on the main
 * thread on every frame of every scroll on every page, and it is the classic source of jank at the
 * top of a long page. The header instead carries its treatment unconditionally — a translucent
 * ground with a backdrop blur and a hairline rule — which reads correctly over a photograph and
 * over flat colour alike, so there is no state to track.
 *
 * EVERY WORD IN HERE COMES FROM THE DATABASE. The brand name is `BRAND.brand.name`, the menu items
 * are `navigation_items` rows, the landmark names and control labels are the `UI_LABEL` and
 * `ACTION_LABEL` rows Phase 10 seeds. `scripts/site/check-client-boundary.mjs` and the exit
 * criterion "zero copy literals in components/patterns/Site*" are what keep it that way.
 */

/** `/collection/furniture` → `furniture`. Null for anything that is not a category destination. */
function categorySlugOf(href: string): string | null {
  const match = /^\/collection\/([\w-]+)\/?$/.exec(href)
  return match?.[1] ?? null
}

type CategoryCardProps = {
  readonly item: MenuItem
  readonly category: Category | undefined
  readonly asset: MediaAsset | null
  readonly chrome: SiteChrome
  readonly cloudName: string
}

/**
 * One card in the mega menu.
 *
 * A CATEGORY WITH NO BOUND ASSET RENDERS AS TEXT, NOT AS A PLACEHOLDER. Two of the seven —
 * `furniture` and `collectible-design` — have no hero, and Phase 09 recorded both as gaps rather
 * than binding "something close" from another family. Borrowing a resin photograph to illustrate
 * Furniture would be a claim about work that does not exist, so the card is simply a label, and
 * `tests/unit/site-menu.test.ts` asserts that branch for exactly those two slugs.
 *
 * Note this is NOT the media-failure case. A category that HAS an asset which then fails to load
 * gets `MediaSlot`'s reserved box and the §47 label — that is a delivery problem, and the layout
 * must not move. A category with no asset at all has nothing to reserve space for.
 */
function CategoryCard({
  item,
  category,
  asset,
  chrome,
  cloudName,
}: CategoryCardProps): React.ReactElement {
  return (
    <li>
      <NavLink
        href={item.href}
        target={item.target}
        className={cn(
          'group block w-40',
          'transition-[color] duration-(--rv-duration-fast) ease-standard',
        )}
      >
        {category?.hero_media_id == null ? null : (
          <BlockImage
            asset={asset}
            ratio="4:3"
            preset="thumb"
            sizes="10rem"
            strings={chrome.strings}
            cloudName={cloudName}
            className="mb-2"
          />
        )}
        <span className="block text-sm text-ink-secondary group-hover:text-ink">{item.label}</span>
      </NavLink>
    </li>
  )
}

/**
 * The masthead's search control: a link to `/search` wearing a magnifier.
 *
 * IT IS A TRIGGER, WHICH IS WHAT §8.1 ASKED FOR ALL ALONG. Phase 23 shipped an inline field where
 * that table says *trigger*, and the field never fitted: the masthead's content box is 1312px at
 * its widest, the wordmark takes 104 and nine top-level items take 968, so the field — a `flex-1`
 * item between them — was allotted whatever was left. **26px at 1280 and 99px at 1440**, measured
 * on the live site, against a seeded placeholder 44 characters long. A visitor saw "Search fu" in a
 * box too narrow to type a word into. That is the defect this replaces, and it was never a styling
 * slip: a flexible item beside two inflexible ones absorbs the whole deficit, so the row reported
 * no overflow while the control it contained was crushed to nothing.
 *
 * NOT AN ISLAND, AND THAT IS THE POINT. A link needs no hydration, no `aria-expanded`, no debounce
 * and no abort controller. The combobox those things exist for is not deleted — it moved to
 * `/search`, where the field is full width and suggestions are the task rather than a garnish, and
 * where `check-search-scope.mjs` already walked it. The homepage's island budget drops from five
 * to four in the same edit.
 *
 * NO COPY. `UI_LABEL.search.label` is the accessible name; the glyph is `aria-hidden`, so the label
 * is the control's whole announced name. A missing row renders no trigger rather than an icon
 * nobody can name — the rule every other string in this header follows.
 *
 * `xl` AND UP, WHICH IS UNCHANGED AND IS STILL THE ARITHMETIC'S ANSWER. 44px plus its 24px gap
 * needs 68; at 1024 the row has 802px for a nav that wants 968 and is already wrapping without it.
 * Below `lg` the drawer carries `/search` as a menu item. See DESIGN_SYSTEM §8.1.
 */
function SearchTrigger({ label }: { readonly label: string }): React.ReactElement {
  return (
    <NavLink
      href="/search"
      data-header-search=""
      aria-label={label}
      className={cn(
        'hidden size-11 shrink-0 items-center justify-center rounded-full xl:inline-flex',
        'text-ink-secondary transition-colors duration-(--rv-duration-fast) ease-standard',
        'hover:text-ink focus-visible:text-ink motion-reduce:transition-none',
      )}
    >
      {/* The §7.2 icon contract: inline SVG, `currentColor`, stroke 1.5, a 20px box, aria-hidden
          so it cannot compete with the label above. No icon font, no sprite, no request. */}
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
        className="size-5"
      >
        <circle cx="9" cy="9" r="5.25" />
        <path d="m12.9 12.9 3.6 3.6" />
      </svg>
    </NavLink>
  )
}

export type SiteHeaderProps = {
  readonly chrome: SiteChrome
  readonly cloudName: string
}

export function SiteHeader({ chrome, cloudName }: SiteHeaderProps): React.ReactElement {
  const { strings, header, mobile, categories, categoryMedia } = chrome

  const brand = siteString(strings, 'BRAND.brand.name')
  const primaryLabel = siteString(strings, 'UI_LABEL.nav.primary')
  const categoriesLabel = siteString(strings, 'UI_LABEL.nav.categories')
  const mobileLabel = siteString(strings, 'UI_LABEL.nav.mobile')
  const openLabel = siteString(strings, 'ACTION_LABEL.open_menu')
  const closeLabel = siteString(strings, 'ACTION_LABEL.close_menu')

  // ONE ROW, WHERE PHASE 23 READ SEVEN. The masthead no longer renders the field, so the six rows
  // that dressed it — placeholder, submit, suggestion list name, hint, "see all", count — are read
  // by `/search`, which is where the field now lives. This is the trigger's accessible name, and a
  // missing row means no trigger rather than an unnamed icon, like every other string here.
  const searchLabel = siteString(strings, 'UI_LABEL.search.label')

  /*
   * §5.1's masthead CTA. Missing row means no button, like every other string in this header —
   * an unlabelled primary action is worse than none.
   */
  const commissionLabel = siteString(strings, 'CTA.header_commission.label')

  const bySlug = new Map(categories.map((category) => [category.slug, category]))

  return (
    <header
      // The hook for the §7.14a overlay in base.css. An ATTRIBUTE rather than a class because the
      // rule that reads it is a `:has()` selector in the stylesheet — nothing in TypeScript needs
      // to know whether the header is currently overlaying, and giving it a class would invite a
      // component to start asking.
      data-rv-site-header=""
      className={cn(
        'sticky top-0 z-header border-b border-line',
        // `supports-` so a browser without backdrop-filter gets an opaque ground rather than
        // unreadable text over a photograph. Both are overridden by the overlay rule on a page
        // that opens dark; on every other page this stays exactly as it was.
        'bg-surface supports-[backdrop-filter]:bg-surface/85 supports-[backdrop-filter]:backdrop-blur-sm',
      )}
    >
      <Container
        size="wide"
        className="flex items-center justify-between gap-6"
        // The height the overlay pulls the opening band up by. Set from the token rather than from
        // a `h-20` utility so `base.css` and this row cannot disagree — see --rv-header-h.
        style={{ minBlockSize: 'var(--rv-header-h)' }}
      >
        {/* The brand is a link home. It renders nothing at all if the string is missing, rather
            than falling back to a literal — see lib/cms/strings.ts on why there is no default. */}
        {brand === null ? null : (
          <NavLink href="/" className="font-display text-lg tracking-heading text-ink">
            {brand}
          </NavLink>
        )}

        <nav
          {...(primaryLabel === null ? {} : { 'aria-label': primaryLabel })}
          className="hidden lg:block"
        >
          {/*
           * THREE GAPS, AND ALL THREE NUMBERS WERE MEASURED RATHER THAN CHOSEN.
           *
           * Phase 42 tightened `lg` to 12px against an estimate of 834px for nine items at
           * `gap-6`. The real figure is 968, and the estimate is why the sums below it never
           * balanced. Measured on the live masthead with the items forced onto one line, the nine
           * published top-level items want:
           *
           *     gap-6 (24px) 968   gap-5 (20px) 936   gap-4 (16px) 904   gap-3 (12px) 872
           *
           * `xl` DROPS FROM 24px TO 20px BECAUSE 24 LEFT ONE PIXEL. At 1280 the content box is
           * 1165; the wordmark takes 104, the two row gaps 48 and the search trigger 44, which
           * leaves 969 for a nav that wants 968 at `gap-6`. One pixel is not headroom — these
           * labels are `navigation_items` rows, so a single editor renaming "About" wraps the
           * masthead. 20px leaves 33, which survives an edit. `2xl` restores the 24px §5 draws.
           *
           * WHAT NO GAP FIXES IS `lg`. At 1024 the row has 802px for the nav, and nine items want
           * 872 even at 12px and 840 at 8px — so the nav wraps to two lines and the wordmark is
           * squeezed from 104 to 97 at every width below roughly 1100. That is not a spacing bug
           * and it is not fixed here: nine top-level items is more than this masthead can carry,
           * and what is in the menu is the owner's, not this component's. See DESIGN_SYSTEM §8.1.
           */}
          <ul className="flex list-none items-center gap-3 xl:gap-5 2xl:gap-6">
            {header.map((item) =>
              item.children.length === 0 ? (
                <li key={item.id}>
                  <NavLink
                    href={item.href}
                    target={item.target}
                    className={cn(
                      'py-2 text-sm uppercase tracking-technical text-ink-secondary',
                      'transition-[color] duration-(--rv-duration-fast) ease-standard',
                      'hover:text-ink focus-visible:text-ink',
                    )}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ) : (
                <li key={item.id}>
                  <MegaMenu label={item.label} panelLabel={categoriesLabel}>
                    <ul className="flex list-none flex-wrap gap-4">
                      {/* The parent's own destination, first. The trigger is a button and cannot
                          navigate, so without this `/collection` would be unreachable from the
                          header — see MegaMenu's header for why the trigger is not a link. */}
                      <li>
                        <NavLink
                          href={item.href}
                          target={item.target}
                          className="block w-40 text-sm text-ink underline-offset-4 hover:underline"
                        >
                          {item.label}
                        </NavLink>
                      </li>
                      {item.children.map((child) => {
                        const slug = categorySlugOf(child.href)
                        const category = slug === null ? undefined : bySlug.get(slug)
                        const heroId = category?.hero_media_id ?? null
                        return (
                          <CategoryCard
                            key={child.id}
                            item={child}
                            category={category}
                            asset={heroId === null ? null : (categoryMedia.get(heroId) ?? null)}
                            chrome={chrome}
                            cloudName={cloudName}
                          />
                        )
                      })}
                    </ul>
                  </MegaMenu>
                </li>
              ),
            )}
          </ul>
        </nav>

        {/* §8.1's search trigger. See `SearchTrigger` above for why it is no longer a field. */}
        {searchLabel === null ? null : <SearchTrigger label={searchLabel} />}

        {/*
         * THE ONE PRIMARY ACTION IN THE MASTHEAD — public redesign guide §5.1, "Commission a piece
         * → /custom-commissions. Not wa.me."
         *
         * THE DESTINATION IS A LITERAL AND THE LABEL IS NOT, WHICH IS DELIBERATE. `/custom-
         * commissions` is a route this component owns, not copy: §5.1 forbids a WhatsApp link in
         * the masthead, and an href read from `global_content` is an href somebody can change to
         * one. The words are the owner's; the destination is the architecture's.
         *
         * `2xl`, AND IT DOES NOT FIT THERE EITHER. Every earlier number here was an estimate and
         * every one of them was wrong. Measured: this button is **197px**, not the 155 recorded,
         * and the nav is 968 at `gap-6`, not 834. The widest content box this container allows is
         * 1312 — `wide` is 90rem and `2xl` is 90rem, so 1920 is no roomier than 1440. The row then
         * wants 104 + 968 + 44 + 197 and three 24px gaps: **1385 into 1312**.
         *
         * WHAT HAPPENS IS NOT A SIDEWAYS SCROLL, WHICH IS WHY NO GATE CAUGHT IT. The button is
         * `shrink-0` and the nav is not, so the nav absorbs the 73px: its items wrap and the
         * masthead grows a second line of menu. `homepage.spec.ts` asserts overflow and sees none.
         * The same mechanism hid the crushed search field for three phases — see `SearchTrigger`.
         *
         * SO THE PILL IS RENDERED HERE AND IS CURRENTLY UNREACHABLE, because its `CTA` row has not
         * been seeded to production; the live masthead shows no button at any width. Freeing the
         * field's 148px was necessary and is not sufficient, and the remaining 73 cannot be shaved
         * out of gaps without pinning the layout to labels an editor may change tomorrow. What
         * closes it is a shorter top-level menu: nine items is the constraint, and six would leave
         * this button 167px of room at every width from 1280 up. That is an editorial decision
         * about `navigation_items`, so it is recorded in DESIGN_SYSTEM §8.1 and left to the owner
         * rather than taken here.
         */}
        {commissionLabel === null ? null : (
          <NavLink
            href="/custom-commissions"
            data-header-commission=""
            className={cn(
              'border-line-strong hidden shrink-0 rounded-full border px-5 2xl:inline-flex',
              'min-h-11 items-center text-sm uppercase tracking-technical text-ink',
              'transition-colors duration-(--rv-duration-fast) ease-standard',
              'hover:border-(--rv-ink-accent) motion-reduce:transition-none',
            )}
          >
            {commissionLabel}
          </NavLink>
        )}

        {/* Below `lg` the whole menu is the drawer. Both labels are required by MobileNav's
            signature, so a missing string means no trigger rather than an unnamed icon button. */}
        {openLabel === null || closeLabel === null ? null : (
          <MobileNav
            items={mobile}
            openLabel={openLabel}
            closeLabel={closeLabel}
            title={mobileLabel ?? openLabel}
            className="lg:hidden"
          />
        )}
      </Container>
    </header>
  )
}
