'use client'

import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Tabs — the APG tabs pattern (DESIGN_SYSTEM §11, registry RC-203). One tab list, one
 * panel visible at a time, a roving tabindex, and an underline in `--rv-ink-accent` at
 * `--rv-border-emphasis`.
 *
 * ROVING TABINDEX IS THE WHOLE KEYBOARD MODEL. Exactly one tab is in the tab order — the
 * SELECTED one, `tabIndex={0}`; every other tab is `tabIndex={-1}`. `Tab` therefore enters
 * the widget once and leaves it once, however many tabs there are, which is the entire
 * point: a ten-tab strip must not cost a keyboard user ten `Tab` presses to walk past.
 * Movement inside the strip is `ArrowLeft`/`ArrowRight`, wrapping at both ends, with
 * `Home`/`End` jumping to the first and last. Those four keys `preventDefault()` so the
 * page does not scroll underneath the focus they just moved.
 *
 * MANUAL ACTIVATION IS THE DEFAULT, and it is a deliberate departure from the one line in
 * §11's table that reads "arrow keys move and activate". Automatic activation is hostile
 * the moment a panel costs anything to render — arrowing from the first tab to the fourth
 * mounts three panels nobody asked for, and on a slow device the focus ring outruns the
 * paint. So `ArrowLeft`/`ArrowRight` move focus, and `Enter` or `Space` activates. Both
 * come free from the `<button>` element; there is no key handler here for either, which is
 * one less thing to get wrong. §11's behaviour is still reachable — `activation="automatic"`
 * — for a strip of three cheap panels where following focus genuinely reads better.
 *
 * EVERY PANEL EXISTS; ONLY THE SELECTED ONE HAS CONTENT. `aria-controls` on a tab must
 * point at an element that is actually in the document, so all panels are rendered and the
 * unselected ones carry `hidden` (which removes them from the accessibility tree and from
 * find-in-page). Their CHILDREN are not rendered, so manual activation keeps the promise it
 * made above: an expensive panel is mounted when it is selected and not before. The empty
 * hidden div left behind costs nothing and keeps every `aria-controls` reference valid,
 * which is what an axe pass checks.
 *
 * PANELS ARE `tabIndex={-1}`, as §11 requires — "focusable as a group". That is a narrower
 * contract than APG's suggestion of `0` for a panel with no focusable content, and it is
 * the design system's call to make: the panel can be focused programmatically (by a
 * consumer that wants to send the reader into it) but never appears in the tab sequence.
 *
 * MOTION. The panel swap is `--rv-duration-instant` — nothing to implement, because
 * nothing animates. The indicator transitions colour over `--rv-duration-quick` (180ms),
 * which is the LIGHT class: §4.2 keeps colour changes under reduced motion because they
 * are not motion. The indicator is drawn per tab rather than as one bar that travels,
 * because a travelling bar has to be positioned from each tab's measured box and §4.2
 * permits no JS-measured pixels; the 180ms belongs to the colour instead.
 *
 * NO COPY (§2 rule 2). `label` — the tab list's accessible name — and every tab's label
 * and panel content arrive as data.
 */
export interface TabItem {
  /** Stable, unique, and free of whitespace: it seeds the tab and panel element ids. */
  id: string
  /** The tab's visible label, which is also its accessible name. */
  label: React.ReactNode
  /** Rendered into the panel, and only while this tab is the selected one. */
  content: React.ReactNode
  /**
   * Renders the native `disabled` attribute (§7: disabled controls use `disabled`, never
   * `pointer-events: none`, so they stay visible and the shape of the set stays legible).
   * A disabled tab is skipped by the arrow keys and can never become the selected one.
   */
  disabled?: boolean
}

export type TabsActivation = 'manual' | 'automatic'

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** In tab-strip order. An empty array renders nothing at all. */
  items: readonly TabItem[]
  /**
   * The tab list's accessible name — "Product details", "Studio sections". Required,
   * because a `tablist` with no name is an unlabelled group, and because the word itself
   * is copy and copy is always a prop.
   */
  label: string
  /** Controlled selection. Omit for an uncontrolled strip seeded by `defaultValue`. */
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
  /** `manual` (default) moves focus and waits for `Enter`/`Space`. See the note above. */
  activation?: TabsActivation
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { items, label, value, defaultValue, onValueChange, activation = 'manual', className, ...rest },
  ref,
) {
  const baseId = React.useId()
  const [uncontrolled, setUncontrolled] = React.useState<string | undefined>(defaultValue)
  // One node per tab, keyed by id rather than by index, so reordering `items` cannot leave
  // the arrow keys focusing the tab that used to be in that slot.
  const tabNodes = React.useRef(new Map<string, HTMLButtonElement>())

  const tabId = (id: string) => `${baseId}-tab-${id}`
  const panelId = (id: string) => `${baseId}-panel-${id}`

  // Only enabled tabs can be selected or focused, so they are the sequence the arrow keys
  // walk. Deriving it every render costs nothing and cannot go stale against `items`.
  const enabled = items.filter((item) => item.disabled !== true)
  const isControlled = value !== undefined
  const requested = isControlled ? value : uncontrolled
  // A value naming a tab that does not exist (or has since been disabled) falls back to the
  // first enabled tab rather than leaving the strip with nothing selected: a tab list where
  // no tab is selected has no tab in the tab order, and is unreachable by keyboard.
  const selectedId = enabled.some((item) => item.id === requested) ? requested : enabled[0]?.id

  function select(id: string) {
    // A controlled strip never moves on its own; the owner of the selection decides.
    if (!isControlled) setUncontrolled(id)
    onValueChange?.(id)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    const from = enabled.findIndex((item) => item.id === id)
    if (from < 0) return

    const last = enabled.length - 1
    let to: number
    switch (event.key) {
      case 'ArrowRight':
        to = from === last ? 0 : from + 1
        break
      case 'ArrowLeft':
        to = from === 0 ? last : from - 1
        break
      case 'Home':
        to = 0
        break
      case 'End':
        to = last
        break
      default:
        return
    }

    const next = enabled[to]
    if (!next) return
    // Only now, once the key is known to be one we handle: swallowing every key here would
    // take Enter and Space away from the button underneath.
    event.preventDefault()
    tabNodes.current.get(next.id)?.focus()
    if (activation === 'automatic') select(next.id)
  }

  if (items.length === 0) return null

  return (
    <div ref={ref} className={className} {...rest}>
      <div
        role="tablist"
        aria-label={label}
        // The strip scrolls rather than wraps below the point where it stops fitting
        // (§11, RC-203 mobile behaviour). Arrow-key movement calls focus(), and focus()
        // scrolls its target into view, so the selected tab brings itself back on screen
        // without a scroll calculation of ours.
        className="flex items-center gap-1 overflow-x-auto border-b border-line snap-x"
      >
        {items.map((item) => {
          const isSelected = item.id === selectedId
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabNodes.current.set(item.id, node)
                else tabNodes.current.delete(item.id)
              }}
              type="button"
              role="tab"
              id={tabId(item.id)}
              aria-selected={isSelected}
              aria-controls={panelId(item.id)}
              // The roving tabindex. Exactly one 0 in the strip, always.
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              onKeyDown={(event) => handleKeyDown(event, item.id)}
              className={cn(
                // min-h-11 is 44px: the touch target is the row itself, so there is no
                // rv-hit-44 overlay to reconcile with the neighbouring tab's box.
                'flex min-h-11 shrink-0 snap-start items-center px-4 text-sm font-medium',
                'whitespace-nowrap border-b-2',
                // LIGHT (§4.2): colour and border-colour only, never a layout property.
                // duration-(--var) is the CSS-variable form; duration-[--var] emits a bare
                // `transition-duration: --rv-duration-quick`, which is invalid and silently
                // drops the transition. Do not "tidy" the parentheses into brackets.
                'transition-[color,border-color] duration-(--rv-duration-quick) ease-standard',
                // Selection is carried by the underline as well as by the ink step from
                // secondary to primary, never by the accent colour alone (WCAG 1.4.1):
                // the border is a shape, and a shape survives a reader who cannot
                // separate the two inks.
                isSelected
                  ? 'border-ink-accent text-ink'
                  : 'border-transparent text-ink-secondary hover:text-ink',
                // Never opacity: 0.5 — that drags the contrast below the §2.6 exemption.
                'disabled:cursor-not-allowed disabled:border-transparent disabled:text-ink-disabled',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {items.map((item) => {
        const isSelected = item.id === selectedId
        return (
          <div
            key={item.id}
            role="tabpanel"
            id={panelId(item.id)}
            aria-labelledby={tabId(item.id)}
            tabIndex={-1}
            hidden={!isSelected}
            className="pt-6"
          >
            {isSelected ? item.content : null}
          </div>
        )
      })}
    </div>
  )
})
