import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MediaVideo } from './index'

const CLOUD = 'rivya-test'
const MEDIA = { publicId: 'rivya/process/pour', resourceType: 'video' as const }

/**
 * jsdom implements no media pipeline: `HTMLMediaElement.play` throws "Not implemented" unless it
 * is replaced. Stubbed with a resolved promise so the component's own `.catch()` is exercised
 * rather than masked by an environment failure.
 */
let play: () => Promise<void>

/**
 * `wide` defaults to true because a desktop viewport is the ordinary case these tests describe.
 * jsdom's own `matchMedia` is absent, so without a stub every query would report false and the
 * 768px gate would suppress every video — a suite that passed for the wrong reason.
 */
function setMatchMedia(reduced: boolean, wide = true): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: query.includes('prefers-reduced-motion')
          ? reduced
          : query.includes('min-width')
            ? wide
            : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

beforeEach(() => {
  play = vi.fn(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play)
  setMatchMedia(false)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderVideo(props: Partial<React.ComponentProps<typeof MediaVideo>> = {}) {
  return render(
    <MediaVideo
      cloudName={CLOUD}
      media={MEDIA}
      posterPublicId={null}
      durationSeconds={8}
      alt="Resin being poured into a mould"
      playLabel="Play"
      {...props}
    />,
  )
}

describe('MediaVideo under ordinary conditions', () => {
  it('mounts a video for a short clip and plays it muted', () => {
    renderVideo()
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.muted).toBe(true)
    expect(video?.getAttribute('playsinline')).not.toBeNull()
    expect(video?.getAttribute('preload')).toBe('none')
  })

  it('never puts an autoplay ATTRIBUTE in the markup', () => {
    // The attribute is evaluated before any of our conditions can be consulted, so a
    // `<video autoplay>` rendered and then corrected has already started fetching.
    renderVideo()
    expect(document.querySelector('video')?.hasAttribute('autoplay')).toBe(false)
    // It plays imperatively instead.
    expect(play).toHaveBeenCalled()
  })

  it('carries a poster', () => {
    expect(document.querySelector('video')).toBeNull()
    renderVideo()
    expect(document.querySelector('video')?.getAttribute('poster')).toContain('so_0')
  })
})

describe('MediaVideo under reduced motion', () => {
  beforeEach(() => setMatchMedia(true))

  it('mounts NO video element at all — not merely a paused one', () => {
    // DESIGN_SYSTEM §7.3 says the element is not in the tree. A `<video preload="none">` that
    // never plays still costs a media element and, on some engines, a poster fetch.
    renderVideo()
    expect(document.querySelector('video')).toBeNull()
    expect(play).not.toHaveBeenCalled()
  })

  it('renders the poster with a visible play control instead', () => {
    renderVideo()
    expect(document.querySelector('img')?.getAttribute('src')).toContain('so_0')
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('still lets the visitor choose to watch, with controls', async () => {
    // Reduced motion means "do not move things at me", not "you may not watch this".
    renderVideo()
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))

    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.hasAttribute('controls')).toBe(true)
    // Unmuted once deliberately started: the visitor asked for the video, not for a silent one.
    expect(video?.muted).toBe(false)
  })
})

describe('MediaVideo duration policy', () => {
  it('does not autoplay a clip longer than the ceiling', () => {
    renderVideo({ durationSeconds: 40 })
    expect(document.querySelector('video')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('does not autoplay an UNKNOWN duration', () => {
    // Null means probe() has not run, which is most likely on a just-uploaded asset.
    renderVideo({ durationSeconds: null })
    expect(document.querySelector('video')).toBeNull()
  })
})

describe('MediaVideo delivery constraints (DESIGN_SYSTEM §4.3)', () => {
  it('mounts no video when the visitor has Data Saver on', () => {
    // Somebody on Data Saver has told their browser they are paying for bytes, and an ambient
    // background clip spends them without ever being asked for.
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } })
    renderVideo()
    expect(document.querySelector('video')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('mounts no video on a device reporting under 4 GB of memory', () => {
    vi.stubGlobal('navigator', { ...navigator, deviceMemory: 2 })
    renderVideo()
    expect(document.querySelector('video')).toBeNull()
  })

  it('treats exactly 4 GB as unconstrained — the rule is `< 4`', () => {
    vi.stubGlobal('navigator', { ...navigator, deviceMemory: 4 })
    renderVideo()
    expect(document.querySelector('video')).not.toBeNull()
  })

  it('treats a browser that reports NEITHER as unconstrained', () => {
    // Absence of a signal is not evidence of a limitation, and deviceMemory ships only on
    // Chromium — defaulting to "constrained" would hold video back from every Safari visitor.
    renderVideo()
    expect(document.querySelector('video')).not.toBeNull()
  })

  it('still allows an explicit play under a constraint', () => {
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } })
    renderVideo()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })
})

describe('MediaVideo viewport gate', () => {
  it('mounts no video below 768px, even for a short clip with motion allowed', () => {
    // RC-233's mobile behaviour: "Below 768px the poster is the whole experience unless the
    // visitor presses play; no video element is mounted speculatively."
    setMatchMedia(false, false)
    renderVideo()
    expect(document.querySelector('video')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('still lets a phone visitor press play', () => {
    setMatchMedia(false, false)
    renderVideo()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('mounts at or above 768px', () => {
    setMatchMedia(false, true)
    renderVideo()
    expect(document.querySelector('video')).not.toBeNull()
  })
})

describe('MediaVideo poster selection', () => {
  it("uses an editor's still when one is set, from the image namespace", () => {
    setMatchMedia(true)
    renderVideo({ posterPublicId: 'rivya/interior/still' })
    const src = document.querySelector('img')?.getAttribute('src') ?? ''
    expect(src).toContain('/image/upload/')
    expect(src).not.toContain('so_0')
  })
})
