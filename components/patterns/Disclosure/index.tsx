'use client'

import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Disclosure — the APG disclosure pattern (DESIGN_SYSTEM §11, registry RC-206). One
 * button carrying `aria-expanded`, one region it controls. It is the single-region form of
 * `Accordion` (RC-204), and the footer's collapsed columns (§8.5), the filter rail's facet
 * groups (§12.1) and the mobile nav's category list (§8.3) are all this component.
 *
 * It exists separately from `Accordion` rather than as a one-item accordion because the
 * two answer different questions. An accordion coordinates a SET — one member open, or
 * several — and owns a heading level for the outline. A disclosure coordinates nothing:
 * there is no set, no exclusivity to enforce, and the trigger is frequently not a heading
 * at all. Collapsing them into one component would mean every footer column carrying an
 * `items` array of length one and a heading level it does not want.
 *
 * SAME COLLAPSE AS RC-204: FORM class (§4.2), `grid-template-rows: 0fr → 1fr` over
 * `--rv-duration-base`, `overflow: hidden` on the clipped child, no measured height.
 * `motion-reduce:transition-none` is the static branch, and it is safe here for the same
 * reason it is safe there — both ends of the transition are complete states, so a
 * suppressed transition lands open or closed rather than stranding anything half-drawn.
 *
 * The collapsed region is `inert`: still in the DOM so find-in-page can reach it, out of
 * the accessibility tree and out of the tab order while it is closed.
 *
 * FOCUS STAYS ON THE TRIGGER (§11). Nothing here moves it — there is no `focus()` call in
 * this file — so activating the trigger toggles the region and leaves the keyboard exactly
 * where the reader put it.
 *
 * `role="region"` IS OPT-IN, not the default, and that is APG's advice rather than a
 * shortcut: a landmark is worth having for a footer column a reader may want to jump to,
 * and is noise when six filter groups each add one. `landmark` turns it on, and only then
 * is the region named by the trigger.
 *
 * NO COPY (§2 rule 2): `label` is the trigger's content and arrives as data.
 */
export interface DisclosureProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The trigger's visible content, which is also its accessible name. */
  label: React.ReactNode
  /** Controlled state. Omit for an uncontrolled disclosure seeded by `defaultOpen`. */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Adds `role="region"`, named by the trigger. See the note above before turning it on. */
  landmark?: boolean
  /** The revealed content. Present in the DOM whether the region is open or closed. */
  children: React.ReactNode
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
        'transition-transform duration-(--rv-duration-base) ease-out-expo',
        'motion-reduce:transition-none',
        open && 'rotate-180',
      )}
    >
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  )
}

export const Disclosure = React.forwardRef<HTMLDivElement, DisclosureProps>(function Disclosure(
  {
    label,
    open,
    defaultOpen = false,
    onOpenChange,
    landmark = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  const baseId = React.useId()
  const triggerId = `${baseId}-trigger`
  const regionId = `${baseId}-region`

  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : uncontrolled

  function handleClick() {
    // A controlled disclosure never moves on its own: the owner of the state decides,
    // which is what lets a filter rail keep its open groups in the URL.
    if (!isControlled) setUncontrolled(!isOpen)
    onOpenChange?.(!isOpen)
  }

  return (
    <div ref={ref} className={cn('flex flex-col', className)} {...rest}>
      {/* `flex` on the wrapper so the button stretches, rather than `w-full` on the button.
          The original reason was a bug — `--container-full` was bridged into @theme, which
          redefined `w-full` as 120rem — and Phase 11 removed that bridge, so `w-full` means
          100% again. This stays as it is because a stretched flex child is the better markup
          either way: it cannot be wider than the row it sits in, whatever `w-full` means. */}
      <div className="flex">
        <button
          type="button"
          id={triggerId}
          aria-expanded={isOpen}
          aria-controls={regionId}
          onClick={handleClick}
          className={cn(
            // 44px minimum touch target, earned by the row rather than by an overlay.
            'flex min-h-11 grow items-center justify-between gap-4 py-2 text-left',
            'text-base font-medium text-ink',
            // LIGHT (§4.2): colour only. duration-(--var) is the CSS-variable form;
            // duration-[--var] emits an invalid bare custom-property name and silently
            // drops the transition. Do not "tidy" the parentheses into brackets.
            'transition-[color] duration-(--rv-duration-fast) ease-standard',
            'hover:text-ink-accent',
          )}
        >
          {label}
          <Chevron open={isOpen} />
        </button>
      </div>

      <div
        id={regionId}
        role={landmark ? 'region' : undefined}
        // Declared whether or not the landmark role is, as in RC-204: the relationship is
        // what the role would have used, and it costs nothing to keep when it is withheld.
        aria-labelledby={triggerId}
        inert={!isOpen}
        className={cn(
          'grid',
          'transition-[grid-template-rows] duration-(--rv-duration-base) ease-out-expo',
          'motion-reduce:transition-none',
        )}
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pt-2 pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
})
