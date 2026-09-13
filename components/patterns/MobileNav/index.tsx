'use client'

import * as React from 'react'

import { Drawer } from '@/components/patterns/Drawer'
import { NavLink } from '@/components/patterns/NavLink'
import { IconButton } from '@/components/primitives/IconButton'
import { Stack } from '@/components/primitives/Stack'
import { cn } from '@/lib/ui/cn'
import type { MenuItem } from '@/lib/site/menu'

/**
 * The small-screen menu.
 *
 * IT TAKES ITS ITEMS AS PLAIN DATA, not as `children`. Unlike the mega menu, nothing in here is a
 * Server Component — the mobile menu is a list of links with no images — so passing the serialised
 * `MenuItem[]` across the boundary is both possible and better: the drawer can then render the
 * two-level structure itself rather than receiving a fixed tree it cannot reason about.
 *
 * THE ITEMS ARE `menu = 'MOBILE'` ROWS, NOT THE HEADER'S. Phase 09 seeded them as separate rows
 * that happen to match, precisely so that the day the owner wants a shorter menu on phones it is
 * an edit in Studio rather than a code change. Rendering the header's rows here would have made
 * that impossible while looking identical today.
 *
 * FOCUS IS TRAPPED HERE AND NOT IN THE MEGA MENU, and the difference is not an inconsistency. This
 * is a modal drawer over the page: everything behind it is inert, so focus escaping it would land
 * on controls a visitor cannot see. `Drawer` (Phase 02) owns the trap, the `Escape` handler, the
 * scrim and the focus restore; this component owns only what goes inside.
 */

const MenuGlyph = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
  </svg>
)

export type MobileNavProps = {
  readonly items: readonly MenuItem[]
  /** All four from `global_content`; the component contains no words of its own. */
  readonly openLabel: string
  readonly closeLabel: string
  readonly title: string
  readonly className?: string
}

export function MobileNav({
  items,
  openLabel,
  closeLabel,
  title,
  className,
}: MobileNavProps): React.ReactElement {
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
        side="right"
        title={title}
        // The panel is a list of destinations that names itself; a visible "Menu" heading above it
        // is a caption on a caption. Hidden, never dropped — `aria-modal` with no name gives a
        // screen-reader user a dialog called nothing.
        titleHidden
        closeLabel={closeLabel}
        returnFocusTo={triggerRef}
      >
        <Stack gap={4} as="ul" className="list-none">
          {items.map((item) => (
            <li key={item.id}>
              <NavLink
                href={item.href}
                target={item.target}
                onClick={() => setOpen(false)}
                className={cn(
                  /*
                   * 44px ROWS — §A5 asks for them in the drawer, and FEAT §48 asks for 44×44 on
                   * every control regardless of who asked.
                   *
                   * THEY WERE ~36px AND NOTHING CAUGHT IT. `py-1` on an 18px line is 36px, under
                   * the floor, on the one surface that is touch-only. The `/design-system` touch
                   * spec that should have found it selects `button, input, select, textarea` and
                   * NO ANCHORS — so a drawer built entirely from links was never measured. That
                   * selector gap is recorded in SESSION-STATE; this is the row it let through.
                   *
                   * `min-h-11` AND NOT `rv-hit-44`, which was the first attempt and was wrong
                   * here. The overlay grows a hit box without moving the text, which suits a
                   * control with room around it — but these rows stack, and the CHILD list below
                   * has no gap at all, so a 44px overlay on a 28px row would reach 8px into its
                   * neighbours and a tap near the boundary would open the wrong page. Overlapping
                   * targets are a worse defect than small ones. `Tabs` states the rule this
                   * follows: "the touch target is the row itself, so there is no overlay".
                   */
                  'flex min-h-11 items-center text-lg text-ink',
                  'transition-[color] duration-(--rv-duration-fast) ease-standard',
                  'hover:text-ink-accent focus-visible:text-ink-accent',
                )}
              >
                {item.label}
              </NavLink>

              {item.children.length > 0 ? (
                <ul className="mt-2 ml-4 list-none border-l border-line pl-4">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <NavLink
                        href={child.href}
                        target={child.target}
                        onClick={() => setOpen(false)}
                        className={cn(
                          // Same rule, and these rows need it most: `text-sm` with `py-1` is
                          // ~28px, the smallest target in the drawer, and this list sets no gap
                          // between its items — so the row must BE 44px rather than overlay one.
                          'flex min-h-11 items-center text-sm text-ink-secondary',
                          'transition-[color] duration-(--rv-duration-fast) ease-standard',
                          'hover:text-ink focus-visible:text-ink',
                        )}
                      >
                        {child.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </Stack>
      </Drawer>
    </>
  )
}
