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
 * AUTOMATIC ACTIVATION IS THE DEFAULT, because that is what §11's table and RC-203's
 * accessibility row both promise: "arrow keys move and activate". Selection follows focus,
 * so a keyboard reader walking the strip meets each panel as they arrive at its tab and
 * never has to learn a second key. `Enter` and `Space` activate too — both come free from
 * the `<button>` element, and there is no key handler here for either, which is one less
 * thing to get wrong. Where a panel is expensive enough that following focus would mount
 * work nobody asked for, `activation="manual"` moves focus and waits for `Enter`/`Space`;
 * APG sanctions both, and the cost of a panel is knowledge only the consumer has.
 *
 * EVERY PANEL EXISTS; ONLY THE SELECTED ONE HAS CONTENT. `aria-controls` on a tab must
 * point at an element that is actually in the document, so all panels are rendered and the
 * unselected ones carry `hidden` (which removes them from the accessibility tree and from
 * find-in-page). Their CHILDREN are not rendered, so an unvisited panel costs nothing until
 * it is selected — and under `activation="manual"` it costs nothing until it is chosen. The
 * empty hidden div left behind keeps every `aria-controls` reference valid, which is what an
 * axe pass checks.
 *
 * PANELS ARE `tabIndex={-1}`, as §11 requires — "focusable as a group". That is a narrower
 * contract than APG's suggestion of `0` for a panel with no focusable content, and it is
 * the design system's call to make: the panel can be focused programmatically (by a
 * consumer that wants to send the reader into it) but never appears in the tab sequence.
 *
 * MOTION. The panel swap is `--rv-duration-instant` — nothing to implement, because nothing
 * animates. The indicator is drawn per tab and transitions COLOUR over `--rv-duration-quick`
 * (180ms); it is not one bar that travels. §11 and RC-203 both describe it as sliding, and
 * that phrase cannot be honoured as written: a travelling bar is a `transform` driven by each
 * tab's measured box, while 180ms is `--rv-duration-quick`, which puts it in the LIGHT class,
 * and LIGHT permits colour, border, opacity and shadow and no transform at all (§4.2). The
 * colour transition is the branch that satisfies §4.2, so it is the one that ships; the word
 * "slides" in §11 and RC-203 is the half that wants amending, and neither file is this
 * component's to edit. RC-203's "indicator does not slide under reduced motion" is satisfied
 * a fortiori by an indicator that never slides, and §4.2 exempts colour from the reduced-motion
 * branch outright, so there is no second branch to render here.
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
  /**
   * `automatic` (default, per §11 and RC-203) selects whichever tab the arrow keys move to.
   * `manual` moves focus only and waits for `Enter`/`Space` — worth opting into when a panel
   * is expensive enough that following focus would mount work nobody asked for.
   */
  activation?: TabsActivation
  /**
   * How the selection is drawn beneath the strip.
   *
   * `static` (default) keeps the per-tab underline that transitions COLOUR — the §4.2 LIGHT
   * branch this component has always shipped, and the only branch that is correct without
   * JavaScript. **Every public route keeps it**, which is why it is the default rather than a
   * migration: `/product/[slug]` renders this component too, and a behaviour change there is a
   * change to the public site.
   *
   * `slide` draws ONE bar that travels to the selected tab. It is a `transform`, so it belongs
   * to §4.2's FORM class at `--rv-duration-base` rather than to LIGHT at `--rv-duration-quick`
   * — LIGHT permits colour, border, opacity and shadow and no transform at all, which is why
   * the original component argued a travelling bar could not be built and shipped the colour
   * branch instead. Amendment A51 places a selection indicator in FORM and this implements it.
   *
   * IT DEGRADES TO `static`, NOT TO NOTHING. The bar needs the selected tab's measured box, so
   * until the measurement lands — the server render, and a browser with JavaScript off — the
   * per-tab underline is what draws. The strip is therefore never without a selection shape,
   * which WCAG 1.4.1 requires: selection is carried by a shape and not by colour alone.
   */
  indicator?: 'static' | 'slide'
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  {
    items,
    label,
    value,
    defaultValue,
    onValueChange,
    activation = 'automatic',
    indicator = 'static',
    className,
    ...rest
  },
  ref,
) {
  const baseId = React.useId()
  const [uncontrolled, setUncontrolled] = React.useState<string | undefined>(defaultValue)
  // One node per tab, keyed by id rather than by index, so reordering `items` cannot leave
  // the arrow keys focusing the tab that used to be in that slot.
  const tabNodes = React.useRef(new Map<string, HTMLButtonElement>())
  const listNode = React.useRef<HTMLDivElement | null>(null)

  /**
   * The selected tab's box, in the strip's own coordinates, or null when it is not known yet.
   *
   * NULL IS A REAL STATE AND IT IS THE ONE THAT SHIPS FIRST. On the server there is no layout to
   * measure, so this is null through the whole server render and the strip draws the per-tab
   * underline — which is also what a browser with JavaScript off keeps forever. The travelling
   * bar is an enhancement layered on a strip that is already correct without it.
   */
  const [indicatorBox, setIndicatorBox] = React.useState<{ x: number; w: number } | null>(null)

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

  /**
   * Measure the selected tab, and re-measure whenever its box can have moved.
   *
   * `useLayoutEffect` RATHER THAN `useEffect`, so the bar is placed in the same frame the
   * selection changes and never renders one frame at the previous tab's position. It is chosen
   * through `EFFECT` below because this is a Client Component and React still renders it on the
   * server, where `useLayoutEffect` warns and does nothing useful.
   *
   * THE OBSERVER WATCHES BOTH THE TAB AND THE STRIP, and each for a different failure. The tab
   * itself changes width when its webfont swaps in — measure once at mount and the bar is sized
   * to the fallback face's metrics and stays there. The strip changes width on a viewport resize
   * and on the container query that makes it scroll, which moves every tab inside it without
   * changing any tab's own box.
   *
   * `offsetLeft` IS RELATIVE TO THE STRIP, which is `relative` and is also the element that
   * scrolls. So the bar scrolls with the tabs it is under and needs no scroll listener: a
   * position expressed in the scrolling content's coordinates is already correct at every
   * scroll offset.
   */
  const EFFECT = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect
  EFFECT(() => {
    if (indicator !== 'slide') return
    const node = selectedId === undefined ? undefined : tabNodes.current.get(selectedId)
    if (node === undefined) {
      setIndicatorBox(null)
      return
    }

    const measure = () => setIndicatorBox({ x: node.offsetLeft, w: node.offsetWidth })
    measure()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    const list = listNode.current
    if (list !== null) observer.observe(list)
    return () => observer.disconnect()
  }, [EFFECT, indicator, selectedId, items])

  /**
   * Slide only once there is a measurement WITH A WIDTH to slide to.
   *
   * `> 0` RATHER THAN `!== null`, AND A TEST FOUND THE DIFFERENCE. A measurement of zero is not
   * the absence of a measurement — it is what every box reports while the strip is inside a
   * `display: none` ancestor, before a webfont resolves, or in any environment that runs the
   * effect without laying anything out. Treating that as "measured" draws a bar scaled to
   * `scaleX(0)`, which is invisible, AND turns the per-tab underline transparent, which leaves
   * the strip with NO selection shape at all. Selection would then be carried by the ink step
   * alone, and WCAG 1.4.1 does not accept colour as the only channel.
   */
  const sliding = indicator === 'slide' && indicatorBox !== null && indicatorBox.w > 0

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
        ref={listNode}
        // `relative` so the travelling bar can be positioned in the strip's own coordinates,
        // which are also the coordinates the strip scrolls in. Harmless when it never slides.
        className="relative flex items-center gap-1 overflow-x-auto border-b border-line snap-x"
      >
        {/*
         * THE TRAVELLING BAR (§4.2 FORM, amendment A51). `w-px` with `scaleX` rather than a
         * measured `width`: width is a layout property and animating it would lay the strip out
         * every frame, which §4.2's third cross-cutting rule forbids outright. A 1px bar scaled
         * horizontally is one compositor transform, and there is no text inside it to distort.
         *
         * `aria-hidden` because selection is already announced by `aria-selected` on the tab;
         * a second announcement of the same fact is noise to a screen reader, and this element
         * carries no information a sighted reader gets either.
         *
         * `motion-reduce:transition-none` is the reduced-motion branch §4.2 requires of FORM:
         * the bar still moves to the right tab, it simply arrives there without travelling.
         */}
        {sliding ? (
          <span
            aria-hidden="true"
            data-rv-tab-indicator=""
            className={cn(
              'pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-ink-accent',
              'transition-transform duration-(--rv-duration-base) ease-out',
              'motion-reduce:transition-none',
            )}
            style={{ transform: `translateX(${indicatorBox.x}px) scaleX(${indicatorBox.w})` }}
          />
        ) : null}
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
                // While the bar is drawing, the per-tab border stays transparent: two
                // indicators under one strip reads as a rendering fault. The ink step from
                // secondary to primary still marks the selection in both branches.
                isSelected
                  ? cn(sliding ? 'border-transparent' : 'border-ink-accent', 'text-ink')
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
