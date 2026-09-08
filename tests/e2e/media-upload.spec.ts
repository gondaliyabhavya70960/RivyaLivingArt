import { expect, test } from '@playwright/test'

/**
 * The signed-upload seam, end to end.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE, stated up front because the gap matters and because a
 * reader who assumes the happy path is covered here will stop looking for it.
 *
 * `POST /api/media/sign` is the whole subject. It is the only part of the upload that touches this
 * server — the bytes go from the browser straight to Cloudinary — so it is where every control
 * lives: session, `media.write`, the folder allowlist, the MIME allowlist and the byte ceiling.
 * Everything below exercises it as an UNAUTHENTICATED caller, which is the half that can be proved
 * without a reachable auth server.
 *
 * THE AUTHENTICATED HALF IS `test.fixme`, NOT OMITTED. A signed upload needs a real session, and
 * there is no way to obtain one without Supabase: a forged cookie is refused by `getUser()`, which
 * is the entire reason that call is used rather than `getSession()`. Marking them keeps the gap
 * visible in the test report rather than only in a document.
 *
 * WHAT IS PROVED ELSEWHERE, so this file does not duplicate it:
 *
 *   - The limits table itself — every MIME allowlist, every ceiling, the SVG ban across all five
 *     kinds — is `tests/unit/media-upload-limits.test.ts`, 13 cases against SECURITY.md §7.1/§7.2.
 *   - The folder allowlist, including traversals and prefix collisions, is
 *     `tests/unit/media-transform.test.ts`.
 *   - That the delivery URLs are chains Cloudinary actually accepts was proved against the LIVE
 *     API during the Phase 06 canary run (CLOUDINARY.md, "what the Phase 06 canaries
 *     established") — and it found a defect every unit test had passed over. No e2e test here can
 *     substitute for that, because Playwright would only assert on a URL string too.
 *
 * A 401 ON EVERY CASE IS THE POINT, NOT A WEAKNESS. The route authorises before it parses, so a
 * malformed body, a disallowed folder and a banned MIME type are all refused identically to an
 * anonymous caller. That ordering is deliberate — it means the DENIED audit row is written for the
 * attempt rather than for a well-formed attempt — and asserting it is how a regression that moved
 * the Zod parse above the permission check would be caught.
 */

const SIGN_PATH = '/api/media/sign'

/** A request body the route would accept from a session holding `media.write`. */
const VALID_BODY = {
  folder: 'rivya/material',
  kind: 'IMAGE',
  mimeType: 'image/jpeg',
  bytes: 1024,
}

test.describe('POST /api/media/sign, unauthenticated', () => {
  test('refuses a well-formed request with 401 and no signature', async ({ request }) => {
    const response = await request.post(SIGN_PATH, { data: VALID_BODY })

    expect(response.status()).toBe(401)
    const body = await response.text()
    // The refusal must not leak a credential, and must not hint at what would have worked.
    expect(body).not.toContain('signature')
    expect(body).not.toContain('api_key')
    expect(body).not.toContain('apiKey')
  })

  test('refuses a disallowed folder with the SAME 401, not a 400', async ({ request }) => {
    // The order of the gates is the assertion. Authorisation runs before parsing and before the
    // folder check, so an anonymous caller cannot use this endpoint to discover which folders
    // exist — a 400 here and a 401 above would be exactly that oracle.
    const response = await request.post(SIGN_PATH, {
      data: { ...VALID_BODY, folder: '../../../etc' },
    })

    expect(response.status()).toBe(401)
  })

  test('refuses a banned MIME type with the same 401', async ({ request }) => {
    // SVG is refused on every path (SECURITY.md §7.2), but not by THIS response — an anonymous
    // caller never reaches the MIME check. Asserted so that a refactor moving the type check
    // above the permission check shows up as a changed status.
    const response = await request.post(SIGN_PATH, {
      data: { ...VALID_BODY, mimeType: 'image/svg+xml' },
    })

    expect(response.status()).toBe(401)
  })

  test('refuses a malformed body with the same 401', async ({ request }) => {
    const response = await request.post(SIGN_PATH, {
      data: 'not json at all',
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status()).toBe(401)
  })

  test('does not accept GET', async ({ request }) => {
    // Only POST is exported. A GET would put the request in proxy logs and browser history, and
    // this one asks for a credential.
    const response = await request.get(SIGN_PATH)
    expect(response.status()).toBe(405)
  })
})

test.describe('the Media Manager surfaces', () => {
  for (const section of ['all', 'images', 'videos', 'models', 'documents', 'brand']) {
    test(`/studio/media/${section} redirects an anonymous visitor to login`, async ({ page }) => {
      await page.goto(`/studio/media/${section}`)

      expect(page.url()).toContain('/studio/login')
      // The path is carried through so signing in lands where the person was going.
      expect(new URL(page.url()).searchParams.get('next')).toBe(`/studio/media/${section}`)
    })
  }
})

/**
 * The authenticated half. Every one of these needs a real Supabase session.
 */
test.describe('POST /api/media/sign, as staff', () => {
  test.fixme('a merchandiser receives a signature, a timestamp and the kind limits', async () => {
    // Happy path: 200, with maxBytes and allowedFormats echoed from SECURITY.md §7.1's table so
    // the uploader can refuse an over-large file before spending the upload.
  })

  test.fixme('the response is never cached', async () => {
    // `cache-control: no-store`. The body carries a credential scoped to one staff member; a
    // shared cache holding it would hand the next reader a write into the Cloudinary account.
  })

  test.fixme('a researcher is refused with 403 — media.read does not imply media.write', async () => {
    // The role holds media.read, so it can open the page; the uploader is hidden by
    // PermissionGate, and this is the assertion that hiding it was a courtesy and not the control.
  })

  test.fixme('a disallowed folder is refused with 400 and writes a DENIED audit row', async () => {
    // The one request shape that looks like somebody probing for a writable path in the account.
  })

  test.fixme('an SVG is refused with 400 and writes a DENIED audit row', async () => {
    // Including for an owner. The ban is unconditional (SECURITY.md §7.2).
  })

  test.fixme('a file over the kind ceiling is refused with 400', async () => {
    // 25 MB for IMAGE, 5 MB for BRAND. The client checks first as a courtesy; this is the control.
  })

  test.fixme('the uploader will not submit without alt text', async () => {
    // The row could not be written either way — alt_text is not null and non-empty — but the
    // point is the ordering: asking afterwards produces a library of rows nobody came back to.
  })
})
