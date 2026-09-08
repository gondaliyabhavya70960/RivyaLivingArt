import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * IconButton is a Button with no text (DESIGN_SYSTEM §7.2). Two things follow from that
 * and both are enforced here rather than left to the caller:
 *
 *   1. `aria-label` is REQUIRED, not optional. A control with no text content has no
 *      accessible name unless one is supplied, so the type makes forgetting it a compile
 *      error. The string itself comes from `global_content` (SEED §1) — this file, like
 *      every other component, contains no copy.
 *   2. The glyph is wrapped in an `aria-hidden` span, so an icon that arrived without its
 *      own `aria-hidden` still cannot leak into the accessible name and compete with the
 *      label.
 *
 * ICON CONTRACT — the icon arrives as `children`: an inline SVG, `stroke="currentColor"`,
 * `stroke-width="1.5"`. There is no icon font and no sprite sheet fetched at runtime, so
 * the glyph is in the server-rendered HTML and costs no request. The 20px box is applied
 * here (`*:size-5`) so the caller cannot get it wrong; colour and stroke stay with the
 * icon because `currentColor` is what lets one glyph serve all five variants.
 *
 * TOUCH TARGET — 44 × 44 at every size (§7, FEAT §48). `md` and `lg` are natively that
 * big; `sm` is a 36px box that earns its hit area from the `rv-hit-44` ::before overlay in
 * base.css rather than by growing, so a dense Studio toolbar still tolerates a thumb.
 */
export type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
export type IconButtonSize = 'sm' | 'md' | 'lg'

/**
 * The §7.1 variant table, which governs every button-shaped control. Button owns the same
 * five tones; §7.1 is the single source for both, so a change there changes both files.
 */
const VARIANT: Record<IconButtonVariant, string> = {
  primary: 'bg-surface-accent text-ink-on-accent hover:brightness-110',
  secondary: 'bg-transparent text-ink border border-line-strong hover:bg-surface-raised',
  ghost: 'bg-transparent text-ink-secondary hover:text-ink hover:bg-surface-raised',
  quiet: 'bg-surface-raised-2 text-ink hover:brightness-110',
  danger: 'bg-transparent text-state-danger border border-state-danger hover:bg-state-danger-soft',
}

/** Square boxes, because an icon has no label to make the control wider than it is tall. */
const SIZE: Record<IconButtonSize, string> = {
  sm: 'size-9 rv-hit-44',
  md: 'size-11',
  lg: 'size-13',
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * The accessible name. Mandatory: there is no text content for it to fall back to.
   * `title` alone is not a label (docs/ops/ACCESSIBILITY.md) and is not accepted here.
   */
  'aria-label': string
  variant?: IconButtonVariant
  size?: IconButtonSize
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', type = 'button', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // Defaults to "button" because an IconButton is overwhelmingly a toolbar, close or
      // row action; inside a form the implicit "submit" would fire the wrong thing. A
      // caller that means submit passes type explicitly.
      type={type}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-sm',
        // LIGHT (§4.2): paint properties only, one frame budget, no layout property.
        // duration-(--var) is the CSS-variable form; duration-[--var] emits a bare
        // `transition-duration: --rv-duration-fast`, which is invalid and silently
        // drops the transition. Do not "tidy" the parentheses into brackets.
        'transition-[color,background-color,border-color] duration-(--rv-duration-fast) ease-standard',
        // Never opacity: 0.5 — that drags the contrast ratio below the disabled exemption.
        'disabled:cursor-not-allowed disabled:text-ink-disabled disabled:border-line',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {/* 20px (§7.2). aria-hidden here rather than trusting the icon to carry it. */}
      <span aria-hidden="true" className="inline-flex shrink-0 items-center *:size-5">
        {children}
      </span>
    </button>
  )
})
