import { describe, expect, it } from 'vitest'

import {
  MAX_AUTOPLAY_SECONDS,
  mayAutoplayInline,
  posterFor,
  posterUrlFor,
} from '@/lib/media/poster'
import { PRESET_MAP, resolveSpec } from '@/lib/media/transform'
import { imageUrl, lqipUrl, posterUrl, videoUrl } from '@/lib/media/url'

const CLOUD = 'rivya-test'

/**
 * Delivery URLs are a cache contract as much as an addressing one.
 *
 * The tests that matter most here are not "does it produce a URL" but "does it produce the SAME
 * URL twice". Two spellings of one transformation are two derived assets, two CDN cache entries
 * and two bills for one picture — and nothing about that failure is visible on the page.
 */

describe('imageUrl', () => {
  it('builds a delivery URL under the resource type the asset lives in', () => {
    const url = imageUrl(CLOUD, { publicId: 'rivya/material/oak', resourceType: 'image' })
    expect(url).toBe('https://res.cloudinary.com/rivya-test/image/upload/rivya/material/oak')
  })

  it('emits the transformation parameters in a stable order regardless of spec key order', () => {
    const a = imageUrl(
      CLOUD,
      { publicId: 'x', resourceType: 'image' },
      {
        width: 480,
        crop: 'fill',
        format: 'auto',
        quality: 'auto:good',
        gravity: 'auto',
      },
    )
    const b = imageUrl(
      CLOUD,
      { publicId: 'x', resourceType: 'image' },
      {
        quality: 'auto:good',
        gravity: 'auto',
        format: 'auto',
        crop: 'fill',
        width: 480,
      },
    )
    expect(a).toBe(b)
    expect(a).toContain('/c_fill,f_auto,g_auto,q_auto:good,w_480/')
  })

  it('never emits a dpr parameter, because the srcset ladder already answers DPR', () => {
    const url = imageUrl(CLOUD, { publicId: 'x', resourceType: 'image' }, { width: 480 })
    expect(url).not.toContain('dpr_')
  })

  it('derives the height from a ratio, and lets an explicit height win', () => {
    expect(
      imageUrl(CLOUD, { publicId: 'x', resourceType: 'image' }, { width: 1600, ratio: '21:9' }),
    ).toContain('h_686')
    expect(
      imageUrl(
        CLOUD,
        { publicId: 'x', resourceType: 'image' },
        { width: 1200, height: 630, ratio: '1:1' },
      ),
    ).toContain('h_630')
  })

  it('pins the version when one is known, so a re-upload cannot change a cached page', () => {
    const url = imageUrl(CLOUD, { publicId: 'x', resourceType: 'image', version: 1712345678 })
    expect(url).toContain('/v1712345678/x')
  })

  it('keeps folder slashes as folders but escapes everything else', () => {
    const url = imageUrl(CLOUD, { publicId: 'rivya/process/a b?c', resourceType: 'image' })
    expect(url).toContain('/rivya/process/a%20b%3Fc')
  })

  it('renders every preset without an empty path segment', () => {
    for (const name of Object.keys(PRESET_MAP) as (keyof typeof PRESET_MAP)[]) {
      const url = imageUrl(CLOUD, { publicId: 'x', resourceType: 'image' }, resolveSpec(name))
      expect(url, name).toMatch(/^https:\/\/res\.cloudinary\.com\/rivya-test\/image\/upload\/.+/)
      expect(url.slice('https://'.length).includes('//'), name).toBe(false)
    }
  })

  it('drops the empty transformation segment when there is no transformation at all', () => {
    expect(imageUrl(CLOUD, { publicId: 'x', resourceType: 'image' })).toBe(
      'https://res.cloudinary.com/rivya-test/image/upload/x',
    )
  })
})

describe('videoUrl', () => {
  it('applies the phase document video policy', () => {
    const url = videoUrl(CLOUD, { publicId: 'rivya/process/pour', resourceType: 'video' })
    expect(url).toContain('f_auto:video')
    expect(url).toContain('q_auto')
    expect(url).toContain('vc_auto')
  })

  it('strips the audio track when muted', () => {
    const url = videoUrl(CLOUD, { publicId: 'x', resourceType: 'video' }, { muted: true })
    expect(url).toContain('ac_none')
  })

  it('is the ONLY path that takes a dpr, because a video has no srcset', () => {
    const url = videoUrl(CLOUD, { publicId: 'x', resourceType: 'video' }, { width: 1280, dpr: 2 })
    expect(url).toContain('dpr_2')
  })

  it('caps a video dpr at 3, through the same clamp the rest of the product uses', () => {
    expect(
      videoUrl(CLOUD, { publicId: 'x', resourceType: 'video' }, { width: 1280, dpr: 4 }),
    ).toContain('dpr_3')
  })

  it('omits dpr_1 rather than forking the cache for the default', () => {
    const plain = videoUrl(CLOUD, { publicId: 'x', resourceType: 'video' }, { width: 1280 })
    const explicit = videoUrl(
      CLOUD,
      { publicId: 'x', resourceType: 'video' },
      { width: 1280, dpr: 1 },
    )
    expect(plain).toBe(explicit)
    expect(plain).not.toContain('dpr_')
  })

  it('puts g_auto in its OWN component, because Cloudinary rejects it inline on video', () => {
    const url = videoUrl(CLOUD, { publicId: 'x', resourceType: 'video' }, resolveSpec('hero'))
    const path = url.split('/upload/')[1] ?? ''
    expect(path.startsWith('c_fill,f_auto:video,q_auto,vc_auto,w_1600/g_auto/')).toBe(true)
    expect(url).toContain('/c_fill,f_auto:video,q_auto,vc_auto,w_1600/g_auto/')
  })

  it('keeps g_auto INLINE on an image, where it is accepted', () => {
    expect(
      imageUrl(CLOUD, { publicId: 'x', resourceType: 'image' }, resolveSpec('hero')),
    ).toContain('/c_fill,f_auto,g_auto,q_auto:good,w_1600/')
  })

  it('does not emit an image preset format or quality alongside the video policy', () => {
    const url = videoUrl(
      CLOUD,
      { publicId: 'x', resourceType: 'video' },
      { ...PRESET_MAP.hero, muted: true },
    )
    const segment = url.split('/upload/')[1]?.split('/')[0] ?? ''
    expect(segment.match(/(^|,)f_/g)).toHaveLength(1)
    expect(segment.match(/(^|,)q_/g)).toHaveLength(1)
  })
})

describe('posterUrl', () => {
  it('pulls the first frame out of the video namespace, as an image', () => {
    const url = posterUrl(CLOUD, { publicId: 'rivya/process/pour', resourceType: 'video' })
    expect(url).toContain('so_0')
    expect(url).toMatch(/\.jpg$/)
    expect(url).toContain('/video/upload/')
  })

  it('splits g_auto out too — a poster comes OUT of the video namespace', () => {
    const url = posterUrl(CLOUD, { publicId: 'x', resourceType: 'video' }, resolveSpec('thumb'))
    expect(url).toContain('/c_fill,q_auto:eco,so_0,w_160/g_auto/')
  })

  it('stays in the video namespace even when handed an image ref by mistake', () => {
    const url = posterUrl(CLOUD, { publicId: 'x', resourceType: 'image' })
    expect(url).toContain('/video/upload/')
  })
})

describe('posterFor', () => {
  it("prefers an editor's chosen still over the first frame", () => {
    const decision = posterFor({ publicId: 'v', posterPublicId: 'rivya/interior/still' })
    expect(decision.origin).toBe('explicit')
    expect(decision.ref).toEqual({ publicId: 'rivya/interior/still', resourceType: 'image' })
  })

  it('treats an empty string as no poster, not as a poster named ""', () => {
    expect(posterFor({ publicId: 'v', posterPublicId: '' }).origin).toBe('derived')
  })

  it('falls back to the video first frame, keeping the version pin', () => {
    const decision = posterFor({ publicId: 'v', posterPublicId: null, version: 42 })
    expect(decision.origin).toBe('derived')
    expect(decision.ref).toEqual({ publicId: 'v', resourceType: 'video', version: 42 })
  })

  it('dispatches to the right URL builder for each origin', () => {
    expect(posterUrlFor(CLOUD, { publicId: 'v', posterPublicId: 'still' })).toContain(
      '/image/upload/',
    )
    expect(posterUrlFor(CLOUD, { publicId: 'v', posterPublicId: null })).toContain('/video/upload/')
  })
})

describe('mayAutoplayInline', () => {
  it('refuses under reduced motion, whatever the duration', () => {
    expect(mayAutoplayInline({ durationSeconds: 5, prefersReducedMotion: true })).toBe(false)
  })

  it('allows a short clip when motion is not restricted', () => {
    expect(mayAutoplayInline({ durationSeconds: 8, prefersReducedMotion: false })).toBe(true)
  })

  it('refuses at the boundary + 1 and allows at the boundary', () => {
    expect(
      mayAutoplayInline({ durationSeconds: MAX_AUTOPLAY_SECONDS, prefersReducedMotion: false }),
    ).toBe(true)
    expect(
      mayAutoplayInline({ durationSeconds: MAX_AUTOPLAY_SECONDS + 1, prefersReducedMotion: false }),
    ).toBe(false)
  })

  it('refuses an UNKNOWN duration rather than assuming it is short', () => {
    expect(mayAutoplayInline({ durationSeconds: null, prefersReducedMotion: false })).toBe(false)
  })

  it('refuses a zero or negative duration instead of treating it as short', () => {
    expect(mayAutoplayInline({ durationSeconds: 0, prefersReducedMotion: false })).toBe(false)
    expect(mayAutoplayInline({ durationSeconds: -3, prefersReducedMotion: false })).toBe(false)
  })
})

describe('lqipUrl', () => {
  it('emits a fixed tiny blurred plate off the responsive ladder', () => {
    const url = lqipUrl(CLOUD, { publicId: 'rivya/material/oak', resourceType: 'image' })
    expect(url).toContain('/c_fill,e_blur:1000,f_auto,g_auto,q_1,w_32/')
    expect(url).toContain('/image/upload/')
  })

  it('places an editor crop BEFORE the LQIP preset, matching imageUrl ordering', () => {
    const url = lqipUrl(
      CLOUD,
      { publicId: 'x', resourceType: 'image' },
      'c_crop,h_100,w_80,x_10,y_20',
    )
    const path = url.split('/upload/')[1] ?? ''
    expect(
      path.startsWith('c_crop,h_100,w_80,x_10,y_20/c_fill,e_blur:1000,f_auto,g_auto,q_1,w_32/'),
    ).toBe(true)
  })
})
