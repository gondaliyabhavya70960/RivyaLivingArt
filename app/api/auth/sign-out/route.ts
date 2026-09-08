import { writeAudit } from '@/lib/auth/audit'
import { getStaffSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

/**
 * Sign-out. POST only, same-origin only, audited, and it ends at the login page.
 *
 * WHY GET IS REFUSED RATHER THAN SUPPORTED. A GET sign-out is a URL, and a URL is something any
 * other site can fetch on a visitor's behalf — `<img src="https://…/api/auth/sign-out">` in a forum
 * post signs out every staff member who reads it, with no click and nothing to notice. It is a
 * small denial of service rather than a breach, which is exactly why it survives review when the
 * handler is written as a link target. So GET answers 405 and the interface uses a form.
 *
 * WHY THE ORIGIN IS CHECKED ANYWAY. POST-only stops an `<img>`, not a cross-site `<form>`: any page
 * may submit a form to any URL, and the browser attaches our cookies. Next.js applies this same
 * check to Server Actions automatically (see the Server Actions guide, "Security"), but a Route
 * Handler is a plain endpoint and gets none of it — so the comparison is made here, by hand.
 *
 * WHY 303 AND NOT `redirect()`. In a Route Handler `redirect()` serves 307, which preserves the
 * METHOD: the browser would re-issue the POST against `/studio/login`. 303 See Other is the status
 * that exists for this — it tells the browser to GET the destination — and Next merges the auth
 * cookies the client cleared into whatever response the handler returns, so the session is gone
 * either way (see appendMutableCookies in the app-route module).
 */

const LOGIN_PATH = '/studio/login'

/**
 * Is this POST from us?
 *
 * `x-forwarded-host` first, because behind a proxy `host` is the internal name while the browser's
 * `Origin` carries the public one, and comparing those two would refuse every real request.
 *
 * A missing `Origin` is refused rather than waved through. Every browser sends it on a
 * cross-origin POST and current browsers send it on a same-origin POST too, so the absent case is
 * not a visitor we are locking out — it is a request shaped by something other than a form.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    // An unparseable Origin is not a same-origin request by any reading of it.
    return false
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    // No detail. A response that explains which half of the comparison failed is a hint for the
    // next attempt, and the legitimate caller never sees this branch.
    return new Response(null, { status: 403 })
  }

  // BEFORE the sign-out, so the audit row names who left. Afterwards there is no session to read
  // and the row would say only that somebody, once, signed out.
  const session = await getStaffSession()
  const supabase = await createClient()

  // A profile that is INVITED or SUSPENDED resolves to no staff session, and that person must
  // still be able to end their session — so the actor falls back to the authenticated id.
  const actorUserId = session?.userId ?? (await supabase.auth.getUser()).data.user?.id

  // `local`, not the default `global`: this signs out this browser. Global would end the same
  // person's sessions on every other device they hold, which is not what a sign-out button says
  // it does — and it is the wrong default for staff who sign in from a phone and a desktop.
  const { error } = await supabase.auth.signOut({ scope: 'local' })

  // A POST with nobody behind it — a stale tab, a double submit, a probe — ends nothing, and a row
  // naming no actor records nothing worth reading. The cookies are cleared above either way.
  if (actorUserId !== undefined) {
    await writeAudit({
      action: 'auth.sign_out',
      result: error ? 'ERROR' : 'SUCCESS',
      actorUserId,
      ...(session ? { actorRole: session.role } : {}),
      // The code, never the message: an auth-service message can quote the address it was given.
      ...(error
        ? { summary: `the auth service refused the sign-out (code ${error.code ?? 'none'})` }
        : {}),
    })
  }

  // The redirect happens whether or not the auth service was reachable. The cookies are cleared
  // locally by the client above, so staying on a page that believes there is still a session
  // would be the worse of the two outcomes.
  return new Response(null, { status: 303, headers: { Location: LOGIN_PATH } })
}

/**
 * Anything else Next.js already answers with 405. GET is spelled out because it is the method
 * someone reaches for when they turn the sign-out control into a link, and a 405 with `Allow` is
 * the answer that says why.
 */
export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}
