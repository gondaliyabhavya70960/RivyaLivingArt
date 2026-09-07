import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Breadcrumbs — `<nav>` + ordered list, the current page marked `aria-current="page"` and
 * rendered as text rather than a link (DESIGN_SYSTEM §8.4, registry RC-230). Built in
 * Phase 02 rather than Phase 10 because Phase 05's Studio shell needs a trail before the
 * public chrome exists; one implementation serves both surfaces.
 *
 * NO COPY — the `aria-label` on the nav is a required prop, not the word "Breadcrumb"
 * typed in here, and the root item's label ("Home", or whatever the site calls it) arrives
 * in `items` from `global_content` (SEED §1, D2). Every string a visitor or a screen
 * reader receives from this component came in as data.
 *
 * SEPARATORS — a drawn chevron, `aria-hidden`, never the structure. The ordered list is
 * what carries "this is a trail and you are at position n of m"; the chevron only tells a
 * sighted reader the same thing. Drawing it rather than typing a "/" also keeps this file
 * free of any character a visitor could read.
 *
 * THE LIST NEEDS `role="list"` — `display: flex` strips list semantics in Safari and
 * VoiceOver, and base.css only removes the markers from a list that declares the role. The
 * two go together; removing either breaks the other.
 *
 * BELOW 430px only the parent and the current page render (§8.4). That is done in CSS, not
 * in JavaScript: every ancestor above the parent is `hidden sm:flex`, so the server-rendered
 * HTML is complete, the full trail is in the markup for crawlers and for Phase 39's
 * `BreadcrumbList`, and nothing re-flows when the bundle arrives. The separator lives
 * inside the item it follows, so a dropped ancestor takes its separator with it and the
 * mobile trail never opens with a stray chevron.
 *
 * COLOUR — `text-sm` / `--rv-ink-tertiary` for the whole trail (§8.4), which is why the
 * links are not `TextLink`: that primitive is `--rv-ink-accent` by contract. The current
 * page is distinguished from its ancestors by weight and by the absence of an underline,
 * never by colour alone (WCAG 1.4.1).
 */
export interface BreadcrumbItem {
  /** The visible label. Content, so it arrives as data — see the note above. */
  label: string
  /**
   * The item's own URL. Required on every item, including the last: the last one is not
   * rendered as a link, but Phase 39's `BreadcrumbList` needs a URL for each position and
   * a trail that cannot supply one for the current page is an incomplete trail.
   */
  href: string
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Root first, current page last. An empty array renders nothing at all — an empty
   * landmark is noise in the landmark list, not an empty state.
   */
  items: readonly BreadcrumbItem[]
  /** The nav's accessible name. Required: the word is copy and copy is never in a component. */
  'aria-label': string
}

/** 12px, decorative, and the same stroke language as every other glyph in the system. */
function Separator() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3 shrink-0"
    >
      <path d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  )
}

export const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(function Breadcrumbs(
  { items, className, ...rest },
  ref,
) {
  if (items.length === 0) return null

  const lastIndex = items.length - 1

  return (
    <nav ref={ref} className={cn('text-sm text-ink-tertiary', className)} {...rest}>
      <ol role="list" className="flex items-center gap-2">
        {items.map((item, index) => {
          const isCurrent = index === lastIndex
          // The parent is the only ancestor that survives below 430px (§8.4).
          const isDroppedOnMobile = index < lastIndex - 1

          return (
            <li
              key={item.href}
              className={cn(
                'items-center gap-2',
                isDroppedOnMobile ? 'hidden sm:flex' : 'flex',
              )}
            >
              {isCurrent ? (
                // Not a link: the current page has nowhere to navigate to, and a link that
                // reloads the page the user is already on is a defect (§8.4).
                <span aria-current="page" className="font-medium">
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  // rv-hit-44 gives the 44px hit box (§7) without growing the text; the
                  // separator's own width keeps two adjacent boxes from overlapping.
                  className={cn(
                    'rv-hit-44 inline-flex items-center underline decoration-1',
                    'hover:text-ink hover:decoration-2',
                    'transition-[color,text-decoration-thickness] duration-[--rv-duration-fast] ease-standard',
                  )}
                >
                  {item.label}
                </a>
              )}
              {isCurrent ? null : <Separator />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
})
