import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act, render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

import { HeroMotion } from '@/components/patterns/HeroMotion'

/**
 * The hero's motion layer, asserted one gate at a time.
 *
 * WHAT THIS PROTECTS is the Largest Contentful Paint. Phase 11's budget puts the LCP element at
 * the hero still, and every one of the assertions below is a way that could stop being true
 * without anything looking wrong: a `<video>` in the server HTML, a clip mounted before paint, a
 * clip mounted for somebody on Data Saver or a phone. None of those show up in a screenshot.
 *
 * `renderToStaticMarkup` FOR THE FIRST ONE, deliberately. The server render is where an LCP
 * regression would actually live, and a jsdom render with hooks stubbed cannot see it.
 */

const changeListeners = new Set<() => void>()
let prefersReduce = false
let viewportWide = true

function installMediaQuery(): void {
  changeListeners.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query.includes('prefers-reduced-motion')) return prefersReduce
      if (query.includes('min-width')) return viewportWide
      return false
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => void changeListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      void changeListeners.delete(listener),
  }))
}

/** Paints immediately: every queued frame callback runs as soon as it is scheduled. */
function installPainted(): void {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    act(() => cb(0))
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
}

/** Never paints: callbacks are queued and dropped, so the after-paint gate stays shut. */
function installUnpainted(): void {
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
}

/** jsdom implements no media playback at all; `MediaVideo` calls `play()` once it mounts. */
function installPlayback(): void {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
}

function installNavigator(saveData: boolean): void {
  vi.stubGlobal('navigator', { ...navigator, connection: { saveData } })
}

function layer(durationSeconds: number | null = 8): React.ReactElement {
  return (
    <HeroMotion
      cloudName="rivya-test"
      media={{ publicId: 'rivya/hero/clip', resourceType: 'video' }}
      posterPublicId="rivya/hero/still"
      durationSeconds={durationSeconds}
      alt="A dining table being poured"
      playLabel="Play"
    />
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  changeListeners.clear()
  prefersReduce = false
  viewportWide = true
})

describe('HeroMotion', () => {
  it('renders nothing on the server', () => {
    // The still is the LCP element by construction: there is no video in the HTML to compete
    // with it, whatever the visitor's preferences turn out to be.
    expect(renderToStaticMarkup(layer())).toBe('')
  })

  it('renders nothing until the first paint', () => {
    installMediaQuery()
    installUnpainted()
    installNavigator(false)

    const { container } = render(layer())

    expect(container.querySelector('video')).toBeNull()
  })

  it('mounts the clip once every gate passes', () => {
    installMediaQuery()
    installNavigator(false)
    installPlayback()
    installPainted()

    const { container } = render(layer())

    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    // The poster is the still, never a frame of the clip: the still is 21:9 and the clip is 16:9,
    // so a poster taken from the clip would repaint the hero in a different crop.
    expect(video?.getAttribute('poster')).toContain('rivya/hero/still')
    expect(video?.getAttribute('preload')).toBe('none')
    expect(video?.hasAttribute('autoplay')).toBe(false)
  })

  it('renders nothing under reduced motion', () => {
    installMediaQuery()
    prefersReduce = true
    installNavigator(false)
    installPainted()

    const { container } = render(layer())

    expect(container.querySelector('video')).toBeNull()
  })

  it('renders nothing on Data Saver', () => {
    installMediaQuery()
    installNavigator(true)
    installPainted()

    const { container } = render(layer())

    expect(container.querySelector('video')).toBeNull()
  })

  it('renders nothing below 768px', () => {
    installMediaQuery()
    viewportWide = false
    installNavigator(false)
    installPainted()

    const { container } = render(layer())

    // The 9:16 mobile clip is bound so the gate can be relaxed later; today it must not mount.
    expect(container.querySelector('video')).toBeNull()
  })

  it('renders nothing for an unprobed clip', () => {
    installMediaQuery()
    installNavigator(false)
    installPainted()

    const { container } = render(layer(null))

    // A null duration is "nobody has checked how long this is", which is not the same as short —
    // and a layer that cannot autoplay must not fall back to a play control over the hero copy.
    expect(container.querySelector('video')).toBeNull()
  })
})
