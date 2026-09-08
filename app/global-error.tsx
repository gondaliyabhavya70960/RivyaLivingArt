'use client'

import type * as React from 'react'

import './globals.css'

/**
 * The last resort: the ROOT LAYOUT itself threw.
 *
 * WHEN THIS RENDERS, NOTHING ELSE DID. `app/(site)/error.tsx` catches a page that failed inside a
 * working shell; this catches the shell failing. It replaces the root layout entirely — which is
 * why it must emit its own `<html>` and `<body>` — so nothing above it exists to have set the
 * language, loaded the fonts or opened a database connection.
 *
 * IT CONTAINS THE ONLY VISITOR-READABLE LITERALS IN THE PUBLIC SITE, and that is a deliberate,
 * bounded exception to D2 rather than an oversight. Every other public string is a `global_content`
 * row; this one cannot be. Next requires this file to be a Client Component, a Client Component
 * cannot query, and the situation it exists for is precisely the one where the query would fail
 * anyway — a page that says nothing because it could not read what to say is worse than a page
 * that says one plain sentence.
 *
 * SO THE SENTENCE ASSERTS NOTHING ABOUT THE BUSINESS. It names no service, no material and no
 * capability; it is a system message about this request, which is the only thing that can be
 * stated truthfully without reading anything. The brand name is deliberately absent: it lives in
 * `BRAND.brand.name`, and hardcoding it here would put it in two places.
 *
 * `globals.css` IS IMPORTED HERE because the root layout — which normally imports it — did not
 * run. Without it the token layer is absent and every class below resolves to nothing, leaving
 * unstyled text on a white page. With it, this surface is tokens and type like the other two.
 *
 * NO MEDIA, NO FONTS FROM `next/font`, NO DATA. The three things most likely to be broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.ReactElement {
  return (
    <html lang="en-GB">
      <body className="rv-scheme-deep bg-surface text-ink">
        <main className="mx-auto max-w-prose px-6 py-24">
          <h1 className="font-display text-3xl tracking-heading">Something went wrong.</h1>
          <p className="mt-4 text-ink-secondary">
            This page could not be loaded. Please try again.
          </p>

          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-sm underline underline-offset-4"
          >
            Try again
          </button>

          {/* The digest, never `error.message` — see components/patterns/ErrorSurface.tsx. */}
          {error.digest === undefined ? null : (
            <p className="mt-8 text-xs text-ink-tertiary">
              Reference <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
