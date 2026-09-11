import { logSystem } from '@/lib/logging/system-log'

/**
 * Where the scraper says something went wrong, until Phase 38 gives it somewhere better.
 *
 * `system_logs` IS PHASE 38'S TABLE AND IT DOES NOT EXIST YET. The phase document asks for a
 * `WARNING` system log when a circuit opens or the kill switch stops a tick, and the honest
 * position is that the destination for that line has not been built. Two things are done instead,
 * and neither pretends to be the third: the line is written to the console, which on Vercel IS the
 * cron invocation's log and is exactly where somebody asking "did the 09:00 tick do anything"
 * looks; and the reason is returned in the tick summary, so the route's JSON response says it too.
 *
 * THIS MODULE IS THE SEAM. Phase 38 replaces the body of `warnScraper` with a `system_logs` insert
 * and every call site is already correct — which is the point of routing them through one function
 * now rather than scattering `console.warn` through the drain loop.
 *
 * NO SECRET, NO URL WITH CREDENTIALS, NO RESPONSE BODY reaches these lines. The context is a source
 * slug and a count; a competitor's page body is never logged, and neither is anything from D8.
 */

export type ScraperLogLevel = 'WARNING' | 'ERROR'

export interface ScraperLogLine {
  readonly level: ScraperLogLevel
  readonly event: string
  readonly message: string
  readonly context?: Record<string, string | number>
  /** Phase 38: the run and source the line belongs to, for `/studio/operations/logs` filters. */
  readonly runId?: string | null
  readonly sourceId?: string | null
}

export function warnScraper(line: ScraperLogLine): void {
  const context =
    line.context === undefined
      ? ''
      : ` ${Object.entries(line.context)
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(' ')}`
  // One line, structured enough to grep and short enough to read. `console.warn` rather than
  // `console.error` so a paused source does not read as a crash.
  console.warn(`[scraper] ${line.level} ${line.event} ${line.message}${context}`)
  // PHASE 38 FILLS THE SEAM PHASE 25 LEFT: the same line goes to system_logs on the SCRAPER
  // channel, redacted and deduplicated there, fire-and-forget so a slow log never slows a fetch.
  void logSystem({
    level: line.level,
    channel: 'SCRAPER',
    event: line.event,
    message: line.message,
    context: line.context ?? {},
    workflowRunId: line.runId ?? null,
    researchSourceId: line.sourceId ?? null,
  })
}
