import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Container is the width constraint of DESIGN_SYSTEM §5.3: one of four measured maxima,
 * centred, with the fluid gutter as inline padding. Full-bleed is a `full` container —
 * never a negative margin, which is why there is no `bleed` prop to reach for.
 *
 * WHY THE TWO SIZES ARE INLINE STYLE AND NOT A UTILITY. Both values are tokens, and both
 * are read straight from the token layer, which is what §1 asks of a component. Neither
 * has a usable bridged utility:
 *
 *   - `--rv-gutter` is a clamp() with no `@theme` entry, so no `px-*` utility resolves to
 *     it, and `px-[...]` is an arbitrary value that check-tokens.mjs rejects on sight.
 *   - `max-w-*` LOOKS available — globals.css bridges `--container-prose|default|wide|
 *     full` — but Tailwind ships its own `prose` container value and wins: `max-w-prose`
 *     compiles to `max-width: 65ch`, not the 44rem §5.3 fixes. A container that is 65
 *     characters of whatever font happens to be resolved is not the token, and the bug
 *     would be invisible until someone measured a journal column.
 *
 * So the four widths come from one map of token references, which also keeps `prose` and
 * `full` honest rather than one of them silently landing on a Tailwind default.
 *
 * A caller's `style` is merged last and therefore wins, the same way their `className`
 * comes last in the class list.
 */
export type ContainerSize = 'prose' | 'default' | 'wide' | 'full'

export type ContainerElement = 'div' | 'section' | 'article' | 'main' | 'header' | 'footer' | 'nav'

/** §5.3. `full` is 120rem — a bounded full-bleed band, not `100%`. */
const MAX_INLINE_SIZE: Record<ContainerSize, string> = {
  prose: 'var(--rv-container-prose)',
  default: 'var(--rv-container-default)',
  wide: 'var(--rv-container-wide)',
  full: 'var(--rv-container-full)',
}

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  as?: ContainerElement
  /** §5.3: prose 44rem, default 75rem, wide 90rem, full 120rem. */
  size?: ContainerSize
}

export const Container = React.forwardRef<HTMLElement, ContainerProps>(function Container(
  { as = 'div', size = 'default', className, style, children, ...rest },
  ref,
) {
  const Tag = asTag(as)
  return (
    <Tag
      ref={ref}
      className={cn('mx-auto', className)}
      style={{
        maxInlineSize: MAX_INLINE_SIZE[size],
        paddingInline: 'var(--rv-gutter)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
})
