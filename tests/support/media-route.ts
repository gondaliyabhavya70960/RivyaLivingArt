import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Page, Route } from '@playwright/test'

import { FIXTURE_MEDIA } from '../fixtures/ids'

/**
 * NO BROWSER TEST TOUCHES CLOUDINARY — Phase 42.
 *
 * `MediaImage` renders a plain `<img>` pointing at `res.cloudinary.com` (it refuses `next/image`
 * deliberately; see the note in that component), so every page under test makes real requests to a
 * real CDN. Left alone that gives a test suite three properties nobody wants:
 *
 *   IT NEEDS THE NETWORK. A run on a train, in a locked-down runner or behind a proxy fails for a
 *   reason that has nothing to do with the code, and the failure reads as a broken page.
 *
 *   IT IS SLOW AND UNEVEN. Twenty images at 4800px wide, fetched over a link whose speed changes,
 *   inside a test with a timeout. That is the standard recipe for a flake nobody can reproduce.
 *
 *   IT MAKES A VISUAL SNAPSHOT A PROMISE ABOUT SOMEBODY ELSE'S SERVER. Re-encode an asset, change
 *   a delivery default, add a crop, and every baseline in the suite fails with a diff about a
 *   change that is not in the pull request.
 *
 * So every Cloudinary request is answered locally from `tests/fixtures/media/`, which is committed.
 *
 * IT ANSWERS EVERY URL, not only the twelve the fixture binds. The seeded content references the
 * whole 250-asset manifest, and a suite that failed on the first unrecognised public id would fail
 * on nearly every page. A request the fixture does not know gets a neutral stand-in — and
 * `requestedPublicIds()` records what was asked for, so a test that cares which image a page chose
 * can assert it rather than squint at a screenshot.
 */

const MEDIA_DIR = join(import.meta.dirname, '../fixtures/media')

/** `https://res.cloudinary.com/<cloud>/image/upload/<transformations…>/<public_id>.<ext>` */
const DELIVERY = /^\/[^/]+\/(image|video|raw)\/upload\/(.*)$/

/**
 * The public id inside a delivery URL, with every transformation component removed.
 *
 * A transformation component is a comma-joined list of `k_v` pairs — `c_fill,g_auto,w_480`. A
 * folder is not. So a leading segment is dropped only when it parses as transformations, which is
 * how `rivya/material/macro/…` survives while `c_crop,h_800,w_600` does not. A version segment
 * (`v1234567890`) goes the same way.
 */
export function publicIdFromDeliveryUrl(url: string): string | null {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }
  const match = DELIVERY.exec(path)
  if (match === null) return null

  const segments = (match[2] ?? '').split('/')
  while (segments.length > 1) {
    const first = segments[0] ?? ''
    const isVersion = /^v\d+$/.test(first)
    const isTransformation =
      first.includes('_') && first.split(',').every((part) => /^[a-z]+_[^,]+$/.test(part))
    if (!isVersion && !isTransformation) break
    segments.shift()
  }

  const joined = segments.join('/')
  // The delivered extension is a format request, not part of the id.
  return joined.replace(/\.[a-z0-9]+$/i, '')
}

const byPublicId = new Map(FIXTURE_MEDIA.map((asset) => [asset.publicId, asset]))

/** Cached so a page with forty images reads each file once rather than forty times. */
const bytesCache = new Map<string, Buffer>()

function derivative(file: string): Buffer {
  const cached = bytesCache.get(file)
  if (cached !== undefined) return cached
  const bytes = readFileSync(join(MEDIA_DIR, file))
  bytesCache.set(file, bytes)
  return bytes
}

/**
 * The stand-in for a public id the fixture does not bind.
 *
 * The first fixture derivative, reused. Not a 1×1: a one-pixel image in an `<img>` with no width
 * attribute collapses the box, and a layout test would then be measuring the absence of an image
 * rather than the presence of one.
 */
const FALLBACK_FILE = FIXTURE_MEDIA[0]?.file ?? ''

export interface MediaRouteHandle {
  /** Every public id the page asked for, in request order, duplicates included. */
  requestedPublicIds: () => readonly string[]
  /** Public ids that were requested and are not bound by the fixture. */
  unknownPublicIds: () => readonly string[]
}

/**
 * Install the interceptor on a page. Call it before the first `goto`.
 *
 * ```ts
 * const media = await interceptMedia(page)
 * await page.goto('/products/fixture-resin-dining-table')
 * expect(media.requestedPublicIds()).toContain(FIXTURE_MEDIA[0].publicId)
 * ```
 */
export async function interceptMedia(page: Page): Promise<MediaRouteHandle> {
  const requested: string[] = []
  const unknown: string[] = []

  await page.route('https://res.cloudinary.com/**', async (route: Route) => {
    const url = route.request().url()
    const publicId = publicIdFromDeliveryUrl(url)

    if (publicId !== null) requested.push(publicId)

    /*
     * VIDEO GETS A 204 RATHER THAN BYTES. There is no committed video derivative — a valid MP4
     * small enough to commit and stable enough to diff is not a thing worth building — and a
     * `<video>` whose source fails simply shows its poster, which is the state a slow connection
     * produces anyway and therefore a state worth rendering correctly.
     */
    if (url.includes('/video/upload/')) {
      await route.fulfill({ status: 204, body: '' })
      return
    }

    const asset = publicId === null ? undefined : byPublicId.get(publicId)
    if (asset === undefined && publicId !== null && !unknown.includes(publicId)) {
      unknown.push(publicId)
    }

    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: {
        // Long-lived, like the real delivery URL, so a second page load is not a second fetch.
        'cache-control': 'public, max-age=31536000, immutable',
      },
      body: derivative(asset?.file ?? FALLBACK_FILE),
    })
  })

  return {
    requestedPublicIds: () => requested,
    unknownPublicIds: () => unknown,
  }
}
