import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MobileNav } from '@/components/patterns/MobileNav'
import type { MenuItem } from '@/lib/site/menu'

/**
 * THE DRAWER'S ROWS ARE 44px TALL, and they were not.
 *
 * §A5 asks for 44px rows in the mobile drawer; FEAT §48 asks for 44×44 on every control whoever
 * asked. Both rows here were `py-1` — about 36px at the top level and about 28px for a category —
 * on the one surface of the site that is touch-only.
 *
 * WHY NOTHING CAUGHT IT, which is the more useful half. The `/design-system` touch spec measures
 * `button, input, select, textarea` and no anchors, so a drawer built entirely from links fell
 * outside its selector even though its own docstring says block links are checked. That gap is
 * recorded in SESSION-STATE as a named follow-up.
 *
 * WHAT THIS TEST CAN AND CANNOT DO. jsdom computes no layout — `getBoundingClientRect` is zero for
 * everything — so a real height cannot be measured here and this asserts the CLASS that produces
 * it. That is weaker than the browser assertion this deserves and stronger than nothing: it fails
 * the moment someone puts `py-1` back, which is the regression that actually happened. The real
 * measurement belongs in `tests/e2e/touch.spec.ts`, where the drawer is already opened at 390px.
 */

const items: readonly MenuItem[] = [
  {
    id: 'collection',
    label: 'Collection',
    href: '/collection',
    target: '_self',
    children: [
      {
        id: 'furniture',
        label: 'Furniture',
        href: '/collection/furniture',
        target: '_self',
        children: [],
      },
    ],
  },
]

function open() {
  return render(
    <MobileNav items={items} openLabel="Open menu" closeLabel="Close menu" title="Menu" />,
  )
}

describe('MobileNav — touch target size', () => {
  it('gives every drawer row a 44px minimum, top level and category alike', async () => {
    open()
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    const top = screen.getByRole('link', { name: 'Collection' })
    const child = screen.getByRole('link', { name: 'Furniture' })

    for (const row of [top, child]) {
      // `min-h-11` is 44px. `flex items-center` is what centres the text inside the taller row.
      expect(row.className).toContain('min-h-11')
      expect(row.className).toContain('items-center')
      // The height this replaced. A bare `py-1` row is the defect.
      expect(row.className).not.toMatch(/\bpy-1\b/)
    }
  })

  /**
   * `rv-hit-44` WOULD HAVE BEEN WRONG HERE, and the reason is worth pinning so it is not
   * "simplified" back later. The overlay grows a hit box without moving the text, which suits a
   * control with space around it — but the category list sets no gap between its items, so a 44px
   * overlay on a 28px row reaches 8px into each neighbour and a tap near the boundary opens the
   * wrong page. Overlapping targets are a worse defect than small ones.
   */
  it('sizes the row itself rather than overlaying a hit box that would collide', async () => {
    open()
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('link', { name: 'Furniture' }).className).not.toContain('rv-hit-44')
  })
})
