'use client'

import * as React from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * The suggestion list under the header search box.
 *
 * A `listbox` OF `option`s AND NOTHING ELSE. ARIA 1.2's combobox pattern requires the popup to
 * contain only options, so the group headings below are `role="presentation"` and the options carry
 * the group name in their own accessible text instead. A `<ul>` of `<li role="option">` with a
 * heading `<li>` in the middle reads as an option with no label to a screen reader, which is worse
 * than no grouping at all.
 *
 * THE ACTIVE OPTION IS NOT FOCUSED. Focus stays in the input for the whole interaction —
 * `aria-activedescendant` points at the active option and the input keeps receiving keystrokes.
 * Moving DOM focus into the list would mean every arrow key press re-announced the list and typing
 * would stop working, which is the most common way this pattern is got wrong.
 *
 * NO COPY OF ITS OWN. Every string is a prop resolved from `global_content` on the server.
 */

export interface SuggestionOption {
  readonly id: string
  readonly label: string
  /** Resolved group heading — already a string, never a key. */
  readonly group: string
  readonly href: string
}

export function Listbox({
  id,
  options,
  activeId,
  label,
  seeAllLabel,
  seeAllHref,
  onPick,
}: {
  readonly id: string
  readonly options: readonly SuggestionOption[]
  readonly activeId: string | null
  readonly label: string
  readonly seeAllLabel: string | null
  readonly seeAllHref: string
  readonly onPick: (href: string) => void
}): React.ReactElement {
  /**
   * Where a heading is drawn, computed BEFORE the JSX rather than by a variable the map mutates.
   *
   * The obvious version keeps a `lastGroup` local and reassigns it inside `.map()`. It reads
   * fine and it is a render-time mutation, which the React compiler rejects — correctly: with
   * concurrent rendering the same list can be rendered twice from one state, and the second pass
   * would start with `lastGroup` already at the end of the first. Options arrive already ordered
   * by group, so the boundary is just "differs from the one before it".
   */
  const rows = options.map((option, index) => ({
    option,
    heading: index === 0 || options[index - 1]?.group !== option.group ? option.group : null,
  }))

  return (
    <ul
      id={id}
      role="listbox"
      aria-label={label}
      className={cn(
        'absolute left-0 right-0 top-full z-40 mt-1 max-h-96 list-none overflow-y-auto',
        'border border-line bg-surface py-1 shadow-lg',
      )}
    >
      {rows.map(({ option, heading }) => {
        return (
          <React.Fragment key={option.id}>
            {heading === null ? null : (
              // `presentation` because a listbox may contain only options. The group name is
              // repeated into each option's accessible text below, which is what actually reaches
              // a screen-reader user.
              <li
                role="presentation"
                className="px-3 pb-1 pt-2 text-xs uppercase tracking-technical text-ink-secondary"
              >
                {heading}
              </li>
            )}
            <li
              id={option.id}
              role="option"
              aria-selected={option.id === activeId}
              aria-label={`${option.label}, ${option.group}`}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm text-ink',
                option.id === activeId && 'bg-surface-raised',
              )}
              // `onMouseDown`, not `onClick`: a click fires after blur, and blur closes the list,
              // so by the time the click arrived the option would no longer exist.
              onMouseDown={(event) => {
                event.preventDefault()
                onPick(option.href)
              }}
            >
              {option.label}
            </li>
          </React.Fragment>
        )
      })}

      {seeAllLabel === null ? null : (
        <li
          id={`${id}-see-all`}
          role="option"
          aria-selected={`${id}-see-all` === activeId}
          className={cn(
            'cursor-pointer border-t border-line px-3 py-2 text-sm text-ink-secondary',
            `${id}-see-all` === activeId && 'bg-surface-raised',
          )}
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(seeAllHref)
          }}
        >
          {seeAllLabel}
        </li>
      )}
    </ul>
  )
}
