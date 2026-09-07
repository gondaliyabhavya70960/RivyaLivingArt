import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Reveal } from './Reveal'

/**
 * jsdom implements neither `IntersectionObserver` nor a `matchMedia` that ever changes,
 * so both are supplied here. The fake observer records what was observed and lets a test
 * decide when an element enters the viewport; `observed` is therefore the honest answer
 * to "is this element being watched", which is what the reduced-motion branch is about.
 */
const observed = new Set<Element>()
let constructed = 0
let notify: ((targets: Element[]) => void) | null = null

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    constructed += 1
    notify = (targets) => {
      callback(
        targets.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry),
        this as unknown as IntersectionObserver,
      )
    }
  }

  observe(node: Element): void {
    observed.add(node)
  }

  unobserve(node: Element): void {
    observed.delete(node)
  }

  disconnect(): void {
    observed.clear()
  }
}

const changeListeners = new Set<() => void>()
let prefersReduce = false

function setPreference(reduce: boolean): void {
  prefersReduce = reduce
  act(() => {
    for (const listener of changeListeners) listener()
  })
}

function enterViewport(...targets: Element[]): void {
  act(() => {
    notify?.(targets)
  })
}

beforeEach(() => {
  observed.clear()
  changeListeners.clear()
  constructed = 0
  notify = null
  prefersReduce = false
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return prefersReduce && query.includes('prefers-reduced-motion')
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => void changeListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      void changeListeners.delete(listener),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window.navigator, 'connection')
})

describe('Reveal', () => {
  it('serves its content in the final state, so a page without JavaScript is complete', () => {
    const html = renderToStaticMarkup(
      <Reveal as="section" aria-label="Materials">
        <p>Resin over reclaimed teak</p>
      </Reveal>,
    )

    expect(html).toContain('Resin over reclaimed teak')
    // Nothing is held back before the client runs: no opacity, no travel, no transition.
    expect(html).not.toContain('opacity')
    expect(html).not.toContain('transition')
  })

  it('holds an off-screen element back and settles it when it enters the viewport', () => {
    render(
      <Reveal as="section" aria-label="Materials">
        <p>Resin over reclaimed teak</p>
      </Reveal>,
    )
    const region = screen.getByRole('region', { name: 'Materials' })

    expect(region.style.opacity).toBe('0')
    expect(region.style.transform).toBe('translateY(var(--rv-motion-rise-md))')
    expect(observed.has(region)).toBe(true)

    enterViewport(region)

    expect(region.style.opacity).toBe('1')
    expect(region.style.transform).toBe('translateY(0)')
    expect(region.style.transitionDuration).toBe('var(--rv-duration-slow)')
  })

  it('renders the final state under reduced motion and attaches no observer at all', () => {
    prefersReduce = true

    render(
      <Reveal as="section" aria-label="Materials">
        <p>Resin over reclaimed teak</p>
      </Reveal>,
    )
    const region = screen.getByRole('region', { name: 'Materials' })

    // The static branch declares nothing: no held-back opacity, no travel, and above all
    // no transition — a transition the media query then suppresses is what leaves an
    // element at opacity 0 for the rest of the page view.
    expect(region.style.opacity).toBe('')
    expect(region.style.transform).toBe('')
    expect(region.style.transitionProperty).toBe('')
    expect(region.style.transitionDuration).toBe('')
    expect(constructed).toBe(0)
    expect(observed.size).toBe(0)
  })

  it('lands an armed element in its final state when the preference is switched on', () => {
    render(
      <Reveal as="section" aria-label="Materials">
        <p>Resin over reclaimed teak</p>
      </Reveal>,
    )
    const region = screen.getByRole('region', { name: 'Materials' })
    expect(region.style.opacity).toBe('0')

    setPreference(true)

    // Never parked at zero: the element arrives, and stops being watched.
    expect(region.style.opacity).toBe('')
    expect(observed.size).toBe(0)
  })

  it('reveals once per page view and is not armed a second time', () => {
    render(
      <Reveal as="section" aria-label="Materials">
        <p>Resin over reclaimed teak</p>
      </Reveal>,
    )
    const region = screen.getByRole('region', { name: 'Materials' })
    enterViewport(region)
    expect(region.style.opacity).toBe('1')

    setPreference(true)
    setPreference(false)

    expect(region.style.opacity).not.toBe('0')
    expect(observed.size).toBe(0)
  })

  it('leaves content that is already on screen alone', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 120,
      top: 120,
      bottom: 420,
      left: 0,
      right: 320,
      width: 320,
      height: 300,
      toJSON: () => ({}),
    } as DOMRect)

    render(
      <Reveal as="section" aria-label="Materials">
        <p>Resin over reclaimed teak</p>
      </Reveal>,
    )
    const region = screen.getByRole('region', { name: 'Materials' })

    // Hiding what the browser has already painted is a flash, not an entrance.
    expect(region.style.opacity).toBe('')
    expect(observed.size).toBe(0)
  })

  it('takes the static branch on a metered connection', () => {
    Object.defineProperty(window.navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    })

    render(
      <Reveal as="section" aria-label="Materials">
        <p>Resin over reclaimed teak</p>
      </Reveal>,
    )
    const region = screen.getByRole('region', { name: 'Materials' })

    expect(region.style.opacity).toBe('')
    expect(observed.size).toBe(0)
  })

  it('staggers a group one step per item, capped at six', () => {
    render(
      <>
        <Reveal as="section" aria-label="First" index={0}>
          <p>Cast in one pour</p>
        </Reveal>
        <Reveal as="section" aria-label="Third" index={2}>
          <p>Hand-levelled</p>
        </Reveal>
        <Reveal as="section" aria-label="Tenth" index={9}>
          <p>Finished in oil</p>
        </Reveal>
      </>,
    )
    const first = screen.getByRole('region', { name: 'First' })
    const third = screen.getByRole('region', { name: 'Third' })
    const tenth = screen.getByRole('region', { name: 'Tenth' })

    enterViewport(first, third, tenth)

    expect(first.style.transitionDelay).toBe('')
    expect(third.style.transitionDelay).toBe('calc(var(--rv-motion-stagger) * 2)')
    // Item 10 shares item 6's delay: the cap is --rv-motion-stagger-max, not the count.
    expect(tenth.style.transitionDelay).toBe('calc(var(--rv-motion-stagger) * 5)')
  })

  it('watches every element on the page with one observer, not one each', () => {
    render(
      <>
        <Reveal as="section" aria-label="First">
          <p>Cast in one pour</p>
        </Reveal>
        <Reveal as="section" aria-label="Second">
          <p>Hand-levelled</p>
        </Reveal>
        <Reveal as="section" aria-label="Third">
          <p>Finished in oil</p>
        </Reveal>
      </>,
    )

    expect(constructed).toBe(1)
    expect(observed.size).toBe(3)
  })

  it('hands the consumer the element and keeps the props they passed', () => {
    const ref = React.createRef<HTMLElement>()
    render(
      <Reveal as="article" ref={ref} aria-label="Materials" style={{ maxWidth: '40rem' }}>
        <p>Resin over reclaimed teak</p>
      </Reveal>,
    )
    const article = screen.getByRole('article', { name: 'Materials' })

    expect(ref.current).toBe(article)
    // The motion style is merged onto the consumer's, never over the top of it.
    expect(article.style.maxWidth).toBe('40rem')
    expect(article.style.opacity).toBe('0')
  })
})
