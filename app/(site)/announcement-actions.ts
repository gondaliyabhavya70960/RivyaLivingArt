'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

/**
 * The announcement bar's dismiss control, as a Server Action.
 *
 * WHY THIS IS NOT A CLIENT ISLAND. A dismiss button is the smallest imaginable reason to ship
 * JavaScript, and it is in the LAYOUT — so the cost lands on every route on the site, forever, and
 * is charged against Phase 11's island budget for `/`. As a Server Action bound to a plain form it
 * works with JavaScript disabled, adds nothing to the bundle, and cannot get out of step with the
 * server's idea of whether the bar is dismissed, because there is only one idea.
 *
 * THE TOKEN COMES FROM A HIDDEN FIELD, NOT FROM A CLOSURE. `bind` would also survive a no-JS
 * submit, but a hidden input is what makes the value visible in the DOM and therefore in a test:
 * `tests/e2e/site-shell.spec.ts` disables JavaScript, submits this form and reloads. Nothing is
 * trusted about the value either way — see below.
 *
 * NOTHING IS AUTHENTICATED HERE, AND NOTHING NEEDS TO BE. The worst a forged token achieves is
 * hiding a banner from the browser that sent it. That is why the value is written to the cookie
 * without a database lookup: checking it would cost a query on every dismissal to prevent a
 * visitor from inconveniencing themselves. It is still bounded and pattern-checked before it is
 * written, because a cookie value is echoed back in a `Set-Cookie` header and an unbounded string
 * from a form field does not belong in one.
 */

/** The name is fixed by the phase document. */
const COOKIE = 'rv_ann_dismissed'

/**
 * A year. The token changes when the announcement's text changes, so a long life dismisses THIS
 * announcement for good rather than suppressing the next one — see `lib/site/announcement.ts` for
 * why the token is not the row id alone.
 */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

/** `<uuid>.<8 hex>`, which is exactly what `announcementFrom` builds. Anything else is discarded. */
const TOKEN = /^[0-9a-f-]{36}\.[0-9a-f]{8}$/i

export async function dismissAnnouncement(formData: FormData): Promise<void> {
  const token = formData.get('token')
  if (typeof token !== 'string' || !TOKEN.test(token)) return

  const store = await cookies()
  store.set(COOKIE, token, {
    maxAge: MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    // Not `secure: true` unconditionally: a cookie marked secure is dropped on http://localhost,
    // which would make the no-JS dismissal test pass in CI and fail on a developer's machine for
    // reasons nothing reports. Production is https, so the flag is set there and only there.
    secure: process.env.NODE_ENV === 'production',
    // NOT httpOnly. It carries no secret, and leaving it readable lets a future client-side
    // surface answer "is this dismissed" without a round trip. It is set here rather than in the
    // browser because the server is what renders the bar.
    httpOnly: false,
  })

  // The bar lives in the layout, so every route under it shows the change. `'layout'` is the
  // scope that says so; revalidating `'/'` as a page would leave `/about` still rendering the bar
  // from its cached shell.
  revalidatePath('/', 'layout')
}
