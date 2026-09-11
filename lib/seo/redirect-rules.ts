import { SITE_PATH_PATTERN } from '@/lib/supabase/schemas/seo'

/**
 * Loop and chain detection for `seo_redirects` — a write-time judgement, capped at one hop.
 *
 * ONE HOP, BECAUSE THE RESOLVER TAKES ONE. `lib/seo/redirects.ts` looks a path up once and sends
 * the visitor to `to_path`; it does not look `to_path` up again. So a row whose target is itself
 * a source (`a → b` beside `b → c`) would send a visitor to a 404 that then redirects — two
 * round trips where one was promised — and a row whose source is another row's target
 * (`x → a` beside `a → b`) does the same from the other side. Both are refused at write time,
 * with the row that would form the chain named, so the owner can retarget the first hop instead.
 *
 * A LOOP IS A CHAIN THAT COMES BACK. `a → b` beside `b → a` is refused by the same rule, and a
 * self-redirect (`a → a`) by the database's own check; it is repeated here so the message is a
 * sentence rather than a constraint name.
 *
 * PURE, over rows already read. The Server Action reads every redirect (a small table by
 * construction: one row per renamed address) and asks this function before inserting or
 * updating one.
 */

export type RedirectRow = {
  readonly id?: string
  readonly from_path: string
  readonly to_path: string
}

export type RedirectRefusal =
  | { readonly code: 'shape'; readonly field: 'from_path' | 'to_path'; readonly message: string }
  | { readonly code: 'self'; readonly message: string }
  | { readonly code: 'duplicate'; readonly message: string; readonly existing: RedirectRow }
  | { readonly code: 'loop'; readonly message: string; readonly existing: RedirectRow }
  | { readonly code: 'chain'; readonly message: string; readonly existing: RedirectRow }

export type RedirectVerdict = { readonly ok: true } | ({ readonly ok: false } & RedirectRefusal)

/** Lowercase, trailing slash removed, `?` and `#` and everything after them dropped. */
export function normaliseRedirectPath(raw: string): string {
  const trimmed = raw.trim().toLowerCase().split(/[?#]/)[0] ?? ''
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') || '/' : withSlash
}

export function validateRedirect(
  existing: readonly RedirectRow[],
  candidate: RedirectRow,
): RedirectVerdict {
  const from = normaliseRedirectPath(candidate.from_path)
  const to = normaliseRedirectPath(candidate.to_path)

  if (!SITE_PATH_PATTERN.test(from)) {
    return {
      ok: false,
      code: 'shape',
      field: 'from_path',
      message: 'A source is a site-relative path: lowercase letters, digits, hyphens and slashes.',
    }
  }
  if (!SITE_PATH_PATTERN.test(to)) {
    return {
      ok: false,
      code: 'shape',
      field: 'to_path',
      message: 'A target is a site-relative path: lowercase letters, digits, hyphens and slashes.',
    }
  }
  if (from === to) {
    return { ok: false, code: 'self', message: 'A path cannot redirect to itself.' }
  }

  // The row being edited is not its own conflict.
  const others = existing.filter((row) => candidate.id === undefined || row.id !== candidate.id)

  const duplicate = others.find((row) => normaliseRedirectPath(row.from_path) === from)
  if (duplicate !== undefined) {
    return {
      ok: false,
      code: 'duplicate',
      message: `${from} already redirects to ${duplicate.to_path}. Edit that row instead.`,
      existing: duplicate,
    }
  }

  const loop = others.find(
    (row) =>
      normaliseRedirectPath(row.from_path) === to && normaliseRedirectPath(row.to_path) === from,
  )
  if (loop !== undefined) {
    return {
      ok: false,
      code: 'loop',
      message: `${to} already redirects back to ${from}; the two would loop.`,
      existing: loop,
    }
  }

  // The target is somebody's source: a visitor would be redirected twice.
  const onward = others.find((row) => normaliseRedirectPath(row.from_path) === to)
  if (onward !== undefined) {
    return {
      ok: false,
      code: 'chain',
      message: `${to} itself redirects to ${onward.to_path}. Point this redirect at ${onward.to_path} directly.`,
      existing: onward,
    }
  }

  // The source is somebody's target: the earlier redirect would now land on a redirect.
  const inbound = others.find((row) => normaliseRedirectPath(row.to_path) === from)
  if (inbound !== undefined) {
    return {
      ok: false,
      code: 'chain',
      message: `${inbound.from_path} already redirects to ${from}; redirecting ${from} onward would chain. Retarget that row to ${to} first.`,
      existing: inbound,
    }
  }

  return { ok: true }
}

/**
 * The rows that already form a chain — for the Redirects tab's warning column. Empty on a table
 * every write of which went through `validateRedirect`; non-empty only after a hand edit.
 */
export function chainedRedirects(rows: readonly RedirectRow[]): readonly RedirectRow[] {
  const sources = new Set(rows.map((row) => normaliseRedirectPath(row.from_path)))
  return rows.filter((row) => sources.has(normaliseRedirectPath(row.to_path)))
}
