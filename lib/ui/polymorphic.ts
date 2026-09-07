import type * as React from 'react'

/**
 * A JSX tag type that accepts an `HTMLElement` ref.
 *
 * React types `ref` per intrinsic element, and a union of intrinsic elements does not
 * unify those ref types: rendering `<Tag ref={ref}>` where `Tag` is
 * `'div' | 'section' | 'ul'` asks for a ref that is simultaneously an `HTMLDivElement`,
 * an `HTMLElement` and an `HTMLLIElement` — an intersection nothing satisfies.
 *
 * Every element in our polymorphic unions IS an `HTMLElement`, so narrowing the JSX type
 * to one that accepts an `HTMLElement` ref is sound. The cast is confined here rather
 * than repeated at four call sites, and each component's own props stay fully typed at
 * its public boundary — `as` is still restricted to its declared union.
 */
export type PolymorphicTag = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>
>

export function asTag(as: React.ElementType): PolymorphicTag {
  return as as unknown as PolymorphicTag
}
