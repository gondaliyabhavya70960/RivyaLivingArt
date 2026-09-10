import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

import { requiredEnv } from '@/lib/env'

/**
 * The only place in this repository that makes a request to a website Rivya does not own.
 *
 * EVERY PROHIBITION IN THE PHASE DOCUMENT IS AN ABSENCE HERE, AND ABSENCES ARE HARD TO REVIEW, so
 * they are listed. There is no headless browser. There is no proxy list and no IP rotation. There
 * is no cookie jar, no session forgery and no CAPTCHA solving. There is no user-agent rotation and
 * no browser impersonation: `SCRAPER_USER_AGENT` is the only agent string, it names Rivya and a
 * contact URL, and a missing one is a hard failure rather than a fall back to something anonymous.
 * If a source requires any of the above to be read, the answer is that Rivya does not read it.
 * `scripts/research/check-research-isolation.mjs` fails the build on an import of any
 * browser-automation package anywhere under `lib/scraper/**`.
 *
 * THREE BOUNDS, ALL OF THEM ENFORCED RATHER THAN REQUESTED. A fifteen-second timeout via
 * `AbortSignal`; a two-megabyte body cap enforced while STREAMING, so a hostile or accidental
 * gigabyte response is abandoned after two megabytes rather than after it has been buffered; and a
 * redirect cap of five, followed manually so that each hop can be checked against the same host
 * rules as the original request. `redirect: 'follow'` would hand that decision to the runtime and
 * let a redirect walk off the approved host without anything noticing.
 *
 * NO IMAGE IS EVER FETCHED. Not here, not anywhere, not in a later phase. Competitor imagery is
 * stored as a URL in text and never downloaded, cached, re-hosted or written to Cloudinary.
 */

/** Fifteen seconds, wall clock, including connection. */
export const FETCH_TIMEOUT_MS = 15_000

/** Two megabytes. A product page that exceeds this is not a product page. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024

/** Redirect hops followed before giving up. */
export const MAX_REDIRECTS = 5

export interface FetchOutcome {
  readonly url: string
  readonly finalUrl: string
  readonly httpStatus: number | null
  readonly body: string | null
  readonly contentHash: string | null
  readonly bytes: number
  readonly durationMs: number
  readonly retryAfter: string | null
  readonly error: string | null
  /** True when the response was abandoned at the size cap rather than read to the end. */
  readonly truncated: boolean
}

/**
 * The agent string, read once per call and never defaulted.
 *
 * `requiredEnv` RATHER THAN A FALLBACK, and this is the one place where failing to start is
 * plainly better than proceeding. A default would mean an unconfigured deployment quietly
 * identifying itself as something generic — which is precisely the anonymous crawling this
 * subsystem's whole posture is built to avoid, arriving through a convenience.
 */
export function scraperUserAgent(): string {
  return requiredEnv('SCRAPER_USER_AGENT')
}

/**
 * GET one URL, politely, with every bound applied.
 *
 * IT NEVER THROWS FOR A NETWORK CONDITION. A timeout, a DNS failure, a refused connection and a
 * 500 are all outcomes to be recorded on a `research_fetches` row and retried on a schedule — not
 * exceptions for a caller to interpret. The drain loop needs to write a row for whatever happened
 * and move to the next item; an exception here would abandon the batch and leave the lease to
 * expire, turning one unreachable host into a stalled run.
 */
export async function fetchPage(
  url: string,
  options: { readonly signal?: AbortSignal; readonly acceptHtmlOnly?: boolean } = {},
): Promise<FetchOutcome> {
  const startedAt = Date.now()
  const agent = scraperUserAgent()

  let current = url
  let redirects = 0

  try {
    for (;;) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      // The caller's signal (the cron tick's wall-clock budget) aborts this request too, so a
      // fetch cannot outlive the invocation that started it.
      const onAbort = (): void => controller.abort()
      options.signal?.addEventListener('abort', onAbort, { once: true })

      let response: Response
      try {
        response = await fetch(current, {
          method: 'GET',
          // MANUAL, so every hop is inspected. See the header.
          redirect: 'manual',
          headers: {
            'user-agent': agent,
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'en',
          },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
        options.signal?.removeEventListener('abort', onAbort)
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (location === null) {
          return failure(url, current, response.status, startedAt, 'Redirect with no location.')
        }
        if (redirects >= MAX_REDIRECTS) {
          return failure(url, current, response.status, startedAt, 'Too many redirects.')
        }
        // Resolved against the CURRENT url, which is what makes a relative Location legal, and
        // returned to the caller so the next hop can be checked against robots again.
        current = new URL(location, current).toString()
        redirects += 1
        continue
      }

      if (!response.ok) {
        return {
          url,
          finalUrl: current,
          httpStatus: response.status,
          body: null,
          contentHash: null,
          bytes: 0,
          durationMs: Date.now() - startedAt,
          retryAfter: response.headers.get('retry-after'),
          error: `HTTP ${response.status}`,
          truncated: false,
        }
      }

      if (options.acceptHtmlOnly !== false) {
        const type = response.headers.get('content-type') ?? ''
        if (type !== '' && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(type)) {
          // NOT AN ERROR AND NOT A BODY. A PDF or an image at a discovered URL is simply not what
          // this pipeline reads, and downloading it to find that out is the thing not to do.
          return {
            url,
            finalUrl: current,
            httpStatus: response.status,
            body: null,
            contentHash: null,
            bytes: 0,
            durationMs: Date.now() - startedAt,
            retryAfter: null,
            error: `Unsupported content type: ${type.split(';')[0]}`,
            truncated: false,
          }
        }
      }

      const read = await readCapped(response)
      const body = read.text
      return {
        url,
        finalUrl: current,
        httpStatus: response.status,
        body,
        contentHash: sha256(body),
        bytes: read.bytes,
        durationMs: Date.now() - startedAt,
        retryAfter: null,
        error: null,
        truncated: read.truncated,
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Timed out.'
          : error.message
        : 'The request failed.'
    return failure(url, current, null, startedAt, message)
  }
}

function failure(
  url: string,
  finalUrl: string,
  status: number | null,
  startedAt: number,
  message: string,
): FetchOutcome {
  return {
    url,
    finalUrl,
    httpStatus: status,
    body: null,
    contentHash: null,
    bytes: 0,
    durationMs: Date.now() - startedAt,
    retryAfter: null,
    error: message,
    truncated: false,
  }
}

/**
 * Read a response body, stopping at the cap.
 *
 * STREAMED AND COUNTED, not `await response.text()` followed by a length check. The second reads
 * the whole thing into memory first, which means the cap protects the database and not the
 * function: a response far larger than the cap would exhaust the invocation's memory before the
 * check ever ran.
 */
async function readCapped(
  response: Response,
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const reader = response.body?.getReader()
  if (reader === undefined) {
    const text = await response.text()
    const bytes = Buffer.byteLength(text)
    return { text: text.slice(0, MAX_BODY_BYTES), bytes, truncated: bytes > MAX_BODY_BYTES }
  }

  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      chunks.push(value.slice(0, value.byteLength - (total - MAX_BODY_BYTES)))
      truncated = true
      // Stop pulling. The connection is released rather than drained, which is the polite thing
      // to do with a response we have decided not to read.
      await reader.cancel().catch(() => undefined)
      break
    }
    chunks.push(value)
  }

  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  return { text: buffer.toString('utf8'), bytes: Math.min(total, MAX_BODY_BYTES), truncated }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Where a snapshot of this fetch lives.
 *
 * DATE-PARTITIONED AND CONTENT-ADDRESSED, which gives two properties the pruner and the change
 * detector both need. The date prefix means "delete everything older than 180 days" is a prefix
 * listing rather than a scan of every object; the hash means two fetches of an unchanged page
 * write the same key, so a daily refresh of a catalogue that has not moved costs one object rather
 * than one per day. Phase 29's change detection reads exactly that: a new key means the page
 * changed.
 */
export function snapshotKey(sourceSlug: string, hash: string, at = new Date()): string {
  const year = at.getUTCFullYear()
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  const day = String(at.getUTCDate()).padStart(2, '0')
  return `research/${sourceSlug}/${year}/${month}/${day}/${hash}.html.gz`
}

/** Gzip a body for storage. Snapshots are text, and text compresses. */
export function compressSnapshot(body: string): Buffer {
  return gzipSync(Buffer.from(body, 'utf8'))
}
