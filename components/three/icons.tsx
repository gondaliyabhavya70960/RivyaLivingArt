import * as React from 'react'

/**
 * The viewer's six glyphs. Decorative by construction — `IconButton` wraps its child in
 * `aria-hidden` and carries the name — so none has a title. 20px stroke icons on the 24 grid.
 */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
} as const

export function ResetIcon(): React.ReactElement {
  return (
    <svg {...base}>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M4 4v5h5" />
    </svg>
  )
}

export function FullscreenIcon(): React.ReactElement {
  return (
    <svg {...base}>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  )
}

export function ExitFullscreenIcon(): React.ReactElement {
  return (
    <svg {...base}>
      <path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5" />
    </svg>
  )
}

export function CloseIcon(): React.ReactElement {
  return (
    <svg {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function MaterialIcon(): React.ReactElement {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16" fill="currentColor" stroke="none" opacity="0.35" />
    </svg>
  )
}

export function DimensionsIcon(): React.ReactElement {
  return (
    <svg {...base}>
      <path d="M3 17l14-14 4 4L7 21z" />
      <path d="M8 8l2 2M11 5l2 2M14 11l2 2" />
    </svg>
  )
}
