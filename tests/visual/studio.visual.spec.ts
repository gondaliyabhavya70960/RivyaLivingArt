import { expect, test } from '@playwright/test'

import { interceptMedia } from '../support/media-route'
import { STUDIO, TOLERANCE } from './tiers'
import { settle, stabilise } from './stability'

/**
 * THE STUDIO, AS FAR AS AN UNAUTHENTICATED RUN CAN SEE IT — Phase 42.
 *
 * WHICH IS ONE PAGE, AND SAYING SO IS THE POINT. The Studio is the half of this product an owner
 * spends their time in, and it has no visual coverage at all — because signing in needs Supabase
 * Auth, and the local harness (`scripts/db/local-rest.mjs`) is PostgREST alone. There is no auth
 * server to authenticate against, so there is no storage state to reuse, so every Studio spec in
 * this repository is guarded by `STUDIO_STORAGE_STATE` and skips.
 *
 * WHAT WOULD CHANGE THAT is a hosted preview with a fixture account, or GoTrue added to the local
 * harness. Both are real work and neither is this phase's. Recorded as an outstanding gap in
 * `docs/ops/TESTING.md` §7 rather than papered over with a suite that skips and reports green.
 *
 * The login page is worth its own baseline regardless: it is the only Studio surface a stranger can
 * reach, and a regression on it locks the owner out of their own site.
 */

test.describe('Studio', () => {
  for (const route of STUDIO) {
    test(`${route.name} looks as it did`, async ({ page }) => {
      await stabilise(page)
      await interceptMedia(page)

      const response = await page.goto(route.path)
      test.skip(response?.status() !== 200, `${route.path} is not reachable in this database`)

      await settle(page)

      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: TOLERANCE.A,
        animations: 'disabled',
      })
    })
  }
})
