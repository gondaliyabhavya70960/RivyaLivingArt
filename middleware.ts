import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { publicEnv } from '@/lib/supabase/env'

/**
 * MIDDLEWARE IS NOT AUTHORISATION. It does exactly two things: it refreshes the Supabase session
 * cookies, and it redirects a request carrying no session to the login page. It reads no role,
 * checks no permission and consults no table.
 *
 * That restriction is amendment A2·b, and it is not stylistic. Middleware cannot see which record
 * a request is about, it runs before the page has resolved anything, and a Server Action invoked
 * from an already-loaded page never passes through this matcher at all — so a permission decision
 * taken here would be both under-informed and skippable. `requirePermission()` in the page body is
 * the decision, and RLS refuses underneath it if that call is ever forgotten. Anything this file
 * lets through is a request the PAGE still has to judge.
 *
 * It follows that being redirected here proves nothing about an account, and being let through
 * proves nothing either.
 *
 * NEXT 16 NOTE: `middleware.ts` is deprecated in favour of `proxy.ts` (same behaviour, the export
 * renames to `proxy`). The name is kept because D2 and PHASE-00-04 name this file; migrating it is
 * a rename plus a CANONICAL-DECISIONS amendment, not a silent divergence.
 */

const LOGIN_PATH = '/studio/login'
const NEXT_PARAM = 'next'
const EXPIRED_PARAM = 'expired'

/**
 * The Supabase auth cookie, chunked or not (`sb-<ref>-auth-token`, `…-auth-token.0`).
 *
 * Matched only to tell two redirects apart in the copy the login page shows: a browser that sent
 * no auth cookie at all was never signed in, while one that sent an auth cookie the auth server
 * then refused was signed in until recently. Nothing is read out of the cookie and nothing is
 * decided by it — an attacker who sets a cookie of this name gets a different sentence, not
 * different access.
 */
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/

export const config = {
  /**
   * Every Studio path except the login page — matching the login page would redirect it to itself.
   * The lookahead excludes `/studio/login` and anything below it while still matching a route that
   * merely starts with those letters, so a future `/studio/logins` is not silently unprotected.
   */
  matcher: ['/studio', '/studio/((?!login$|login/).*)'],
}

export async function middleware(request: NextRequest) {
  // Read before the client can rewrite or clear it below.
  const hadAuthCookie = request.cookies.getAll().some((cookie) => AUTH_COOKIE.test(cookie.name))

  // Reassigned by setAll: a refreshed token must be written onto the response that is actually
  // returned, and NextResponse.next() has to be rebuilt around the mutated request to carry it.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        // Without these a CDN may cache a response carrying one visitor's auth cookies and serve
        // it to the next visitor. @supabase/ssr supplies them; they are not optional.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value)
        }
      },
    },
  })

  // getUser(), not getSession(): the cookie is whatever the browser last sent, and this call is
  // also what refreshes an expired access token before the page renders behind it.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) return response

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = LOGIN_PATH
  loginUrl.search = ''
  // Path and query, so a deep link survives the detour. It is a suggestion the login page
  // re-validates before using — nothing that arrives in a URL is trusted on the strength of
  // having been put there by this file.
  loginUrl.searchParams.set(NEXT_PARAM, `${request.nextUrl.pathname}${request.nextUrl.search}`)
  if (hadAuthCookie) loginUrl.searchParams.set(EXPIRED_PARAM, '1')

  const redirectResponse = NextResponse.redirect(loginUrl)
  // Carry across any cookie the refresh attempt just cleared or rewrote. Dropping them here leaves
  // the browser holding a stale token that fails the same way on the next request, forever.
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie)
  }
  return redirectResponse
}
