/**
 * `generateStaticParams` for a route whose pre-rendering is an optimisation, not a visibility rule.
 *
 * WHY THIS EXISTS. Five routes ask the database at BUILD time which slugs to pre-render. When the
 * database does not answer, the read throws, and an unhandled throw inside `generateStaticParams`
 * fails **the entire production build** — not the one route, the whole site. That is a bad trade at
 * the best of times, and on 2026-09-12 it was the thing standing between a finished launch and a
 * site still serving its previous deploy:
 *
 *     Error: category failed validation: (database): Gateway Timeout
 *         at generateStaticParams (app/(site)/product/[slug]/page.tsx:79)
 *     Error: Failed to collect page data for /product/[slug]
 *
 * That was the fourth such failure — `/_not-found` (entity `page section`), `/product/[slug]`
 * (`category`), `/collections/[slug]` (`collection`), then `/product/[slug]` again. Four routes,
 * four entities, one cause, and each was followed by a green build with no code change between.
 * See ROADMAP E9.
 *
 * IT IS SAFE TO RETURN NOTHING, and that is the whole argument. `dynamicParams` defaults to `true`
 * and none of these routes overrides it, so a slug absent from `generateStaticParams` is rendered
 * on request and cached from there — the pages stay reachable, the catalogue stays complete, and
 * the first visitor pays for the render instead of the build. `/product/[slug]` already says as
 * much in its own comment: *pre-rendering is an optimisation, not the visibility rule.* (This would
 * NOT hold under Cache Components, where `dynamicParams` is unavailable; `next.config.ts` does not
 * enable it, and turning it on means revisiting this file.)
 *
 * WHY IT CATCHES EVERYTHING rather than matching the failure it was written for.
 * `/journal/[slug]` and `/portfolio/[slug]` already do the narrow version of this — they match
 * PostgREST's `42P01` / `PGRST205` and return `[]`, for a reason their comment states exactly:
 * *a build against an environment whose schema cache has not caught up with a migration would
 * otherwise fail the whole site's build rather than this one route. Seen once already, on Vercel,
 * in Phase 17.* The reasoning was right and the predicate was too narrow — a timeout is not a
 * missing table, so the guard did not fire, and the build failed for the same reason a second time.
 * Enumerating failure modes is how the next unlisted one gets through, so this asks the question
 * that actually decides the behaviour — *did the read succeed?* — rather than *which way did it
 * fail?*
 *
 * IT IS LOUD. Degrading silently would turn "the database was slow" into "these pages are
 * mysteriously not pre-rendered", which is worse than the build failing, because nobody learns it.
 * The warning names the route and the cause and appears in the Vercel build log beside the routes
 * that did pre-render.
 */

/** The message, without assuming the thrown value is an Error. */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Run a build-time params read, degrading to "pre-render nothing on this route" if it fails.
 *
 * @param route  The route pattern, for the warning — e.g. `/product/[slug]`.
 * @param read   The database read that yields the params.
 */
export async function prerenderParams<T>(
  route: string,
  read: () => Promise<readonly T[]>,
): Promise<T[]> {
  try {
    return [...(await read())]
  } catch (error) {
    console.warn(
      `[prerender] ${route}: nothing pre-rendered — the database did not answer at build time ` +
        `(${describe(error)}). These pages render on request instead; the build is not failed for ` +
        `an optimisation. If this line is in every build, the cause is not transient — see ROADMAP E9.`,
    )
    return []
  }
}
