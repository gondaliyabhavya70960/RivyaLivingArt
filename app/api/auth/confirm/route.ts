import { headers } from 'next/headers'
import { z } from 'zod'

import { RESET_PASSWORD_PATH, FORGOT_PASSWORD_PATH } from '@/lib/auth/password-reset'
import { logSystem } from '@/lib/logging/system-log'
import {
  RECOVERY_CONFIRM_WINDOWS,
  addressFromHeaders,
  bucketKey,
  consume,
} from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'

/**
 * `GET /api/auth/confirm` — where a link in an email lands.
 *
 * WHY A ROUTE HANDLER AND NOT A PAGE. The link carries a one-time token that has to be exchanged
 * for a session, and an exchange writes cookies. A Server Component cannot set one — only a Server
 * Action or a Route Handler can (see the swallow in `lib/supabase/server.ts`) — so a page here
 * would render, fail to persist the session it had just obtained, and show an expired-link notice
 * about a link that had in fact just worked.
 *
 * TWO SHAPES ARE ACCEPTED, BECAUSE SUPABASE SENDS ONE OF TWO DEPENDING ON A SETTING NOBODY HERE
 * CONTROLS:
 *
 *   `?token_hash=…&type=recovery`  the SSR shape, produced when the project's email template uses
 *                                  `{{ .TokenHash }}`. Verified with `verifyOtp`. IT WORKS IN ANY
 *                                  BROWSER, which matters more than it sounds: people read email on
 *                                  a phone and manage the Studio on a laptop.
 *   `?code=…`                      the PKCE shape, produced by the default template's
 *                                  `{{ .ConfirmationURL }}`. Exchanged with
 *                                  `exchangeCodeForSession`, which needs the code-verifier cookie
 *                                  this deployment set when the reset was requested — so it works
 *                                  only in the browser that asked.
 *
 * Supporting both is not indecision. The template is configured in the Supabase dashboard and this
 * repository cannot assert what it says; handling only the shape we prefer would mean a flow that
 * is correct in the code and broken on the deployment. `STUDIO_GUIDE.md` §2.1.2 names the template
 * change as an owner action and says what it buys. (This comment used to cite `ENVIRONMENT.md` §4,
 * which is the server-only variable list and says nothing about templates — a reference that sent
 * the one reader who followed it to the wrong document.)
 *
 * IT DECIDES NOTHING ABOUT ACCESS. A verified token produces an auth session and nothing else: no
 * staff profile is read, no role is resolved, no permission is granted. `/studio/reset-password`
 * uses that session for one operation — setting the password of the account it belongs to — and
 * every Studio page still resolves its own staff session underneath. A recovery link is therefore
 * not a way into the Studio even when it works.
 */

/**
 * The OTP types worth accepting here, which is not all of them.
 *
 * `recovery` is the password reset. `invite` and `signup` are the confirmation links a new staff
 * member follows, and they land in the same place for the same reason: an invited person has no
 * password yet, so the next thing they need is the form that sets one.
 *
 * `email_change` IS DELIBERATELY ABSENT. It is a different act with a different destination, and
 * accepting a type this route has no destination for would send somebody to a password form after
 * confirming an address change they did not expect to be asked about.
 */
const typeSchema = z.enum(['recovery', 'invite', 'signup'])

const tokenHashSchema = z.string().min(16).max(512)
const codeSchema = z.string().min(16).max(512)

/** Everything this route can do ends at one of these two, always as a 303. */
const DESTINATION = {
  reset: RESET_PASSWORD_PATH,
  expired: `${FORGOT_PASSWORD_PATH}?error=link`,
} as const

/**
 * 303 See Other, not `redirect()`.
 *
 * In a Route Handler `redirect()` serves 307, which preserves the method — irrelevant for a GET,
 * but this file sits beside `sign-out/route.ts` where it very much is not, and two redirect idioms
 * in one directory is how the wrong one gets copied. Next merges the cookies the Supabase client
 * wrote into whatever response the handler returns, so the session survives the redirect.
 */
function see(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } })
}

/**
 * The auth service said nothing was wrong and handed back no session.
 *
 * THIS IS A REAL OUTCOME, NOT A DEFENSIVE BRANCH, and the first version of this file called it
 * success. `verifyOtp` saves a session only when one comes back carrying an access token
 * (`@supabase/auth-js`), and it reports `error: null` regardless — so a response with no session
 * left no cookie, and this route cheerfully redirected to `/studio/reset-password`, where the page
 * found no user and rendered "This reset link is no longer valid." about a link that had just been
 * accepted. No log row, no error, and a person going round the loop forever.
 *
 * THE CONFIGURATION THAT PRODUCES IT. `@supabase/ssr` builds a PKCE client, so
 * `resetPasswordForEmail` always sends a code challenge — which means a recovery begun by this
 * application and completed through a `{{ .TokenHash }}` template mixes the two flows, and that is
 * the combination in which the auth server may answer `/verify` with an auth code rather than a
 * session. It is therefore exactly the shape the recommended template change produces, which is why
 * it must be diagnosable rather than silent.
 *
 * WARNING, not INFO: an expired link is somebody being slow, and this is a deployment whose two
 * halves disagree. The remedy is in STUDIO_GUIDE §2.1.2 — revert to the default
 * `{{ .ConfirmationURL }}` template, whose `?code=` link is what a PKCE recovery expects.
 */
async function noSession(shape: 'token_hash' | 'code'): Promise<Response> {
  await logSystem({
    level: 'WARNING',
    channel: 'AUTH',
    event: 'auth.recovery.no_session',
    message: 'The auth service accepted the recovery link but returned no session',
    context: { shape },
  })
  return see(DESTINATION.expired)
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)

  /*
   * RATE LIMITED BY ADDRESS ALONE, and the token is deliberately NOT part of the key. Keying on
   * what the caller presented would give a fresh allowance to every guess, which is the opposite of
   * a limit. Twenty an hour is generous for a person clicking a link — twice, from a mail client
   * that prefetches — and a wall in front of anybody grinding token hashes.
   */
  const address = addressFromHeaders(await headers())
  const { allowed } = await consume(
    bucketKey('recovery_confirm', address),
    RECOVERY_CONFIRM_WINDOWS,
  )
  if (!allowed) {
    await logSystem({
      level: 'SECURITY',
      channel: 'AUTH',
      event: 'auth.recovery.rate_limited',
      message: 'Recovery-link confirmation refused by the rate limiter before the token was tried',
    })
    // The expired-link page, not a 429. The caller is a browser following a link from an email and
    // the useful answer is the form that issues a new one.
    return see(DESTINATION.expired)
  }

  const supabase = await createClient()

  const tokenHash = tokenHashSchema.safeParse(url.searchParams.get('token_hash'))
  const type = typeSchema.safeParse(url.searchParams.get('type'))
  const code = codeSchema.safeParse(url.searchParams.get('code'))

  if (tokenHash.success && type.success) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type.data,
      token_hash: tokenHash.data,
    })
    if (!error && !data.session) return await noSession('token_hash')
    if (error) {
      /*
       * INFO, not SECURITY. An expired or already-used recovery link is the ordinary end of a
       * working flow — somebody clicked yesterday's email — and logging it at SECURITY would bury
       * the rate-limit rows that actually mean something under the noise of people being slow.
       * The code, never the message.
       */
      await logSystem({
        level: 'INFO',
        channel: 'AUTH',
        event: 'auth.recovery.rejected',
        message: 'The auth service rejected a recovery token',
        context: { shape: 'token_hash', status: error.status ?? null, code: error.code ?? null },
      })
      return see(DESTINATION.expired)
    }
    return see(DESTINATION.reset)
  }

  if (code.success) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code.data)
    if (!error && !data.session) return await noSession('code')
    if (error) {
      await logSystem({
        level: 'INFO',
        channel: 'AUTH',
        event: 'auth.recovery.rejected',
        message: 'The auth service rejected a recovery code',
        // `code` here is the shape of the link, never the value in it. The one exchange that
        // routinely fails is a link opened in a different browser from the one that asked, which
        // is the case the token_hash template exists to remove.
        context: { shape: 'code', status: error.status ?? null, code: error.code ?? null },
      })
      return see(DESTINATION.expired)
    }
    return see(DESTINATION.reset)
  }

  // Neither shape. A bare visit to this URL, a truncated link, or a probe — all of which get the
  // page that can issue a working link, and none of which learn anything from the answer.
  return see(DESTINATION.expired)
}

/**
 * Everything else is already 405 by convention; GET is the only method a link can produce, and
 * spelling the rest out would invite somebody to add a POST that mutates on a token in a URL.
 */
