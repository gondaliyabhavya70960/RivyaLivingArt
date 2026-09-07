import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Cluster is the horizontal counterpart to Stack: a row of things of unknown number and
 * unknown width — chips, meta items, a pair of buttons — that WRAPS rather than truncates
 * or scrolls. The wrap is the whole point: §9's card anatomy ends in a meta row of up to
 * three material chips, and RC-217's mobile rule is that at 360px that row takes a second
 * line rather than truncating a material name. A row that could not wrap would have to
 * break that rule to fit.
 *
 * The same one gap applies on both axes, so wrapped lines are separated by the same step
 * as the items in them.
 *
 * `align` is the cross axis and defaults to `center`, which is what a row of mixed
 * heights — a 44px button beside a line of text — needs to look deliberate. `baseline` is
 * for a row of text of different sizes, where the letters should sit on one line rather
 * than the boxes being centred on one another.
 *
 * See Stack for why `gap` is a union of the §5.1 steps rather than a number, why each
 * class name is written out in full, and why `ul` alone gets an explicit `role` while an
 * `ol` is left to render its own numbers.
 */
export type ClusterGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20
export type ClusterAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
export type ClusterJustify = 'start' | 'center' | 'end' | 'between'

export type ClusterElement = 'div' | 'ul' | 'ol' | 'li' | 'section' | 'article' | 'nav'

const GAP: Record<ClusterGap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12',
  16: 'gap-16',
  20: 'gap-20',
}

const ALIGN: Record<ClusterAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
}

const JUSTIFY: Record<ClusterJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
}

/** Only `ul`: see the note above on why an `ol` must keep its markers. */
const LIST_ELEMENTS = new Set<ClusterElement>(['ul'])

export interface ClusterProps extends React.HTMLAttributes<HTMLElement> {
  as?: ClusterElement
  /** A step on the §5.1 scale, applied to both the row and the column gap. */
  gap?: ClusterGap
  /** Cross-axis alignment of the items in a line. */
  align?: ClusterAlign
  /** Main-axis distribution. §7.10's submit row is the default, `start`. */
  justify?: ClusterJustify
}

export const Cluster = React.forwardRef<HTMLElement, ClusterProps>(function Cluster(
  { as = 'div', gap = 3, align = 'center', justify = 'start', className, children, ...rest },
  ref,
) {
  const Tag = asTag(as)
  return (
    <Tag
      ref={ref}
      role={LIST_ELEMENTS.has(as) ? 'list' : undefined}
      className={cn('flex flex-wrap', GAP[gap], ALIGN[align], JUSTIFY[justify], className)}
      {...rest}
    >
      {children}
    </Tag>
  )
})
