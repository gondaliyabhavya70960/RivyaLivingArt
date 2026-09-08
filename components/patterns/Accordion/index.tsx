'use client'

import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Accordion — the APG accordion pattern (DESIGN_SYSTEM §11, registry RC-204). A stack of
 * headers, each a real `<button>` inside the heading level the block declares, each with
 * `aria-expanded` and `aria-controls` pointing at the region it owns.
 *
 * THE HEADING LEVEL IS A PROP, NOT A LOOK. §3.5 and Phase 41 both insist the DOM outline
 * is the outline the content declares: an accordion inside an `h2` section renders `h3`
 * headers, and the same component inside an `h3` renders `h4`. The heading element carries
 * no text of its own — the button inside it does, which is what makes the button's label
 * the heading's accessible name and lets a screen reader's heading list double as the
 * accordion's table of contents.
 *
 * COLLAPSE WITHOUT MEASUREMENT. FORM class (§4.2): `grid-template-rows: 0fr → 1fr` over
 * `--rv-duration-base` on `--rv-ease-out`, with the child clipped by `overflow: hidden`.
 * No JavaScript reads a height, so there is no layout thrash, no CLS, and no
 * `max-height: 9999px` guess to be wrong about. `1fr`/`0fr` are the two values grid needs;
 * they are neither a colour nor a pixel and so belong in `style`, not in an arbitrary
 * Tailwind value the token gate would (rightly) reject.
 *
 * `motion-reduce:transition-none` IS THE STATIC BRANCH HERE, and it is safe in a way it
 * would not be for an entrance. A `Reveal` whose transition is suppressed is stranded at
 * `opacity: 0` forever, which is why RC-207 branches in JavaScript. This collapse has no
 * such trap: both ends of the transition are complete, legible states, so suppressing the
 * transition lands the panel open or closed instantly — exactly what §4.3 asks for — with
 * no `useReducedMotion` subscription to pay for.
 *
 * CONTENT STAYS IN THE DOM, AND STAYS OUT OF THE ACCESSIBILITY TREE. RC-204 requires FAQ
 * answers to be present whether or not their panel is open, so that browser find-in-page
 * can reach them. `hidden` would satisfy the accessibility half and break that half, so a
 * collapsed region is marked `inert` instead: inert content is not focusable and is not
 * exposed to assistive technology, while remaining real DOM that the page can search. The
 * zero-height grid row plus `overflow: hidden` does the visual half.
 *
 * ROLE="REGION" IS RATIONED. APG's own note says to avoid the `region` role where it
 * would proliferate landmarks — roughly six panels. Beyond that the panels keep their
 * `aria-labelledby` relationship to the header and drop the landmark role, because a
 * twenty-item FAQ that adds twenty entries to the landmark list has made the landmark
 * list useless.
 *
 * ARROW KEYS ARE APG'S OPTIONAL EXTRA, and they are here: `ArrowDown`/`ArrowUp` move
 * between headers, `Home`/`End` jump. They are additive — `Enter` and `Space` still toggle
 * from the `<button>` itself, and focus stays on the header after a toggle (§11), so
 * collapsing a panel never drops the keyboard somewhere else.
 */
export interface AccordionItem {
  /** Stable, unique, whitespace-free: it seeds the header and region element ids. */
  id: string
  /** The header's visible label, which is also the heading's accessible name. */
  header: React.ReactNode
  /** Rendered inside the region, open or closed — see the note on find-in-page above. */
  content: React.ReactNode
  /** Native `disabled` on the header: visible, not focusable, never toggled (§7). */
  disabled?: boolean
}

/** Level 1 is the page's own heading and can never be an accordion header. */
export type AccordionHeadingLevel = 2 | 3 | 4 | 5 | 6

export type AccordionMode = 'single' | 'multiple'

/** APG: avoid `role="region"` where it would proliferate landmarks. Roughly six. */
const REGION_LANDMARK_MAX = 6

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** In display order. An empty array renders nothing at all. */
  items: readonly AccordionItem[]
  /**
   * The DOM level of every header, from the surrounding outline. Required: there is no
   * sane default, and guessing one is how an outline acquires a hole.
   */
  headingLevel: AccordionHeadingLevel
  /**
   * `single` (default) closes the open panel when another opens; `multiple` lets any
   * number stand open. RC-204 makes single-open the rule below 768px to keep the list
   * scannable — that is the consumer's call, not this component's: reading the viewport
   * here would mean a client-side branch whose flip discards the reader's open panel.
   */
  mode?: AccordionMode
  /** Controlled open set. Omit for an uncontrolled accordion seeded by `defaultOpenIds`. */
  openIds?: readonly string[]
  defaultOpenIds?: readonly string[]
  onOpenChange?: (openIds: readonly string[]) => void
}

/** 20px, decorative, `currentColor`, stroke 1.5 — the §7.2 icon language. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'size-5 shrink-0',
        // LIGHT-weight companion to the FORM collapse: rotation only, no layout property.
        'transition-transform duration-(--rv-duration-base) ease-out-expo',
        'motion-reduce:transition-none',
        open && 'rotate-180',
      )}
    >
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  )
}

export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(function Accordion(
  {
    items,
    headingLevel,
    mode = 'single',
    openIds,
    defaultOpenIds,
    onOpenChange,
    className,
    ...rest
  },
  ref,
) {
  const baseId = React.useId()
  const [uncontrolled, setUncontrolled] = React.useState<readonly string[]>(defaultOpenIds ?? [])
  const headerNodes = React.useRef(new Map<string, HTMLButtonElement>())

  const headerId = (id: string) => `${baseId}-header-${id}`
  const regionId = (id: string) => `${baseId}-region-${id}`

  const isControlled = openIds !== undefined
  const requested = isControlled ? openIds : uncontrolled
  // `single` is enforced on the way IN as well as on the way out, so a caller that seeds
  // two ids into a single-open accordion gets one open panel rather than a mode the
  // component silently stopped honouring.
  const open = mode === 'single' ? requested.slice(0, 1) : requested

  function toggle(id: string) {
    const wasOpen = open.includes(id)
    const next =
      mode === 'single'
        ? wasOpen
          ? []
          : [id]
        : wasOpen
          ? open.filter((openId) => openId !== id)
          : [...open, id]

    if (!isControlled) setUncontrolled(next)
    onOpenChange?.(next)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    const enabled = items.filter((item) => item.disabled !== true)
    const from = enabled.findIndex((item) => item.id === id)
    if (from < 0) return

    const last = enabled.length - 1
    let to: number
    switch (event.key) {
      case 'ArrowDown':
        to = from === last ? 0 : from + 1
        break
      case 'ArrowUp':
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
    // Only for the keys handled here: Enter and Space belong to the button underneath.
    event.preventDefault()
    headerNodes.current.get(next.id)?.focus()
  }

  if (items.length === 0) return null

  const HeadingTag: `h${AccordionHeadingLevel}` = `h${headingLevel}`
  const landmark = items.length <= REGION_LANDMARK_MAX

  return (
    <div ref={ref} className={cn('flex flex-col', className)} {...rest}>
      {items.map((item) => {
        const isOpen = open.includes(item.id)
        return (
          <div key={item.id} className="border-b border-line">
            {/* `flex` on the heading so the button stretches across it, rather than `w-full`
                on the button. The original reason was a bug — `--container-full` was bridged
                into @theme, which redefined `w-full` as 120rem — and Phase 11 removed that
                bridge. This stays as it is because a stretched flex child cannot be wider than
                the row it sits in, whatever `w-full` resolves to. */}
            <HeadingTag className="flex">
              <button
                ref={(node) => {
                  if (node) headerNodes.current.set(item.id, node)
                  else headerNodes.current.delete(item.id)
                }}
                type="button"
                id={headerId(item.id)}
                aria-expanded={isOpen}
                aria-controls={regionId(item.id)}
                disabled={item.disabled}
                onClick={() => toggle(item.id)}
                onKeyDown={(event) => handleKeyDown(event, item.id)}
                className={cn(
                  // min-h-14 is 56px — RC-204's row height — and the whole row is the hit
                  // box, so there is no rv-hit-44 overlay to reconcile with it.
                  'flex min-h-14 grow items-center justify-between gap-4 py-2 text-left',
                  'text-base font-medium text-ink',
                  'transition-[color] duration-(--rv-duration-fast) ease-standard',
                  'hover:text-ink-accent',
                  'disabled:cursor-not-allowed disabled:text-ink-disabled',
                )}
              >
                {item.header}
                <Chevron open={isOpen} />
              </button>
            </HeadingTag>

            <div
              id={regionId(item.id)}
              role={landmark ? 'region' : undefined}
              // Declared whether or not the landmark role is: §11 wants the region
              // labelled by its header, and the relationship costs nothing to keep when
              // the role is withheld — it is what the role would have used.
              aria-labelledby={headerId(item.id)}
              // Present in the DOM for find-in-page; out of the accessibility tree and out
              // of the tab order while collapsed. See the note at the top of the file.
              inert={!isOpen}
              className={cn(
                'grid',
                'transition-[grid-template-rows] duration-(--rv-duration-base) ease-out-expo',
                'motion-reduce:transition-none',
              )}
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="pt-2 pb-6">{item.content}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
})
