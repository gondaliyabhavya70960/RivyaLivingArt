import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useReducedMotion } from './useReducedMotion'

/**
 * A controllable `prefers-reduced-motion` media query. jsdom's own `matchMedia` answers
 * `false` and never changes, which cannot exercise the half of this hook that matters:
 * a preference switched on while the page is open.
 */
const changeListeners = new Set<() => void>()
let prefersReduce = false

function installMediaQuery(): void {
  changeListeners.clear()
  prefersReduce = false
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return prefersReduce && query.includes('prefers-reduced-motion')
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => void changeListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      void changeListeners.delete(listener),
  }))
}

function setPreference(reduce: boolean): void {
  prefersReduce = reduce
  act(() => {
    for (const listener of changeListeners) listener()
  })
}

/** Renders the hook's answer as text, so every assertion below is on what a user gets. */
function Probe(): React.ReactElement {
  return React.createElement('p', null, String(useReducedMotion()))
}

afterEach(() => {
  vi.unstubAllGlobals()
  changeListeners.clear()
  prefersReduce = false
})

describe('useReducedMotion', () => {
  it('reports the platform preference', () => {
    installMediaQuery()
    prefersReduce = true

    render(React.createElement(Probe))

    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('reports no preference as motion allowed', () => {
    installMediaQuery()

    render(React.createElement(Probe))

    expect(screen.getByText('false')).toBeInTheDocument()
  })

  it('follows a preference the visitor changes while the page is open', () => {
    installMediaQuery()
    render(React.createElement(Probe))
    expect(screen.getByText('false')).toBeInTheDocument()

    setPreference(true)

    expect(screen.getByText('true')).toBeInTheDocument()

    setPreference(false)

    expect(screen.getByText('false')).toBeInTheDocument()
  })

  it('stops listening once its consumer unmounts', () => {
    installMediaQuery()
    const { unmount } = render(React.createElement(Probe))
    expect(changeListeners.size).toBe(1)

    unmount()

    expect(changeListeners.size).toBe(0)
  })

  it('answers false on the server whatever the platform reports', () => {
    installMediaQuery()
    prefersReduce = true

    // The server was never sent a preference. Reading one during render is what causes
    // the hydration mismatch this hook exists to avoid, so the server snapshot is a
    // constant and the animated branch — which renders content in its final state — is
    // the one that is safe to be wrong with.
    expect(renderToStaticMarkup(React.createElement(Probe))).toContain('false')
  })

  it('allows motion where matchMedia does not exist at all', () => {
    vi.stubGlobal('matchMedia', undefined)

    render(React.createElement(Probe))

    expect(screen.getByText('false')).toBeInTheDocument()
  })
})
