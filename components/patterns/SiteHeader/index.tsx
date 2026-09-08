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

  const bySlug = new Map(categories.map((category) => [category.slug, category]))

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-line',
        // `supports-` so a browser without backdrop-filter gets an opaque ground rather than
        // unreadable text over a photograph.
        'bg-surface supports-[backdrop-filter]:bg-surface/85 supports-[backdrop-filter]:backdrop-blur-sm',
      )}
    >
      <Container size="wide" className="flex items-center justify-between gap-6 py-4">
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
          <ul className="flex list-none items-center gap-6">
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
