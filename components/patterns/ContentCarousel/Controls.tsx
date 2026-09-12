'use client'

import * as React from 'react'

/**
 * The carousel's arrows — RC-222's whole client cost, and nothing else is one.
 *
 * IT ENHANCES A ROW THAT ALREADY WORKS. The scroller is a Server Component with `tabIndex={0}`, so
 * it scrolls with a finger, a trackpad, a scrollbar and the arrow keys before this module has been
 * fetched. If it never loads, the row is a row. That is what §7.18 means by "controls are
 * progressive enhancement", and it is why this file may be lazy without a fallback.
 *
 * NO ARROWS BELOW 768px (§7.18). A thumb is a better control than a pair of 44px buttons, and the
 * buttons would sit on top of the content they are scrolling. `hidden md:flex` rather than a
 * `matchMedia` read, so the decision is made before hydration and never flickers.
 *
 * IT FINDS THE SCROLLER RATHER THAN OWNING IT. The list is rendered on the server; passing a ref
 * across that boundary is not a thing, so the controls look up `[data-carousel-scroller]` inside
 * their own carousel root. Scoped to the root, not the document: a page may hold several rows.
 *
 * THE DISABLED STATE IS OBSERVED, NOT ASSUMED. A row narrower than its container cannot scroll at
 * all, and both buttons must say so; a row scrolled to its end must disable one. Read from
 * `scrollLeft`, `scrollWidth` and `clientWidth` on scroll and on resize, with a 1px tolerance
 * because sub-pixel layout makes the end an approximation.
 *
 * REDUCED MOTION IS HONOURED BY THE JUMP, NOT BY THE DISTANCE. `behavior: 'smooth'` becomes
 * `'auto'`, so the row still moves by exactly one card — a reader who has asked for less movement
 * asked for less ANIMATION, not for a control that does less.
 */

const TOLERANCE = 1

function Chevron({ back }: { readonly back: boolean }): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d={back ? 'M12.5 4 7 10l5.5 6' : 'M7.5 4 13 10l-5.5 6'} />
    </svg>
  )
}

export type CarouselControlsProps = {
  readonly previousLabel: string
  readonly nextLabel: string
}

export function CarouselControls({
  previousLabel,
  nextLabel,
}: CarouselControlsProps): React.ReactElement {
  const anchor = React.useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = React.useState(true)
  const [atEnd, setAtEnd] = React.useState(true)

  const scroller = React.useCallback((): HTMLElement | null => {
    const root = anchor.current?.closest('[data-carousel]') ?? null
    return root?.querySelector<HTMLElement>('[data-carousel-scroller]') ?? null
  }, [])

  React.useEffect(() => {
    const element = scroller()
    if (element === null) return

    const read = (): void => {
      const max = element.scrollWidth - element.clientWidth
      setAtStart(element.scrollLeft <= TOLERANCE)
      setAtEnd(element.scrollLeft >= max - TOLERANCE)
    }

    read()
    element.addEventListener('scroll', read, { passive: true })
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', read)
      observer.disconnect()
    }
  }, [scroller])

  const move = (direction: 1 | -1): void => {
    const element = scroller()
    if (element === null) return
    // One card, measured from the DOM rather than assumed: the basis changes at two breakpoints.
    const item = element.querySelector<HTMLElement>('[data-carousel-item]')
    const step = item === null ? element.clientWidth : item.getBoundingClientRect().width
    const gap = Number.parseFloat(getComputedStyle(element).columnGap || '0') || 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollBy({ left: direction * (step + gap), behavior: reduced ? 'auto' : 'smooth' })
  }

  const buttonClass = [
    'inline-flex size-11 items-center justify-center rounded-full',
    'border border-line bg-surface text-ink',
    'transition-[color,border-color,opacity] duration-(--rv-duration-fast) ease-standard',
    'hover:border-(--rv-ink-accent) hover:text-ink-accent',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--rv-ink-accent)',
    'disabled:pointer-events-none disabled:opacity-40',
    'motion-reduce:transition-none',
  ].join(' ')

  return (
    <div ref={anchor} className="mt-4 hidden justify-end gap-2 md:flex">
      <button
        type="button"
        aria-label={previousLabel}
        disabled={atStart}
        onClick={() => move(-1)}
        className={buttonClass}
      >
        <Chevron back />
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        disabled={atEnd}
        onClick={() => move(1)}
        className={buttonClass}
      >
        <Chevron back={false} />
      </button>
    </div>
  )
}
