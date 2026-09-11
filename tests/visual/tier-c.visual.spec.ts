import { expect, test } from '@playwright/test'

import { interceptMedia } from '../support/media-route'
import { TIER_C, TOLERANCE } from './tiers'
import { settle, stabilise } from './stability'

/**
 * Tier C — legal and system pages — Phase 42.
 *
 * See `tests/visual/tiers.ts` for what the tier means and why the tolerance differs, and
 * `tests/visual/stability.ts` for the four sources of difference that are removed before the
 * shutter opens.
 *
 * A BASELINE BELONGS TO THE CONTAINER THAT MADE IT. Font rasterisation differs between machines by
 * a pixel here and there, which is under the tolerance for a paragraph and over it for a page of
 * them. The committed baselines were produced in this repository's pinned image; a run elsewhere
 * should expect differences that are about the machine and not the code, and
 * `docs/ops/TESTING.md` §6 says what to do about it.
 */

test.describe('Tier C — legal and system pages', () => {
  for (const route of TIER_C) {
    test(`${route.name} looks as it did`, async ({ page }) => {
      await stabilise(page)
      await interceptMedia(page)

      const response = await page.goto(route.path)
      test.skip(response?.status() !== 200, `${route.path} is not published in this database`)

      await settle(page)

      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: TOLERANCE.C,
        animations: 'disabled',
      })
    })
  }
})
