import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * TextLink renders <a>. Button renders <button>. There is no `as` prop blurring the two
 * (DESIGN_SYSTEM §7.1) — a control that navigates is a link, and a link that does not
 * navigate is a defect, not a variant.
 *
 * UNDERLINE — 1px, thickening to 2px on hover, and it is NOT removable. There is no
 * `underline={false}` prop and no class a caller can pass to take it away, because colour
 * alone is not a permitted affordance for a link inside a block of text (WCAG 1.4.1).
 * `className` is appended, so a caller can add spacing; a caller who adds `no-underline`
 * has removed an accessibility guarantee and that shows up in review, not in the types.
 *
 * The 0.18em `text-underline-offset` is inherited from the `a` rule in base.css rather
 * than re-declared here: 0.18em is not on the Tailwind offset scale, and an arbitrary
 * value would bypass the token layer that `check-tokens.mjs` guards.
 *
 * COLOUR — `text-ink-accent`, and the component never asks which surface it is on. Inside
 * a `--rv-surface-raised-2` element on a DEEP section that token has already stepped up
 * from champagne (4.24, UI only) to gold-bright (5.35, AA) by the scheme.css rule in
 * §2.11. The link inherits the compliant value and must not re-declare it.
 *
 * TOUCH TARGET — an inline link is the one control in §7 that does not get a 44px box.
 * WCAG 2.5.8 exempts a target "in a sentence or its size is otherwise constrained by the
 * line-height of non-target text", and forcing 44px here would either break the prose
 * line rhythm or overlap the hit boxes of two links in the same paragraph. A link that
 * stands alone as a call to action is a Button-styled anchor, not this component.
 *
 * EXTERNAL — the trailing glyph is drawn, not fetched, and the "opens in a new tab"
 * sentence lives in `global_content` (SEED §1). This component therefore takes the *id* of
 * the element rendering that sentence, never the sentence itself, and the type makes the
 * id mandatory whenever `external` is set: an external link that announces nothing is the
 * failure this pairing exists to prevent.
 */
type TextLinkExternal =
  | { external?: false; externalHintId?: never }
  | { external: true; externalHintId: string }

export type TextLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & TextLinkExternal

export const TextLink = React.forwardRef<HTMLAnchorElement, TextLinkProps>(function TextLink(
  {
    external = false,
    externalHintId,
    className,
    children,
    target,
    rel,
    'aria-describedby': describedBy,
    ...rest
  },
  ref,
) {
  // Never discard a description the caller already had — a link may carry both the
  // new-tab note and, say, a file-size note. Space-joined, in caller-first order.
  const description = [describedBy, external ? externalHintId : undefined]
    .filter((token): token is string => Boolean(token))
    .join(' ')

  return (
    <a
      ref={ref}
      // Defaults, not locks: a caller with a reason passes its own target or rel.
      target={target ?? (external ? '_blank' : undefined)}
      rel={rel ?? (external ? 'noopener noreferrer' : undefined)}
      aria-describedby={description === '' ? undefined : description}
      className={cn(
        'text-ink-accent underline decoration-1 hover:decoration-2',
        // LIGHT (§4.2): the underline thickens as a paint change, not a layout change.
        'transition-[text-decoration-thickness] duration-[--rv-duration-fast] ease-standard',
        className,
      )}
      {...rest}
    >
      {children}
      {external ? (
        <svg
          // 12px (§7.3), decorative: the fact that the link opens a new tab is carried to
          // assistive tech by aria-describedby, not by this glyph.
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ms-1 inline-block size-3 align-baseline"
        >
          <path d="M4.5 2.5h5v5" />
          <path d="M9.5 2.5 2.5 9.5" />
        </svg>
      ) : null}
    </a>
  )
})
