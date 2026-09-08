import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act, render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MaterialSequence } from '@/components/patterns/MaterialSequence'

/**
 * The material sequence's two branches, asserted as two different pages rather than as one page
 * with an effect that may or may not have run.
 *
 * WHAT MATTERS HERE IS THE STATIC BRANCH. The island's job is to add an attribute; the page's job
 * is to be complete without it. So the first assertion below is server-rendered markup — every
 * stage present, no `data-active` anywhere — because that is what a visitor with no JavaScript,
 * slow hydration or a reduced-motion preference actually receives, and it is the state that is
 * easiest to break by writing the dimming the other way round.
 */

/** A controllable `prefers-reduced-motion`, as `useReducedMotion.test.ts` installs it. */
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

/**
 * A stand-in `IntersectionObserver` that hands back the callback, so a test can say "this stage is
 * now crossing the middle of the viewport" without a layout, a scroll or a real viewport.
 */
type Observed = { readonly targets: Element[]; readonly disconnected: () => boolean }

function installObserver(): {
  readonly observed: Observed
  cross: (element: Element, isIntersecting: boolean) => void
} {
  const targets: Element[] = []
  let callback: IntersectionObserverCallback = () => {}
  let disconnected = false

  class FakeObserver {
    constructor(cb: IntersectionObserverCallback) {
      callback = cb
    }
    observe(element: Element): void {
      targets.push(element)
    }
    disconnect(): void {
      disconnected = true
    }
    unobserve(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }

  vi.stubGlobal('IntersectionObserver', FakeObserver)

  return {
    observed: { targets, disconnected: () => disconnected },
    cross: (element, isIntersecting) =>
      act(() => {
        callback(
          [{ target: element, isIntersecting } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        )
      }),
  }
}

function stages(): React.ReactElement {
  return (
    <MaterialSequence>
      <li data-entry-key="liquid">liquid</li>
      <li data-entry-key="form">form</li>
    </MaterialSequence>
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  changeListeners.clear()
  prefersReduce = false
})

describe('the static branch', () => {
  it('renders every stage on the server with no data-active attribute', () => {
    const html = renderToStaticMarkup(stages())

    expect(html).toContain('data-entry-key="liquid"')
    expect(html).toContain('data-entry-key="form"')
    // Absence is the whole design: the section dims on `data-active="false"`, which matches
    // nothing until the island writes it, so an unenhanced page is at full strength.
    expect(html).not.toContain('data-active')
  })

  it('writes nothing under reduced motion', () => {
    installMediaQuery()
    prefersReduce = true
    installObserver()

    const { container } = render(stages())

    for (const stage of container.querySelectorAll('[data-entry-key]')) {
      expect(stage.getAttribute('data-active')).toBeNull()
    }
  })
})

describe('the observed branch', () => {
  it('dims every stage before promoting the one in view', () => {
    installMediaQuery()
    const { observed } = installObserver()

    const { container } = render(stages())

    // Dimmed FIRST, so somebody who lands mid-page sees the effect immediately rather than after
    // their first scroll.
    expect(observed.targets).toHaveLength(2)
    for (const stage of container.querySelectorAll('[data-entry-key]')) {
      expect(stage.getAttribute('data-active')).toBe('false')
    }
  })

  it('marks the stage crossing the band and unmarks it when it leaves', () => {
    installMediaQuery()
    const { cross } = installObserver()

    const { container } = render(stages())
    const liquid = container.querySelector('[data-entry-key="liquid"]')
    expect(liquid).not.toBeNull()

    cross(liquid as Element, true)
    expect(liquid?.getAttribute('data-active')).toBe('true')

    cross(liquid as Element, false)
    expect(liquid?.getAttribute('data-active')).toBe('false')
  })

  it('restores the static branch on unmount', () => {
    installMediaQuery()
    const { observed } = installObserver()

    const { container, unmount } = render(stages())
    const stage = container.querySelector('[data-entry-key="liquid"]') as HTMLElement
    // Held outside the tree, because unmount empties the container.
    const detached = stage

    unmount()

    expect(observed.disconnected()).toBe(true)
    expect(detached.getAttribute('data-active')).toBeNull()
  })
})
