/**
 * THE PER-REQUEST NONCE — Phase 41.
 *
 * A nonce-based CSP needs the same random value in two places: the `Content-Security-Policy` header,
 * and every inline `<script>` the response contains. `proxy.ts` mints it and this module is how the
 * render side reads it back.
 *
 * HOW IT TRAVELS, AND WHY THROUGH A HEADER. The proxy runs before the page and cannot pass a value
 * down a React tree. What it CAN do is set a request header, which Next makes readable from any
 * Server Component through `headers()`. That is the mechanism Next's own CSP guidance uses and it
 * costs nothing — the header is set on the request, not the response, so it never reaches a browser.
 *
 * WHY NOT A COOKIE, AND WHY NOT A MODULE GLOBAL. A cookie would be sent back by the browser and
 * cached with the page, which defeats the entire purpose of a nonce being per-request. A module
 * global would be shared by every concurrent request in the same worker — two visitors, one nonce,
 * and the second one's scripts silently blocked. A request header is per-request by construction.
 *
 * THE VALUE IS 128 BITS OF `crypto.getRandomValues`, base64. The CSP specification asks for at least
 * 128 bits of entropy and for a value unguessable to an attacker who can read the page; anything
 * derived from a timestamp, a request id or a hash of the path would fail the second requirement
 * while looking fine.
 */
import 'server-only'

import { headers } from 'next/headers'

/** The request header `proxy.ts` writes and this module reads. Never sent to a browser. */
export const NONCE_HEADER = 'x-rivya-nonce'

/** 128 bits, base64. Runs in the proxy, which may execute on an edge runtime — Web Crypto only. */
export function mintNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // `btoa` over a binary string: available in every runtime Next targets, unlike `Buffer` on edge.
  return btoa(String.fromCharCode(...bytes))
}

/**
 * The nonce for the request being rendered, or null.
 *
 * NULL IS A REAL CASE AND MUST NOT THROW. A page rendered outside a proxied request — a static
 * prerender at build time, a test harness, a route the matcher does not cover — has no nonce. A
 * component that needs one renders nothing inline rather than failing the build, because the
 * alternative is a build that breaks whenever the matcher changes.
 */
export async function requestNonce(): Promise<string | null> {
  try {
    const value = (await headers()).get(NONCE_HEADER)
    return value === null || value === '' ? null : value
  } catch {
    // `headers()` throws outside a request scope (a build-time prerender is the usual one).
    return null
  }
}
