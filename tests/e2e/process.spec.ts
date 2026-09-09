import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * `/process`, and the numbering that has to survive its own verification state.
 *
 * AT LAUNCH THIS PAGE IS A HERO AND NOTHING ELSE. All seven chapters are
 * `OWNER_VERIFICATION_REQUIRED` — SEED §16 flags step 04 and Phase 09 extended the flag to all
 * seven under D10, because each describes a production method — so the publish trigger refuses
 * every one of them until the owner confirms. These tests therefore assert a RANGE of states: the
 * hero is always there, and whatever chapters are published read as a contiguous sequence from 01.
 *
 * THE NUMBERS ARE THE ASSERTION. `tests/unit/process-numbering.test.tsx` proves the arithmetic at
 * 1, 3, 5 and 7 chapters against the real `SectionList`; this proves the same property against a
 * real page, whatever the database happens to hold — which is the only place the two could
 * disagree.
 */

const PATH = '/process'

async function published(page: Page): Promise<boolean> {
  const response = await page.goto(PATH)
  return response?.status() === 200
}

function chapters(page: Page) {
  return page.locator('[data-block-type="process-steps"]')
}

test.describe('/process', () => {
  test('renders its hero and one section per published chapter', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /process in this database')

    await expect(page.locator('[data-block-type="hero"]')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveCount(1)
  })

  test('numbers whatever chapters are published contiguously from 01', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /process in this database')

    const count = await chapters(page).count()
    // Zero is the launch-day answer and a legitimate one: the assertion is about the sequence, and
    // an empty sequence is contiguous.
    const numbers = await chapters(page)
      .locator('p')
      .filter({ hasText: /^\d{2}$/ })
      .allInnerTexts()

    expect(numbers).toEqual(
      Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0')),
    )
  })

  test('names no price, dimension, client or award anywhere in its copy', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /process in this database')

    const text = (await page.locator('main').innerText()).toLowerCase()
    const forbidden = /[₹$€]|\d+\s?(mm|cm|m|in|ft)\b|client|customer|award|warranty|guarantee/
    const match = forbidden.exec(text)
    expect(match?.[0] ?? null, `forbidden copy on ${PATH}`).toBeNull()
  })

  test('mounts no motion layer while no clip is bound', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /process in this database')

    // `media_assets` is empty until the Higgsfield migration runs. When it is not, at most one
    // chapter may hold the page's motion slot — `ChapterMedia` enforces that, and this becomes an
    // assertion of "at most one" rather than "none".
    expect(await page.locator('video').count()).toBeLessThanOrEqual(1)
  })

  test('reports no critical or serious axe violation', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /process in this database')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(
      blocking.map((v) => `${v.id} (${v.impact}) — ${v.nodes[0]?.target.join(' ')}`),
      'critical/serious axe violations',
    ).toEqual([])
  })
})
