/**
 * The publish window — one rule, stated once.
 *
 * IT EXISTS IN THREE PLACES AND MUST MEAN THE SAME THING IN ALL THREE: the RLS `publicClause` on
 * `pages` and `page_sections` (migration 0051), a table check that `unpublish_at > publish_at`
 * (0050), and this function, which the resolver and the schedule cron both use. A window that is
 * half-open in SQL and closed in TypeScript would put a section on the public site for exactly one
 * tick after it should have gone — visible to a visitor, invisible to the editor looking at the
 * Studio, and reproducible only at the moment it stops happening.
 *
 * HALF-OPEN, `[publish_at, unpublish_at)`. `publish_at <= now` and `unpublish_at > now`. The
 * asymmetry is deliberate: a section scheduled to unpublish at 09:00 is gone AT 09:00, not one
 * moment after, which is what an editor setting that time means. Making both bounds inclusive
 * would leave a one-instant overlap where a replacement and the thing it replaces are both live.
 *
 * `now` IS AN ARGUMENT, NEVER READ FROM THE CLOCK. Same reason `lib/media/migration.ts` takes its
 * timestamps: a function that reads the clock cannot be tested at a boundary, and the boundaries
 * are the whole content of this rule. The only place a real clock enters is `resolvePage`, which
 * takes it as a default parameter so a caller can override it.
 */
export type Window = {
  readonly publish_at: string | null
  readonly unpublish_at: string | null
}

export function isInWindow(row: Window, now: Date): boolean {
  if (row.publish_at !== null && new Date(row.publish_at) > now) return false
  if (row.unpublish_at !== null && new Date(row.unpublish_at) <= now) return false
  return true
}

/**
 * Is this row live to the public at `now`?
 *
 * Status AND window, because either alone is a half-answer: a PUBLISHED row outside its window is
 * not live, and a row inside its window that was never published is not live either. The RLS
 * clause tests exactly this pair, and so must anything that predicts what RLS will return.
 */
export function isLive(row: Window & { readonly status: string }, now: Date): boolean {
  return row.status === 'PUBLISHED' && isInWindow(row, now)
}

/**
 * The next moment this row's liveness changes, or `null` if it never will.
 *
 * The schedule cron uses it to explain itself: "publishes in 4 minutes" is a far more useful thing
 * to show an editor than a raw timestamp they have to compare against their own clock.
 */
export function nextTransitionAt(row: Window, now: Date): Date | null {
  const publish = row.publish_at === null ? null : new Date(row.publish_at)
  const unpublish = row.unpublish_at === null ? null : new Date(row.unpublish_at)

  if (publish !== null && publish > now) return publish
  if (unpublish !== null && unpublish > now) return unpublish
  return null
}
