import { readBuildInfo, shortSha } from '@/lib/ops/build-info'

/**
 * A BAND ACROSS THE TOP OF EVERY NON-PRODUCTION DEPLOYMENT — Phase 44, RC-362.
 *
 * THE FAILURE IT PREVENTS IS A PERSON, NOT A MACHINE. Somebody opens a preview URL, sees the real
 * site, and reports a bug against content that was never published — or worse, believes a draft
 * price. Vercel's deployment protection stops a stranger; it does not stop a colleague with the
 * link from forgetting which deployment they are looking at.
 *
 * IT RENDERS NOTHING IN PRODUCTION, and the test is on the value rather than on its absence: only
 * the literal `production` suppresses it. A missing `VERCEL_ENV` — a local `next dev`, a build
 * somebody ran by hand — shows the ribbon, because the safe direction is to say which environment
 * this is rather than to assume it is the real one.
 *
 * A SERVER COMPONENT READING BUILD-TIME INFORMATION, so it costs no JavaScript and cannot be
 * dismissed. A dismissible ribbon is dismissed on the first day and never seen again.
 *
 * IT NAMES THE COMMIT, because "which preview is this" is the question immediately after "is this
 * production". Seven characters of a SHA is an identifier, not a secret — D8 distinguishes the two,
 * and the whole Phase 38 environment page rests on that distinction.
 *
 * IT IS NOT A BANNER COMPONENT WITH A `variant`. There is one message, it is not configurable, and
 * a prop that let a caller change the words would eventually let a caller render it in production
 * saying something reassuring.
 */
export function EnvironmentRibbon(): React.ReactElement | null {
  const build = readBuildInfo()
  if (build.environment === 'production') return null

  return (
    <div
      // `role="status"` rather than `alert`: standing context about the page, present from first
      // paint. An alert would interrupt a screen reader on every navigation.
      role="status"
      data-environment-ribbon={build.environment}
      className="sticky top-0 z-50 border-b border-line bg-state-warning-soft px-4 py-1 text-center text-xs text-ink"
    >
      {`${build.environment.toUpperCase()} — not the live site. Content here may be unpublished or untrue. Build ${shortSha(build.sha)}`}
    </div>
  )
}
