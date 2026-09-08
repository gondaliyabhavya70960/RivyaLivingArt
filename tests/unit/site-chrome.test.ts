import { describe, expect, it } from 'vitest'

import { announcementFrom } from '@/lib/site/announcement'
import { contactDetailsOf } from '@/lib/site/contact-details'
import { resolveHref } from '@/lib/site/href-resolution'
import { buildMenu, footerColumns } from '@/lib/site/menu'
import type { GlobalContent, NavigationItem, PageSection } from '@/lib/supabase/schemas'

/**
 * The pure half of the site chrome: rows in, render-ready shapes out.
 *
 * These are the functions whose mistakes are invisible. A menu that silently drops a child, a
 * column heading rendered as a link that reloads the page, a dismissal token that never changes —
 * every one of them looks completely normal in a screenshot, so none of them would be caught by
 * looking at the site. Keeping the transformation free of I/O is what makes them assertable.
 */

let counter = 0
const uuid = () => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`

function nav(partial: Partial<NavigationItem> & { menu: string; label: string }): NavigationItem {
  return {
    id: uuid(),
    parent_id: null,
    href: '/x',
    position: 10,
    is_visible: true,
    target: '_self',
    status: 'PUBLISHED',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    published_at: null,
    published_by: null,
    owner_verification: 'NOT_REQUIRED',
    fact_classification: 'BRAND_COPY',
    owner_edited: false,
    seed_key: null,
    seed_content_hash: null,
    content_seed_version: null,
    publish_at: null,
    unpublish_at: null,
    ...partial,
  } as NavigationItem
}

function global_(
  partial: Partial<GlobalContent> & { group_key: string; key: string; value: string },
): GlobalContent {
  return {
    id: uuid(),
    label: null,
    description: null,
    is_enabled: true,
    status: 'PUBLISHED',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    published_at: null,
    published_by: null,
    owner_verification: 'NOT_REQUIRED',
    fact_classification: 'BRAND_COPY',
    owner_edited: false,
    seed_key: null,
    seed_content_hash: null,
    content_seed_version: null,
    publish_at: null,
    unpublish_at: null,
    ...partial,
  } as GlobalContent
}

describe('buildMenu', () => {
  it('nests children under their parent, in position order', () => {
    const parent = nav({ menu: 'HEADER', label: 'Collection', href: '/collection', position: 20 })
    const rows = [
      nav({ menu: 'HEADER', label: 'Home', href: '/', position: 10 }),
      parent,
      nav({ menu: 'HEADER', label: 'Gifts', parent_id: parent.id, position: 70 }),
      nav({ menu: 'HEADER', label: 'Furniture', parent_id: parent.id, position: 10 }),
    ]

    const menu = buildMenu(rows, 'HEADER')
    expect(menu.map((item) => item.label)).toEqual(['Home', 'Collection'])
    expect(menu[1]?.children.map((child) => child.label)).toEqual(['Furniture', 'Gifts'])
  })

  it('drops a hidden item', () => {
    // `navigation_items_select_public` admits every PUBLISHED row regardless of `is_visible`,
    // unlike the pages policies — so forgetting this filter publishes every hidden item.
    const rows = [
      nav({ menu: 'HEADER', label: 'Shown', position: 10 }),
      nav({ menu: 'HEADER', label: 'Hidden', position: 20, is_visible: false }),
    ]
    expect(buildMenu(rows, 'HEADER').map((i) => i.label)).toEqual(['Shown'])
  })

  it('drops a hidden parent’s children with it', () => {
    const parent = nav({ menu: 'HEADER', label: 'Collection', position: 10, is_visible: false })
    const rows = [parent, nav({ menu: 'HEADER', label: 'Gifts', parent_id: parent.id })]
    expect(buildMenu(rows, 'HEADER')).toEqual([])
  })

  it('keeps the two menus separate', () => {
    // HEADER and MOBILE are distinct rows so the owner can shorten one without touching the other.
    const rows = [
      nav({ menu: 'HEADER', label: 'Desktop only' }),
      nav({ menu: 'MOBILE', label: 'Mobile only' }),
    ]
    expect(buildMenu(rows, 'HEADER').map((i) => i.label)).toEqual(['Desktop only'])
    expect(buildMenu(rows, 'MOBILE').map((i) => i.label)).toEqual(['Mobile only'])
  })

  it('orders two items that share a position deterministically', () => {
    // Positions are seeded ten apart, but nothing stops an editor giving two items the same
    // number, and a menu whose order changes between renders is a bug nobody can reproduce.
    const rows = [
      nav({ menu: 'HEADER', label: 'Beta', position: 10 }),
      nav({ menu: 'HEADER', label: 'Alpha', position: 10 }),
    ]
    expect(buildMenu(rows, 'HEADER').map((i) => i.label)).toEqual(['Alpha', 'Beta'])
  })
})

describe('footerColumns', () => {
  it('turns the seed’s inert "#" heading into a column with no link', () => {
    // `href` is NOT NULL on the table, so a heading carries '#'. Rendered as a link it would
    // reload the page; this is the one place that knows the marker.
    const heading = nav({ menu: 'FOOTER', label: 'Explore', href: '#', position: 10 })
    const rows = [
      heading,
      nav({ menu: 'FOOTER', label: 'Journal', href: '/journal', parent_id: heading.id }),
    ]

    const [column] = footerColumns(rows)
    expect(column?.heading).toBe('Explore')
    expect(column?.href).toBeNull()
    expect(column?.links.map((l) => l.label)).toEqual(['Journal'])
  })

  it('keeps a column heading that does have a destination', () => {
    const rows = [nav({ menu: 'FOOTER', label: 'Contact', href: '/contact', position: 40 })]
    expect(footerColumns(rows)[0]?.href).toBe('/contact')
  })

  it('keeps a heading with no links, which is what the contact column is', () => {
    const rows = [nav({ menu: 'FOOTER', label: 'Contact', href: '#', position: 40 })]
    const [column] = footerColumns(rows)
    expect(column?.links).toEqual([])
  })
})

describe('announcementFrom', () => {
  const message = () =>
    global_({ group_key: 'ANNOUNCEMENT', key: 'bar.message', value: 'A message.' })

  it('is null when the row is absent — which is the seeded state', () => {
    // §9's message is OWNER_VERIFICATION_REQUIRED, so it seeds DRAFT and the public policy does
    // not return it. No bar renders, and no default message is invented.
    expect(announcementFrom([])).toBeNull()
  })

  it('is null when the row is disabled', () => {
    const disabled = { ...message(), is_enabled: false }
    expect(announcementFrom([disabled])).toBeNull()
  })

  it('drops a half-configured CTA rather than rendering a button with no destination', () => {
    const rows = [
      message(),
      global_({ group_key: 'ANNOUNCEMENT', key: 'bar.cta_label', value: 'Discuss a Project' }),
    ]
    const announcement = announcementFrom(rows)
    expect(announcement?.ctaLabel).toBeNull()
    expect(announcement?.ctaHref).toBeNull()
  })

  it('renders both halves of a complete CTA', () => {
    const rows = [
      message(),
      global_({ group_key: 'ANNOUNCEMENT', key: 'bar.cta_label', value: 'Discuss a Project' }),
      global_({ group_key: 'ANNOUNCEMENT', key: 'bar.cta_href', value: '/custom-commissions' }),
    ]
    expect(announcementFrom(rows)?.ctaHref).toBe('/custom-commissions')
  })

  it('changes its token when the message text changes', () => {
    /*
     * THE REASON THE TOKEN IS NOT THE ROW ID ALONE. `global_content` is keyed by
     * (group_key, key), so there is exactly one ANNOUNCEMENT.bar.message row and its id never
     * changes — an editor announcing something new edits the value. A cookie holding the id would
     * mean a visitor who dismissed the bar once never sees an announcement again, ever.
     */
    const first = message()
    // The SAME row id, a different value — which is exactly what editing an announcement does.
    const second = { ...first, value: 'A different message.' }
    expect(announcementFrom([first])?.token).not.toBe(announcementFrom([second])?.token)
  })

  it('keeps the same token for the same row and the same message', () => {
    // A dismissal must survive a deploy and a re-render, or the bar comes back every visit. The
    // token is the row id plus a hash of the text, so the same row with unchanged text is stable.
    const row = message()
    expect(announcementFrom([row])?.token).toBe(announcementFrom([{ ...row }])?.token)
  })
})

describe('contactDetailsOf', () => {
  const section = (payload: unknown) => ({ payload }) as PageSection

  it('is null when the section is absent — the seeded state until the owner verifies', () => {
    expect(contactDetailsOf(null)).toBeNull()
  })

  it('reads the §21 fields', () => {
    const details = contactDetailsOf(
      section({
        phone: '+91 7096036250',
        email: 'studio@example.test',
        whatsapp: '+91 7096036250',
      }),
    )
    expect(details?.phone).toBe('+91 7096036250')
    expect(details?.email).toBe('studio@example.test')
  })

  it('leaves the unsupplied Google Maps destination null', () => {
    // §21 refers to a location and supplies none. A label with no link would be a location claim
    // with no address behind it.
    const details = contactDetailsOf(
      section({ phone: '+91 1', location_url: null, location_label: null }),
    )
    expect(details?.locationUrl).toBeNull()
    expect(details?.locationLabel).toBeNull()
  })

  it('treats a blank field as absent', () => {
    const details = contactDetailsOf(section({ phone: '   ', email: 'a@b.test' }))
    expect(details?.phone).toBeNull()
  })

  it('is null when every field is empty', () => {
    expect(contactDetailsOf(section({ phone: '', email: '', whatsapp: '' }))).toBeNull()
  })

  it('renders nothing rather than throwing on a malformed payload', () => {
    // This is chrome on every page: one editor's bad payload must not take the whole site down.
    expect(contactDetailsOf(section({ phone: 42 }))).toBeNull()
    expect(contactDetailsOf(section('not an object'))).toBeNull()
  })
})

describe('resolveHref', () => {
  const pages = ['/about', '/collection', '/collection/furniture']

  it('resolves a static route with no pages row', () => {
    // `/search` deliberately has no `pages` row — it is a query surface with nothing to edit — so
    // checking the database alone would report the site’s own search link as broken.
    expect(resolveHref('/search', [])).toBe('RESOLVED')
  })

  it('resolves a CMS path that is not a static route', () => {
    // The seven CATEGORY pages live under `/collection/[category]`, a route Phase 14 adds. They
    // are addressable now because a `pages` row carries the path.
    expect(resolveHref('/collection/furniture', pages)).toBe('RESOLVED')
  })

  it('reports a site-relative href that matches nothing', () => {
    // The failure this catches: a typo in a menu item, which renders perfectly and 404s on click.
    expect(resolveHref('/collektion', pages)).toBe('UNKNOWN')
  })

  it('reads the seed’s inert # as a heading rather than a broken link', () => {
    expect(resolveHref('#', pages)).toBe('HEADING')
  })

  it('does not judge another site’s URL', () => {
    expect(resolveHref('https://example.test/x', pages)).toBe('EXTERNAL')
    // `//host` looks relative and is not: a browser reads it as protocol-relative.
    expect(resolveHref('//example.test/x', pages)).toBe('EXTERNAL')
  })

  it('ignores a query string and a fragment', () => {
    // `/search?q=x` resolves iff `/search` does, and an anchor on a real page is not a mistake.
    expect(resolveHref('/search?q=table', [])).toBe('RESOLVED')
    expect(resolveHref('/about#studio', pages)).toBe('RESOLVED')
  })

  it('accepts a trailing slash, which Next resolves too', () => {
    expect(resolveHref('/about/', pages)).toBe('RESOLVED')
    expect(resolveHref('/', pages)).toBe('RESOLVED')
  })
})
