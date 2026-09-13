import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StudioNav } from './StudioChrome'

/**
 * WHERE AM I — the question the Studio sidebar could not answer before Phase A.
 *
 * Every link was `Text tone="secondary"`, and nothing in the navigation carried `aria-current`;
 * only the Overview tabs did. In a tree of eight groups and fifty-odd leaves, the only signal of
 * position was the page's own `h1`. §3.2 of the implementation guide records it.
 *
 * THE LONGEST-PREFIX RULE IS THE PART WORTH TESTING. A detail route like
 * `/studio/catalog/products/some-id` must mark the PRODUCTS leaf, not `/studio` — a shortest-prefix
 * match would light up Overview on every page in the application, which is worse than no signal at
 * all because it is a confident wrong answer.
 */

const mockPathname = vi.fn<() => string>()
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname() }))

const nav = {
  home: { href: '/studio', label: 'Overview' },
  pinned: [{ href: '/studio/media/all', label: 'All media' }],
  pinnedHeading: 'Pinned',
  groups: [
    {
      id: 'catalog',
      label: 'Catalog',
      leaves: [
        { href: '/studio/catalog/products', label: 'Products' },
        { href: '/studio/catalog/categories', label: 'Categories' },
      ],
    },
  ],
} as const

function currentLabels(): string[] {
  return screen
    .getAllByRole('link')
    .filter((a) => a.getAttribute('aria-current') === 'page')
    .map((a) => a.textContent ?? '')
}

beforeEach(() => {
  mockPathname.mockReturnValue('/studio')
})

describe('StudioNav — the current leaf', () => {
  it('marks exactly the leaf you are on with aria-current', () => {
    mockPathname.mockReturnValue('/studio/catalog/products')
    render(<StudioNav {...nav} />)

    expect(currentLabels()).toEqual(['Products'])
  })

  it('marks the products leaf from a product detail route, not Overview', () => {
    mockPathname.mockReturnValue('/studio/catalog/products/00000000-0000-4000-8000-0000000000a1')
    render(<StudioNav {...nav} />)

    // The shortest-prefix answer would be Overview, on every page in the Studio.
    expect(currentLabels()).toEqual(['Products'])
  })

  it('marks Overview on /studio itself', () => {
    mockPathname.mockReturnValue('/studio')
    render(<StudioNav {...nav} />)

    expect(currentLabels()).toEqual(['Overview'])
  })

  /**
   * A pinned leaf and its group leaf are the SAME href, so a route that is both renders two links.
   * Both are correct to mark: they are two routes to one page, and marking only one would make the
   * other look inactive while you are standing on it.
   */
  it('marks a pinned route and its group entry together when they are the same href', () => {
    mockPathname.mockReturnValue('/studio/media/all')
    render(<StudioNav {...nav} />)

    expect(currentLabels()).toEqual(['All media'])
  })

  it('marks nothing on a route outside the rendered set', () => {
    mockPathname.mockReturnValue('/studio/operations/audit')
    render(<StudioNav {...nav} />)

    expect(currentLabels()).toEqual([])
  })
})

describe('StudioNav — touch targets', () => {
  /**
   * This list IS the navigation on a phone, inside the drawer. §9 of the guide puts every Studio
   * target at 44×44. Sized rather than overlaid, for the reason `MobileNav` records: the rows stack,
   * and a 44px overlay on a shorter row reaches into its neighbours.
   */
  it('gives every row a 44px minimum', () => {
    render(<StudioNav {...nav} />)

    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('min-h-11')
      expect(link.className).toContain('items-center')
    }
  })
})

describe('StudioNav — closing the drawer', () => {
  it('calls onNavigate when a link is followed, so the drawer does not sit over the new page', () => {
    const onNavigate = vi.fn()
    render(<StudioNav {...nav} onNavigate={onNavigate} />)

    screen.getByRole('link', { name: 'Products' }).click()

    expect(onNavigate).toHaveBeenCalled()
  })
})
