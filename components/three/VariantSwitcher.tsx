'use client'

import * as React from 'react'

import { cn } from '@/lib/ui/cn'

export type VariantOption = { readonly key: string; readonly label: string }

/**
 * The finish switcher: a tab list whose panel is the canvas.
 *
 * ARROW KEYS MOVE AND SELECT, per the FEAT §12 table and the tabs pattern: one tab stop for the
 * list (roving tabindex), Left/Right and Home/End move focus and change the finish at once. A
 * model with a single finish renders no switcher — one tab is a label, not a choice.
 */
export function VariantSwitcher({
  options,
  active,
  onChange,
  label,
  controls,
}: {
  readonly options: readonly VariantOption[]
  readonly active: string | null
  readonly onChange: (key: string) => void
  readonly label: string
  /** The id of the stage the tabs control. */
  readonly controls: string
}): React.ReactElement | null {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  if (options.length < 2) return null

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === active),
  )

  const focusAndSelect = (index: number): void => {
    const next = (index + options.length) % options.length
    const option = options[next]
    if (option === undefined) return
    onChange(option.key)
    refs.current[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        event.stopPropagation()
        focusAndSelect(activeIndex + 1)
        return
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        event.stopPropagation()
        focusAndSelect(activeIndex - 1)
        return
      case 'Home':
        event.preventDefault()
        event.stopPropagation()
        focusAndSelect(0)
        return
      case 'End':
        event.preventDefault()
        event.stopPropagation()
        focusAndSelect(options.length - 1)
        return
      default:
        return
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      data-viewer-variants=""
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-(--rv-3d-control-gap)"
    >
      {options.map((option, index) => {
        const selected = index === activeIndex
        return (
          <button
            key={option.key}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={controls}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(option.key)
            }}
            className={cn(
              'min-h-(--rv-3d-control-size) rounded-sm border px-3 text-sm',
              'transition-[color,background-color,border-color] duration-(--rv-duration-fast)',
              selected
                ? 'border-(--rv-3d-hotspot) bg-(--rv-3d-surface-solid) text-(--rv-3d-ink)'
                : 'border-(--rv-3d-line) bg-(--rv-3d-surface) text-(--rv-3d-ink-muted) hover:text-(--rv-3d-ink)',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
