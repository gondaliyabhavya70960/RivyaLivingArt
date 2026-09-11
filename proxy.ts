import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { NONCE_HEADER, mintNonce } from '@/lib/security/csp'
import { STATIC_SECURITY_HEADERS, cspHeaderName, cspWithReporting } from '@/lib/security/headers'
import { publicEnv } from '@/lib/supabase/env'

/**
 * THIS FILE IS NOT AUTHORISATION. Phase 41 gives it a third job — the response header set — and
 * that job is unconditional, mechanical and reads nothing, so it does not weaken the rule below.
 * Its two ORIGINAL jobs are unchanged: it refreshes the Supabase session cookies, and it redirects
 * a request carrying no session to the login page. It reads no role, checks no permission and
 * consults no table.
 *
 * That restriction is amendment A2·b, and it is not stylistic. A proxy cannot see which record a
 * request is about, it runs before the page has resolved anything, and a Server Action invoked
 * from an already-loaded page never passes through this matcher at all — so a permission decision
 * taken here would be both under-informed and skippable. `requirePermission()` in the page body is
 * the decision, and RLS refuses underneath it if that call is ever forgotten. Anything this file
 * lets through is a request the PAGE still has to judge.
 *
 * It follows that being redirected here proves nothing about an account, and being let through
 * proves nothing either.
 *
 * WHY `proxy.ts` AND NOT `middleware.ts`: Next 16 deprecated the `middleware` convention and
 * renamed it to `proxy` — same behaviour, same matcher, the export renames. Adopted under
 * amendment A6 rather than left on the deprecated name, because a deprecation warning that is
 * carried for several phases stops being read, and this is the one file in the tree whose failure
 * mode is "the Studio is open to anonymous requests".
 *
 * Next's own note on this convention says not to rely on shared modules or globals here, because a
 * proxy may be deployed to a CDN edge and run outside the app's main runtime. This file honours
 * that: it imports `publicEnv` (two strings, both `NEXT_PUBLIC_`) and the Supabase SSR client, and
 * it holds no module-level mutable state. Every request builds its own client.
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

/**
 * Paths that get the AUTH treatment: every Studio path except the login page — matching the login
 * page would redirect it to itself. The lookahead excludes `/studio/login` and anything below it
 * while still matching a route that merely starts with those letters, so a future `/studio/logins`
 * is not silently unprotected.
 */
const STUDIO_GUARDED = /^\/studio(?:$|\/(?!login$|login\/))/

export const config = {
  /**
   * EVERY ROUTE, BECAUSE THE HEADERS ARE FOR EVERY ROUTE — Phase 41.
   *
   * Until this phase the matcher was `/studio` alone, which was right when the proxy's only job was
   * auth. The security header set is unconditional, so the matcher has to be too: a CSP that covers
   * the Studio and not the public site protects the half that has no visitors.
   *
   * WHAT IS EXCLUDED AND WHY. `_next/static` and `_next/image` are immutable build output served
   * straight from the CDN — running a proxy over them adds latency to every asset on every page and
   * a CSP on a JavaScript file protects nothing. `favicon.ico` and the other root files are the
   * same. Everything a person can navigate to is matched.
   *
   * THE AUTH WORK IS STILL SCOPED. Widening the matcher without scoping the Supabase call would run
   * `getUser()` — a network round trip — on every public page view, which would be a self-inflicted
   * latency regression in the phase after the one that measured latency. `STUDIO_GUARDED` above is
   * the guard, and `proxy()` returns early for everything else with the headers attached.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sitemaps/).*)'],
}

/**
 * CSP mode. Report-only unless `CSP_ENFORCE=1`, so forgetting the variable costs enforcement rather
 * than availability. See `lib/security/headers.ts` and SECURITY.md §5.3 for the soak procedure.
 */
function cspEnforced(): boolean {
  return process.env['CSP_ENFORCE'] === '1'
}

/**
 * Attach the header set to a response. Called on every path this proxy matches, including the
 * redirect it may return — a redirect is a response a browser acts on and needs the same headers.
 */
function withSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  for (const [key, value] of STATIC_SECURITY_HEADERS) response.headers.set(key, value)
  response.headers.set(cspHeaderName(cspEnforced()), cspWithReporting(nonce))
  return response
}

export async function proxy(request: NextRequest) {
  /*
   * THE NONCE IS MINTED FIRST AND WRITTEN ONTO THE REQUEST, so that `requestNonce()` can read it
   * during render and put the same value on any inline script. It is a REQUEST header: it never
   * reaches a browser, and it must not, because a nonce a client can read is a nonce an injected
   * script can reuse.
   */
  const nonce = mintNonce()
  request.headers.set(NONCE_HEADER, nonce)

  // Everything that is not a guarded Studio path gets the headers and nothing else: no Supabase
  // client, no round trip. See the note on `config.matcher`.
  if (!STUDIO_GUARDED.test(request.nextUrl.pathname)) {
    return withSecurityHeaders(NextResponse.next({ request }), nonce)
  }

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

  if (user) return withSecurityHeaders(response, nonce)

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
  return withSecurityHeaders(redirectResponse, nonce)
}
