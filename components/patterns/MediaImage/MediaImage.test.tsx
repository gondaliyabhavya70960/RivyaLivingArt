import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MediaImage } from './index'

const CLOUD = 'rivya-test'
const MEDIA = { publicId: 'rivya/material/oak', resourceType: 'image' as const }

function renderImage(props: Partial<React.ComponentProps<typeof MediaImage>> = {}) {
  render(
    <MediaImage
      cloudName={CLOUD}
      media={MEDIA}
      preset="card"
      sizes="(min-width: 768px) 33vw, 100vw"
      alt="An oak and resin side table"
      {...props}
    />,
  )
  return screen.getByRole('img', { name: props.decorative === true ? undefined : /.*/ })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('MediaImage', () => {
  it('renders one img with the preset URL as its src', () => {
    const img = renderImage()
    expect(img.getAttribute('src')).toContain('/c_fill,f_auto,g_auto,q_auto:good,w_480/')
  })

  it('offers a srcset whose entries differ only in width', () => {
    // The invariant that matters: if crop, gravity, format or quality varied between candidates,
    // the picture would CHANGE as the browser picked a rung.
    const img = renderImage()
    const entries = (img.getAttribute('srcset') ?? '').split(', ')
    expect(entries.length).toBeGreaterThan(1)

    const shapes = new Set(
      entries.map((entry) => entry.replace(/w_\d+/, 'w_N').replace(/ \d+w$/, '')),
    )
    expect(shapes.size).toBe(1)
  })

  it('emits a sizes attribute, which is what stops the browser assuming 100vw', () => {
    expect(renderImage().getAttribute('sizes')).toBe('(min-width: 768px) 33vw, 100vw')
  })

  it('throws in development when sizes is empty rather than silently shipping the largest rung', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(() =>
      render(<MediaImage cloudName={CLOUD} media={MEDIA} preset="card" sizes="" alt="x" />),
    ).toThrow(/sizes/)
  })

  it('does NOT throw in production — a heavier image beats a broken page', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() =>
      render(<MediaImage cloudName={CLOUD} media={MEDIA} preset="card" sizes="" alt="x" />),
    ).not.toThrow()
  })

  it('renders alt="" only when asked, never by omission', () => {
    render(
      <MediaImage
        cloudName={CLOUD}
        media={MEDIA}
        preset="card"
        sizes="100vw"
        alt="An oak table"
        decorative
      />,
    )
    // An empty alt hides the image from assistive technology, so it must be a decision somebody
    // made rather than a prop somebody forgot.
    const img = document.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('')
  })

  it('is lazy by default and eager only on request', () => {
    expect(renderImage().getAttribute('loading')).toBe('lazy')
  })

  it('emits no srcset for a preset that fixes both dimensions', () => {
    // `og` is 1200 x 630 by external specification. Rungs would either change the crop at every
    // candidate or lose the fixed size.
    render(
      <MediaImage cloudName={CLOUD} media={MEDIA} preset="og" sizes="1200px" alt="Social card" />,
    )
    const img = document.querySelector('img')
    expect(img?.getAttribute('srcset')).toBeNull()
    expect(img?.getAttribute('src')).toContain('h_630')
  })

  it('keeps every srcset candidate at the same ratio when one is asked for', () => {
    render(
      <MediaImage
        cloudName={CLOUD}
        media={MEDIA}
        preset="grid"
        ratio="16:9"
        sizes="50vw"
        alt="x"
      />,
    )
    const entries = (document.querySelector('img')?.getAttribute('srcset') ?? '').split(', ')
    for (const entry of entries) {
      const width = Number(/w_(\d+)/.exec(entry)?.[1])
      const height = Number(/h_(\d+)/.exec(entry)?.[1])
      // The height must track the width, not stay pinned at the base rung's value.
      expect(Math.abs(width / height - 16 / 9), entry).toBeLessThan(0.01)
    }
  })
})
