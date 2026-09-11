import { expect, test } from '@playwright/test'

import { reachable } from './routes'

/**
 * EVERY CONTROL HAS A NAME, AND EVERY ERROR IS ATTACHED TO ITS FIELD — Phase 41, run in Phase 42.
 *
 * A control with no accessible name is announced as "edit text" — the visitor is asked to type
 * something and not told what. A visible label that is not ASSOCIATED with its input has the same
 * effect: it is on screen and not in the accessibility tree.
 *
 * The second half matters more and is checked less. When a form is refused, a sighted person sees
 * the message beside the field. Somebody using a screen reader hears it only if the message is in a
 * live region, or `aria-describedby` points at it from the field, or both. Otherwise the form
 * simply appears not to submit.
 *
 * THE ENQUIRY FORM IS THE ONE THAT MATTERS. It is the only conversion path on the site: a visitor
 * who cannot complete it cannot reach the studio at all.
 */

const CONTACT = '/contact'

test.describe('forms', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'naming does not vary by width')

  test('every control on the contact page is named', async ({ page }) => {
    test.skip(!(await reachable(page, CONTACT)), '/contact is not published in this database')

    const controls = page.locator(
      'input:not([type="hidden"]), select, textarea, button, [role="button"]',
    )
    const count = await controls.count()
    expect(count, 'no controls found — the form did not render').toBeGreaterThan(0)

    const unnamed: string[] = []
    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index)
      if (!(await control.isVisible())) continue

      /*
       * A HONEYPOT IS SUPPOSED TO BE UNREACHABLE, AND `display: none` WOULD GIVE IT AWAY. The
       * enquiry form's trap field is a real input inside a `<label aria-hidden="true">` with
       * `tabIndex={-1}`: invisible to assistive technology and to the keyboard, visible to a bot
       * that reads the DOM — which is the entire mechanism. Playwright reports it as visible,
       * because it is, so the exclusion has to be by intent rather than by computed style.
       *
       * IT IS EXCLUDED BY ITS `aria-hidden` ANCESTOR, not by its name. Anything hidden from the
       * accessibility tree is outside what this test is about, and keying on `name="website"` would
       * make the exclusion stop working the moment the trap was renamed — which is the one change
       * somebody would make for a good reason.
       */
      const hiddenFromAssistiveTech = await control.evaluate(
        (node) => (node as HTMLElement).closest('[aria-hidden="true"]') !== null,
      )
      if (hiddenFromAssistiveTech) continue

      const name = await control.evaluate((node) => {
        const element = node as HTMLElement
        const labelled = element.getAttribute('aria-label')
        if (labelled !== null && labelled.trim() !== '') return labelled
        const by = element.getAttribute('aria-labelledby')
        if (by !== null) {
          const text = by
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ')
            .trim()
          if (text !== '') return text
        }
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const label = element.labels?.[0]?.textContent?.trim()
          if (label !== undefined && label !== '') return label
          const placeholder = element.getAttribute('placeholder')
          // A placeholder is NOT a label — it disappears the moment somebody types — but its
          // presence tells a reader of this failure what the field was meant to be.
          return placeholder === null ? '' : `(placeholder only: ${placeholder})`
        }
        return element.textContent?.trim() ?? ''
      })

      if (name === '' || name.startsWith('(placeholder only')) {
        const description = await control.evaluate(
          (node) => `${node.tagName.toLowerCase()}[name=${(node as HTMLInputElement).name || '?'}]`,
        )
        unnamed.push(`${description} ${name}`)
      }
    }
    expect(unnamed, 'controls announced as "edit text" with no indication of what to type').toEqual(
      [],
    )
  })

  test('a required field is marked required in the accessibility tree', async ({ page }) => {
    // An asterisk in a label is a visual convention. `required` is what a screen reader announces.
    test.skip(!(await reachable(page, CONTACT)), '/contact is not published in this database')

    const form = page.locator('[data-inquiry-form]')
    test.skip((await form.count()) === 0, 'no enquiry form on /contact')

    for (const field of ['name', 'phone']) {
      const input = form.locator(`[name="${field}"]`).first()
      const required = await input.evaluate(
        (node) =>
          (node as HTMLInputElement).required || node.getAttribute('aria-required') === 'true',
      )
      expect(required, `${field} is required and does not say so`).toBe(true)
    }
  })

  test('a refusal is announced, not only displayed', async ({ page }) => {
    /*
     * SUBMITTED EMPTY ON PURPOSE. The form is refused, and the question is whether somebody who
     * cannot see the page learns that. A live region is what carries it.
     */
    test.skip(!(await reachable(page, CONTACT)), '/contact is not published in this database')

    const form = page.locator('[data-inquiry-form]')
    test.skip((await form.count()) === 0, 'no enquiry form on /contact')

    await form.locator('button[type="submit"]').first().click()

    const announcement = page.locator(
      '[role="alert"], [aria-live="assertive"], [aria-live="polite"]',
    )
    await expect(announcement.first(), 'the refusal is visible and not announced').toBeVisible({
      timeout: 10_000,
    })
  })

  test('the search field is a labelled combobox', async ({ page }) => {
    // Search is the other control every page carries, and a bare input in a header is the classic
    // unnamed control.
    test.skip(!(await reachable(page, '/')), 'the home page is not published in this database')

    const search = page.getByRole('searchbox').or(page.getByRole('combobox')).first()
    test.skip((await search.count()) === 0, 'no search control in the header')
    const name = await search.evaluate(
      (node) =>
        node.getAttribute('aria-label') ??
        (node as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
        '',
    )
    expect(name.trim(), 'the search control has no accessible name').not.toBe('')
  })
})
