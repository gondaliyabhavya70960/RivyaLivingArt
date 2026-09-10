#!/usr/bin/env tsx
/**
 * research:reextract — re-run one source's adapter over STORED SNAPSHOTS, and write the versions
 * that result. It makes no request to anybody's server, and that is the claim the file is built
 * around rather than a property it happens to have.
 *
 *   npx tsx scripts/research/reextract.ts --source=<slug>
 *   npx tsx scripts/research/reextract.ts --source=<slug> --since=2026-01-01 --dry-run
 *   npx tsx scripts/research/reextract.ts --source=<slug> --limit=50
 *
 * RE-DERIVATION HAPPENS FROM STORED EVIDENCE AND NEVER FROM A RE-FETCH. The bytes replayed here
 * were captured by `core/fetch.ts` on a run that had already passed the kill switch, the policy
 * review, `core/robots.ts` and the source's own politeness clock, and were gzipped into the private
 * snapshot bucket with a `research_fetches` row recording that the request happened. Replaying them
 * asks a question about RIVYA's code — does the adapter read this page correctly now — and that
 * question needs no second visit to somebody else's server. A script that re-requested the pages in
 * order to test a parser would spend a source's goodwill proving something about a local change,
 * and it would do it at whatever rate a developer's `for` loop happens to run at.
 *
 * SO THE FETCHER IS NOT IMPORTED, AND THE ABSENCE IS ENFORCED RATHER THAN PROMISED.
 * `tests/unit/reextract.test.ts` reads this file off disk and fails if it calls the global request
 * function or imports `lib/scraper/core/fetch`, `undici`, `axios` or a node HTTP module. A static
 * check is the right shape there because the failure it guards against is a FUTURE EDIT — somebody
 * adding "just refresh the page if the snapshot was pruned" — not a bug that is here today.
 *
 * THIS IS THE FIRST OF THE THREE OFFLINE RECOMPUTATION SCRIPTS AND IT SETS THEIR PATTERN.
 * `renormalize.ts` (Phase 28) and `reclassify-scale.ts` (Phase 30) follow it: derive a layer from
 * stored evidence, never from a re-fetch, never over a human's correction, and report what moved.
 * The shape below — a pure argument parser, a read-only `plan()` and a `reextract()` that writes
 * only what `plan()` proposed — is what makes `--dry-run` a structural fact rather than a flag
 * somebody remembered to check: `plan()` is given no way to write anything.
 *
 * WHAT IT WRITES, AND WHAT IT REFUSES TO WRITE. A replayed page that produces a draft whose content
 * hash differs from the product's CURRENT version writes one new `research_product_versions` row
 * and advances `research_products.current_version_id`, exactly as `workflows/extract.ts` does and
 * for the same reasons. It writes `run_id: null` and `fetch_id: null`, because a replay belongs to
 * no run and read no response — inventing either would put a plausible lie in a column somebody
 * later reasons from, and a row in the run detail screen for work that requested nothing. It never
 * creates a `research_products` row: a snapshot whose URL has never produced a product is a page
 * the pipeline has not accepted as a product, and admitting one here would make a validation
 * exercise into an import. Those are counted and reported instead, because that count is precisely
 * what an adapter fix is trying to change, and the honest next step for it is a `REFRESH` job.
 *
 * NOTHING IS MUTATED AND NOTHING IS DELETED. `research_product_versions` is append-only by design —
 * Phase 29 diffs consecutive rows — so the worst a mistaken replay costs is a version row that says
 * what an adapter read on a day somebody was testing it, with the adapter key and version on it.
 * That is why `--dry-run` is the FLAG here while `--apply` is the flag in
 * `scripts/research/prune-snapshots.ts`, whose default has to be the harmless one because it
 * deletes objects out of a bucket. The phase document fixes this script's spelling; the asymmetry
 * with its neighbour is deliberate rather than an inconsistency.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { RawProductDraft } from '../../lib/scraper/adapters/draft-schema'
import { getAdapter } from '../../lib/scraper/adapters/execution'
import type {
  AdapterContext,
  AdapterLogger,
  FetchedPage,
  SourceAdapter,
} from '../../lib/scraper/adapters/types'
import { draftContentHash } from '../../lib/scraper/core/content-hash'
import { warnScraper } from '../../lib/scraper/core/log'
import {
  makeBudget,
  runAdapterExtract,
  type AdapterCallOutcome,
} from '../../lib/scraper/core/run-adapter'
import {
  matchUrl,
  type SourceUrlPattern,
  type UrlPatternKind,
} from '../../lib/scraper/core/url-patterns'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import { listFetchesForRun } from '../../lib/supabase/repositories/research/fetches'
import {
  getCurrentVersion,
  recordProductVersion,
} from '../../lib/supabase/repositories/research/product-versions'
import {
  getResearchProductBySourceUrl,
  setCurrentVersionId,
} from '../../lib/supabase/repositories/research/products'
import { listResearchRuns } from '../../lib/supabase/repositories/research/runs'
import { readSnapshot } from '../../lib/supabase/repositories/research/snapshots'
import { listUrlPatterns } from '../../lib/supabase/repositories/research/source-config'
import {
  listResearchSources,
  type ResearchSourceRow,
} from '../../lib/supabase/repositories/research/sources'

type Client = SupabaseClient<Database>

/* --- Arguments ---------------------------------------------------------------------------------- */

/** How many snapshots one invocation replays unless `--limit` says otherwise. */
export const DEFAULT_REPLAY_LIMIT = 200

/**
 * The ceiling on `--limit`.
 *
 * A BOUND RATHER THAN NONE, BECAUSE EVERY REPLAY IS A DOWNLOAD AND A GUNZIP. Five thousand pages of
 * a competitor's markup decompressed in one process is a lot of memory held for no reason a person
 * asked for, and an operator who genuinely wants more history than this can run the script again
 * with an older `--since`. A refused number is visible; an invocation that quietly swallowed the
 * machine is not.
 */
export const MAX_REPLAY_LIMIT = 5000

/** What one invocation was asked to do, once the flags have been read and checked. */
export interface ReextractOptions {
  readonly sourceSlug: string
  /** Snapshots fetched before this instant are not replayed. `null` replays everything found. */
  readonly since: Date | null
  readonly dryRun: boolean
  readonly limit: number
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: ReextractOptions }
  | { readonly ok: false; readonly error: string }

/** `--since` is a calendar day, and only a calendar day. See `parseArgs` for why it is read as UTC. */
const SINCE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Read the command line, or say exactly what is wrong with it.
 *
 * IT RETURNS A RESULT RATHER THAN EXITING, WHICH IS WHAT MAKES IT TESTABLE AT ALL. A parser that
 * called `process.exit` could only be exercised by running the CLI, and the argument handling is
 * the half of this script most likely to be wrong in a way nobody notices — a misread `--since`
 * silently replays the wrong decade. `main()` owns the exit; this owns the reading.
 *
 * AN UNRECOGNISED ARGUMENT IS AN ERROR, NOT SOMETHING TO IGNORE. The flag this script would most
 * like to have honoured is `--dry-run`, and the cost of ignoring an unknown token is that
 * `--dryrun`, `-dry-run` or `--dry_run` runs the writing path while its author believes they asked
 * for a report. Refusing what we do not understand is the only reading of an unknown flag that
 * cannot do that.
 *
 * ONE FORM, `--flag=value`, AND NO SPACE-SEPARATED VARIANT. Accepting `--source <slug>` as well
 * would make `--source --dry-run` parse the second flag as the slug and then run against a source
 * that does not exist, which is a confusing failure at best and the wrong source at worst.
 *
 * `--since` IS READ AS UTC MIDNIGHT, DELIBERATELY. `research_fetches.fetched_at` is `timestamptz`
 * and PostgREST renders it in UTC, so the comparison this filter feeds is a UTC one. Reading the
 * day in the operator's local zone would replay a different set of snapshots depending on which
 * machine the command was typed on — the same command, two answers, and no way to tell from the
 * output which one you got.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  let sourceSlug: string | null = null
  let since: Date | null = null
  let dryRun = false
  let limit = DEFAULT_REPLAY_LIMIT

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg.startsWith('--source=')) {
      sourceSlug = arg.slice('--source='.length).trim()
      continue
    }

    if (arg.startsWith('--since=')) {
      const raw = arg.slice('--since='.length).trim()
      if (!SINCE_PATTERN.test(raw)) {
        return { ok: false, error: `--since must be a calendar day as YYYY-MM-DD, not '${raw}'.` }
      }
      /*
       * THE ROUND TRIP IS THE CHECK, AND THE PATTERN ABOVE IS NOT ENOUGH ON ITS OWN. `2026-02-30`
       * matches the shape, and V8 does not reject it: it falls back to a lenient parser and hands
       * back 2 March. A rolled-forward date is the worst kind of wrong an operator can be handed,
       * because it is plausible — the replay runs, reports a number, and covers a window nobody
       * asked for. Comparing the input against what the parsed instant renders back as is the only
       * form of this check that catches it. Verified against this runtime rather than assumed.
       */
      const parsed = new Date(`${raw}T00:00:00.000Z`)
      if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(`${raw}T`)) {
        return { ok: false, error: `--since is not a real date: '${raw}'.` }
      }
      since = parsed
      continue
    }

    if (arg.startsWith('--limit=')) {
      const raw = arg.slice('--limit='.length).trim()
      // `Number` rather than `parseInt`, because `parseInt('50x')` is 50 and a truncated number is
      // the one kind of wrong limit an operator cannot see in the output.
      const parsed = Number(raw)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_REPLAY_LIMIT) {
        return {
          ok: false,
          error: `--limit must be a whole number between 1 and ${MAX_REPLAY_LIMIT}, not '${raw}'.`,
        }
      }
      limit = parsed
      continue
    }

    return { ok: false, error: `Unrecognised argument '${arg}'.` }
  }

  if (sourceSlug === null || sourceSlug === '') {
    return { ok: false, error: '--source=<slug> is required. There is no "every source" replay.' }
  }

  return { ok: true, value: { sourceSlug, since, dryRun, limit } }
}

/* --- What is replayed --------------------------------------------------------------------------- */

/**
 * One stored snapshot, reduced to what a replay needs from its `research_fetches` row.
 *
 * `url` IS THE FINAL URL THE BYTES CAME FROM, NOT THE ONE THAT WAS REQUESTED, and the difference is
 * load-bearing rather than pedantic. `FetchedPage.url` is documented as the address every relative
 * href on the page resolves against, and `workflows/extract.ts` records a product sighting AT that
 * address — so a replay that handed over the requested URL would look up a product under a key
 * nothing was ever stored against, report every page as having no product, and write nothing at
 * all while reporting success.
 *
 * `bodyHash` IS THE HASH OF THE RESPONSE BODY AND IT IS EMPHATICALLY NOT WHAT DEDUPLICATES A
 * VERSION. It is carried because the row has it and `FetchedPage` has somewhere to put it; the hash
 * a version is keyed on is `draftContentHash`, over the fifteen fields the source published. Two
 * captures of one page differing only in a rotating banner have different body hashes and one draft
 * hash, which is the whole reason `core/content-hash.ts` exists.
 */
export interface StoredSnapshot {
  readonly fetchId: string
  readonly url: string
  readonly storageKey: string
  readonly bodyHash: string | null
  /** ISO-8601, as PostgREST rendered `fetched_at`. Compared as an instant, never as a string. */
  readonly fetchedAt: string
}

/**
 * What one snapshot turned out to be worth. Five outcomes, because five different things happen.
 *
 * `UNREADABLE` is the object being gone or corrupt — a pruned snapshot, a bucket that answered with
 * nothing, a gzip member that will not decompress. `FAILED` is `core/run-adapter.ts`'s verdict on
 * the adapter call: a throw, an overrun or a draft that does not parse. `NO_PRODUCT` is a page this
 * pipeline has never recorded a product for. `UNCHANGED` is the ordinary good outcome — the adapter
 * read exactly what is already stored. `NEW_VERSION` is the one that writes.
 *
 * COLLAPSING ANY TWO OF THEM WOULD MAKE THE REPORT USELESS FOR ITS ONE JOB. An adapter fix is being
 * judged by whether `FAILED` fell and `NEW_VERSION` rose; folding `UNREADABLE` into `FAILED` would
 * attribute a pruned snapshot to the adapter, and folding `NO_PRODUCT` into `UNCHANGED` would hide
 * exactly the pages the fix was written for.
 */
export type ReplayVerdict = 'UNREADABLE' | 'FAILED' | 'NO_PRODUCT' | 'UNCHANGED' | 'NEW_VERSION'

/** One snapshot's verdict, with everything a write would need already in hand. */
export interface ReplayDecision {
  readonly snapshot: StoredSnapshot
  readonly verdict: ReplayVerdict
  /** A reason, for the verdicts that have one. Never a page body — see `core/run-adapter.ts`. */
  readonly detail: string | null
  readonly productId: string | null
  readonly draft: RawProductDraft | null
  readonly contentHash: string | null
}

/**
 * Everything `plan()` may do, and it is all reading.
 *
 * PORTS RATHER THAN A CLIENT, FOR THE REASON `AdapterContext` TAKES NOTHING IT DOES NOT NEED. A
 * `plan()` holding a Supabase client could write, and "it does not" would then be a claim about the
 * body of a function rather than about its type. Given these three functions it cannot: there is no
 * insert to reach. That is what makes `--dry-run` structural, and it is also what lets the suite
 * exercise the whole decision pass with no database, no bucket and no environment variable.
 */
export interface PlanPorts {
  /** The decompressed page body, or `null` when the object is gone or will not decompress. */
  readonly loadSnapshot: (snapshot: StoredSnapshot) => Promise<string | null>
  readonly extract: (page: FetchedPage) => Promise<AdapterCallOutcome<RawProductDraft>>
  /** The product recorded at this URL and the content hash its current version carries. */
  readonly readProduct: (
    sourceUrl: string,
  ) => Promise<{ readonly id: string; readonly currentContentHash: string | null } | null>
}

/** The one thing a live run may do that a dry run may not. Returns whether a row was created. */
export interface WritePorts {
  readonly writeVersion: (decision: ReplayDecision) => Promise<boolean>
}

/** What the invocation did, in the vocabulary the console summary prints. */
export interface ReextractReport {
  readonly considered: number
  readonly replayed: number
  readonly unreadable: number
  readonly failed: number
  readonly withoutProduct: number
  readonly unchanged: number
  /** Decisions that WOULD write a version. Equal to `written` on a live run with no write refused. */
  readonly newVersions: number
  /** Versions actually created. Zero on a dry run, always. */
  readonly written: number
  readonly decisions: readonly ReplayDecision[]
}

/**
 * Which of the snapshots found are actually replayed, in which order.
 *
 * PURE, TOTAL AND EXPORTED, because the three rules below are the ones a reader most needs to be
 * able to check without a database in the room.
 *
 * NEWEST FIRST, WHICH IS THE ORDER AN ADAPTER FIX IS JUDGED IN. Somebody validating a parser change
 * wants the pages as the site serves them TODAY; the older captures are history and are worth
 * replaying second. It also makes `--limit` mean something useful — "the most recent N" rather than
 * "N arbitrary pages".
 *
 * ONE REPLAY PER (URL, KEY) PAIR, AND THE DEDUPLICATION IS NOT AN OPTIMISATION. A snapshot key is
 * content-addressed (`core/fetch.ts`), so a nightly pass over a page nobody has edited writes the
 * SAME key every night and the fetch rows pointing at it are one observation recorded many times.
 * Replaying all of them would download and decompress identical bytes once per night of history,
 * produce an identical draft each time, and spend the whole `--limit` on one page. The pair rather
 * than the key alone, because two different URLs serving byte-identical markup on the same day do
 * share a key — a discontinued-item stub is the ordinary case — and each of those is a different
 * product to look up.
 *
 * `--since` COMPARES INSTANTS, NEVER STRINGS. ISO-8601 in UTC happens to sort lexicographically,
 * which is exactly the coincidence that produces a filter nobody notices is broken the day a value
 * arrives with an offset or a different fractional precision.
 */
export function selectSnapshots(
  snapshots: readonly StoredSnapshot[],
  options: ReextractOptions,
): readonly StoredSnapshot[] {
  const sinceMs = options.since === null ? null : options.since.getTime()

  const fresh = snapshots.filter((snapshot) => {
    if (sinceMs === null) return true
    const at = Date.parse(snapshot.fetchedAt)
    // AN UNPARSEABLE TIMESTAMP IS KEPT, NOT DROPPED. `--since` narrows a replay; a row whose date
    // cannot be read has not been shown to fall outside the window, and silently omitting it would
    // make the report quietly incomplete in the one direction nobody checks.
    return Number.isNaN(at) || at >= sinceMs
  })

  const newestFirst = [...fresh].sort(byFetchedAtDescending)

  const seen = new Set<string>()
  const unique: StoredSnapshot[] = []
  for (const snapshot of newestFirst) {
    const identity = `${snapshot.url} ${snapshot.storageKey}`
    if (seen.has(identity)) continue
    seen.add(identity)
    unique.push(snapshot)
    if (unique.length >= options.limit) break
  }

  return unique
}

/**
 * `fetchedAt` descending, with the fetch id as a fixed tiebreak.
 *
 * THE TIEBREAK IS ARBITRARY AND FIXED, WHICH IS `listVersionsForProduct`'s ARGUMENT. Two captures
 * in the same millisecond say nothing about which came first, but a list that reordered itself
 * between two runs of the same command is one nobody trusts to be complete — and here it would also
 * change WHICH page survives the deduplication above.
 */
function byFetchedAtDescending(a: StoredSnapshot, b: StoredSnapshot): number {
  const left = Date.parse(a.fetchedAt)
  const right = Date.parse(b.fetchedAt)
  const leftMs = Number.isNaN(left) ? 0 : left
  const rightMs = Number.isNaN(right) ? 0 : right
  if (leftMs !== rightMs) return rightMs - leftMs
  return a.fetchId < b.fetchId ? 1 : a.fetchId > b.fetchId ? -1 : 0
}

/**
 * Replay every selected snapshot and say what each one would produce. Writes nothing, ever.
 *
 * NOTHING BELOW THROWS FOR A SNAPSHOT IT CANNOT READ, WHICH IS `workflows/extract.ts`'s RULE APPLIED
 * TO A REPLAY. A missing object, an adapter that throws and a draft that will not parse are each
 * one snapshot's verdict and the loop moves on — an operator validating a fix over two hundred
 * pages must not have the run ended by the third one. What is deliberately NOT caught is a database
 * fault: if the product lookup fails for a reason that is not "no such row", that is a fault in
 * Rivya's own system and swallowing it would turn a broken deployment into a replay that quietly
 * reports every page as having no product.
 *
 * THE COMPARISON IS AGAINST THE PRODUCT'S CURRENT VERSION, AND THE CONSTRAINT IS STILL THE
 * AUTHORITY. `research_product_versions_unique_content` deduplicates against the WHOLE history, so
 * a draft equal to some older version is refused at the row even though the check here proposed it —
 * `recordProductVersion` reports that as `created: false` and the pointer is not advanced. The read
 * exists because `--dry-run` has to answer "how many versions would this write" without writing
 * one, and because both modes must report the same number.
 */
export async function plan(
  ports: PlanPorts,
  snapshots: readonly StoredSnapshot[],
  options: ReextractOptions,
): Promise<readonly ReplayDecision[]> {
  const selected = selectSnapshots(snapshots, options)
  const decisions: ReplayDecision[] = []

  for (const snapshot of selected) {
    const body = await ports.loadSnapshot(snapshot)
    if (body === null) {
      decisions.push(verdict(snapshot, 'UNREADABLE', 'The stored snapshot could not be read.'))
      continue
    }

    /*
     * `httpStatus` IS NULL AND THE OTHER TWO ARE NOT, WHICH IS EXACTLY WHAT `FetchedPage` ASKS FOR.
     * A replay has bytes and no response: there is no status because nothing answered, while the
     * key and the body hash are recorded facts about where the bytes came from. Inventing a `200`
     * would tell an adapter it was reading a live page.
     */
    const page: FetchedPage = {
      url: snapshot.url,
      body,
      contentHash: snapshot.bodyHash,
      storageKey: snapshot.storageKey,
      httpStatus: null,
    }

    const outcome = await ports.extract(page)
    if (!outcome.ok) {
      decisions.push(verdict(snapshot, 'FAILED', `${outcome.kind}: ${outcome.error}`))
      continue
    }

    const draft = outcome.value
    const contentHash = draftContentHash(draft)

    const product = await ports.readProduct(snapshot.url)
    if (product === null) {
      decisions.push(
        verdict(
          snapshot,
          'NO_PRODUCT',
          'No product has been recorded at this URL, so there is nothing to version.',
        ),
      )
      continue
    }

    decisions.push({
      snapshot,
      verdict: product.currentContentHash === contentHash ? 'UNCHANGED' : 'NEW_VERSION',
      detail: null,
      productId: product.id,
      draft,
      contentHash,
    })
  }

  return decisions
}

function verdict(
  snapshot: StoredSnapshot,
  kind: ReplayVerdict,
  detail: string | null,
): ReplayDecision {
  return { snapshot, verdict: kind, detail, productId: null, draft: null, contentHash: null }
}

/**
 * Plan, then write what the plan proposed — unless this is a dry run, in which case the writing
 * half is never reached.
 *
 * THE GATE IS ONE `if` AND IT IS THE ONLY ONE, because `plan()` cannot write and the loop below is
 * the only thing that can. Written the other way — a `dryRun` flag threaded into the decision pass
 * and consulted before each insert — every future edit would have to remember it, and the edit that
 * forgot would be the one nobody reviewed because it "only added a counter".
 *
 * A REFUSED WRITE IS COUNTED, NOT THROWN. `writeVersion` returns whether a row was CREATED, and
 * `false` is the ordinary answer for a draft that matches a version already in the product's
 * history — the constraint doing its job. The summary reports both numbers so a gap between
 * "proposed" and "written" is visible rather than rounded away.
 */
export async function reextract(
  ports: PlanPorts & WritePorts,
  snapshots: readonly StoredSnapshot[],
  options: ReextractOptions,
): Promise<ReextractReport> {
  const decisions = await plan(ports, snapshots, options)

  let written = 0
  if (!options.dryRun) {
    for (const decision of decisions) {
      if (decision.verdict !== 'NEW_VERSION') continue
      if (await ports.writeVersion(decision)) written += 1
    }
  }

  const count = (kind: ReplayVerdict): number =>
    decisions.filter((decision) => decision.verdict === kind).length

  return {
    considered: snapshots.length,
    replayed: decisions.length,
    unreadable: count('UNREADABLE'),
    failed: count('FAILED'),
    withoutProduct: count('NO_PRODUCT'),
    unchanged: count('UNCHANGED'),
    newVersions: count('NEW_VERSION'),
    written,
    decisions,
  }
}

/* --- The command ------------------------------------------------------------------------------- */

/** `.env.local`, if it is there. `migrate-higgsfield.ts`'s note is the long form of this one. */
const ENV_PATH = '.env.local'

/**
 * How many runs back the snapshot search walks, and how many fetch rows it reads from each.
 *
 * THESE TWO NUMBERS EXIST BECAUSE THE QUERY THIS SCRIPT WANTS DOES NOT. What it needs is one narrow
 * read — `research_fetches` for one source, `storage_key` not null, newest first, since a date —
 * and `lib/supabase/repositories/research/fetches.ts` does not publish it: that file offers
 * `listFetchesForRun` (by run) and `listExpiredSnapshots` (by cutoff, every source, oldest first,
 * two columns). Writing the query here is not an option — `scripts/db/check-data-layer.mjs` allows
 * `.from(` only under `lib/supabase/repositories/**`, and that gate is the reason there is one data
 * layer rather than ten — so the search is composed from the reads that do exist: walk the source's
 * runs newest first and read each one's fetch rows.
 *
 * WHAT THE COMPOSITION COSTS, STATED PLAINLY RATHER THAN LEFT TO BE DISCOVERED. It is one query per
 * run instead of one query in total; the run scan is across all sources, so a deployment with many
 * sources sees less of any one source's history than these numbers suggest; and a fetch row with no
 * `run_id` — the Phase 26 single-URL probe writes those — is not reachable this way at all. None of
 * those makes a replay wrong; each makes it narrower than it should be. The fix is a narrow
 * `listSnapshotsForSource(client, sourceId, { since, limit })` in that repository file, which this
 * change does not own, and it is the one piece of this script still owed.
 */
const RUN_SCAN_LIMIT = 500
const FETCHES_PER_RUN = 1000

/** A hard stop on candidates gathered, so a long history cannot fill memory before `--limit` bites. */
const MAX_CANDIDATES = 20_000

/** How many per-snapshot lines the summary prints before it stops listing them. */
const MAX_REPORTED_LINES = 20

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(`\n✗ ${parsed.error}`)
    console.error(
      '\n  Usage: npx tsx scripts/research/reextract.ts --source=<slug> ' +
        '[--since=YYYY-MM-DD] [--dry-run] [--limit=N]\n',
    )
    process.exit(1)
  }

  const options = parsed.value
  loadLocalEnv()
  const admin = createServiceRoleClient()

  const source = await findSourceBySlug(admin, options.sourceSlug)
  if (source === null) {
    console.error(`\n✗ No research source is configured with the slug '${options.sourceSlug}'.\n`)
    process.exit(1)
  }

  const adapter = getAdapter(source.adapter_key)
  if (adapter === null) {
    // A SOURCE-LEVEL FACT, AND THIS SCRIPT IS ONE SOURCE. The drain loop turns the same condition
    // into a `FAILED` adapter run because it has other sources to protect; here there is nothing
    // else in the invocation, so the honest outcome is to stop and say which key did not resolve.
    console.error(`\n✗ No adapter is registered for the key '${source.adapter_key}'.\n`)
    process.exit(1)
  }
  if (!adapter.capabilities.includes('EXTRACT')) {
    console.error(
      `\n✗ Adapter '${adapter.key}' does not declare EXTRACT, so there is nothing to replay.\n`,
    )
    process.exit(1)
  }

  const patterns = await readUrlPatterns(admin, source.id)
  const snapshots = await collectSnapshots(admin, source, options)

  console.log(`\n▸ replay · source ${source.slug} · adapter ${adapter.key}@${adapter.version}`)
  console.log(`  mode: ${options.dryRun ? 'dry run — nothing will be written' : 'writing'}`)
  if (options.since !== null) console.log(`  since: ${options.since.toISOString()}`)
  console.log(`  ${snapshots.length} stored snapshot(s) found, limit ${options.limit}`)

  const report = await reextract(
    {
      loadSnapshot: (snapshot) => loadSnapshotBody(admin, snapshot),
      extract: (page) => extractWithAdapter(adapter, source, patterns, page),
      readProduct: (sourceUrl) => readProductState(admin, source.id, sourceUrl),
      writeVersion: (decision) => writeVersion(admin, adapter, decision),
    },
    snapshots,
    options,
  )

  printReport(report, options)
}

/**
 * The service-role client, built here rather than imported from `lib/supabase/admin.ts`.
 *
 * THAT MODULE CARRIES `import 'server-only'`, WHICH THROWS OUTSIDE NEXT — EXACTLY AS IT IS MEANT TO.
 * `scripts/search/reindex.ts` records the same finding in its own header, and
 * `lib/scraper/adapters/execution.ts` is deliberately free of the marker for this script's sake. So
 * the two options are a client built from the same two D8 variables, or a script that cannot be run
 * at all. The env NAMES still come from `lib/supabase/env.ts`, so D8 remains written down once; what
 * is repeated here is the two `auth` options, and both exist for the same reason they do there — a
 * service-role client has no user session, and persisting or refreshing one would write the
 * service-role key into storage.
 *
 * THE KEY IS NEVER LOGGED, MEASURED OR DESCRIBED. `requiredEnv` fails on the NAME alone, and nothing
 * in this file prints, slices or lengths a value from the environment.
 */
function createServiceRoleClient(): Client {
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function loadLocalEnv(): void {
  if (!existsSync(ENV_PATH)) return
  try {
    process.loadEnvFile(ENV_PATH)
  } catch (error) {
    // The name of the problem, never its contents: that file holds live secrets.
    console.error(
      `Could not read ${ENV_PATH}: ${error instanceof Error ? error.message : 'unknown'}`,
    )
    process.exit(1)
  }
}

/**
 * One source, by the slug an operator types.
 *
 * BY SLUG BECAUSE THAT IS WHAT A PERSON HAS, and `getResearchSource` is by id. The list is read
 * whole and filtered here: `research_sources` holds one row per competitor an owner has added and
 * policy-approved, which is a table measured in tens, and a second lookup function for a table that
 * size would be a repository change to save a filter.
 */
async function findSourceBySlug(client: Client, slug: string): Promise<ResearchSourceRow | null> {
  const sources = await listResearchSources(client)
  return sources.find((source) => source.slug === slug) ?? null
}

/**
 * Every stored snapshot this script can reach for one source, newest run first.
 *
 * See `RUN_SCAN_LIMIT` for why the search is shaped like this and what it costs.
 *
 * A RUN THAT FINISHED BEFORE `--since` IS SKIPPED WITHOUT READING ITS FETCH ROWS, and the test is
 * `finished_at` rather than `queued_at` on purpose. A fetch always happens at or after its run was
 * queued but may happen long after — a run drained over several cron ticks is the ordinary case —
 * so a run QUEUED before the window can still hold snapshots inside it. A run that FINISHED before
 * the window cannot.
 */
async function collectSnapshots(
  client: Client,
  source: ResearchSourceRow,
  options: ReextractOptions,
): Promise<readonly StoredSnapshot[]> {
  const sinceMs = options.since === null ? null : options.since.getTime()
  const runs = await listResearchRuns(client, RUN_SCAN_LIMIT)
  const collected: StoredSnapshot[] = []

  for (const run of runs) {
    if (run.source_id !== source.id) continue
    if (sinceMs !== null && run.finished_at !== null && Date.parse(run.finished_at) < sinceMs) {
      continue
    }

    const fetchRows = await listFetchesForRun(client, run.id, FETCHES_PER_RUN)
    for (const row of fetchRows) {
      if (row.source_id !== source.id) continue
      if (row.storage_key === null) continue
      collected.push({
        fetchId: row.id,
        // The final URL, after redirects — see `StoredSnapshot`. `final_url` is null for a row
        // written before a response arrived, in which case the requested URL is all there is.
        url: row.final_url ?? row.url,
        storageKey: row.storage_key,
        bodyHash: row.content_hash,
        fetchedAt: row.fetched_at,
      })
      if (collected.length >= MAX_CANDIDATES) return collected
    }
  }

  return collected
}

/**
 * The stored bytes, decompressed, or `null`.
 *
 * NULL RATHER THAN A THROW ON EVERY FAILURE HERE, INCLUDING A CORRUPT MEMBER. `readSnapshot`
 * already answers `null` for an object that is gone — the 180-day pruner removes bodies and keeps
 * the fetch rows, so a replay over old history meets that constantly — and a gzip member that will
 * not decompress is the same fact arriving a step later. Both are `UNREADABLE`, which is a verdict
 * about the EVIDENCE and is reported separately from any verdict about the adapter.
 */
async function loadSnapshotBody(client: Client, snapshot: StoredSnapshot): Promise<string | null> {
  const blob = await readSnapshot(client, snapshot.storageKey)
  if (blob === null) return null

  try {
    return gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8')
  } catch {
    return null
  }
}

/**
 * One adapter call, through the one boundary adapter calls are allowed to go through.
 *
 * THE BUDGET IS NOT WIDENED, AND DECLINING THE KNOB IS THE DECISION WORTH RECORDING.
 * `AdapterCallOptions.budgetMs` exists partly for this caller — `core/run-adapter.ts` says so — on
 * the grounds that a replay runs against no cron ceiling. It is left at the production number
 * anyway, because the purpose of a replay is to predict what the nightly run will do: a replay that
 * allowed ten seconds would pass pages the run is going to fail, and an operator would enable an
 * adapter on evidence that was never about the environment it runs in.
 *
 * A FRESH BUDGET PER PAGE, for `workflows/extract.ts`'s reason — the budget bounds one item's work,
 * and one shared across two hundred pages would report the second page as already over.
 */
async function extractWithAdapter(
  adapter: SourceAdapter,
  source: ResearchSourceRow,
  patterns: readonly SourceUrlPattern[],
  page: FetchedPage,
): Promise<AdapterCallOutcome<RawProductDraft>> {
  const budget = makeBudget()
  const context: AdapterContext = {
    source: {
      slug: source.slug,
      baseUrl: source.base_url,
      currency: source.currency,
      imageExtractionMode: source.image_extraction_mode,
      priceExtraction: source.price_extraction,
      skuExtraction: source.sku_extraction,
      attributeExtraction: source.attribute_extraction,
    },
    matchUrl: (url: string) => matchUrl(url, patterns),
    logger: makeLogger(source.slug, adapter),
    budgetSpent: budget.spent,
  }

  return await runAdapterExtract(adapter, context, page)
}

/**
 * The product recorded at this URL, and the content hash of the version it currently points at.
 *
 * TWO CALLS RATHER THAN ONE, AND THE REDUNDANT READ INSIDE THE SECOND IS ACCEPTED KNOWINGLY.
 * `getCurrentVersion` re-reads `research_products.current_version_id` for itself, which this
 * function has already seen; what that buys is the argument that repository makes for FOLLOWING the
 * pointer rather than recomputing "the newest by `observed_at`" — the two disagree exactly when a
 * version was written and the pointer never advanced, and that is the state worth seeing. Reading
 * the hash a second way here would be a second answer to "what is this product's current version".
 */
async function readProductState(
  client: Client,
  sourceId: string,
  sourceUrl: string,
): Promise<{ id: string; currentContentHash: string | null } | null> {
  const product = await getResearchProductBySourceUrl(client, sourceId, sourceUrl)
  if (product === null) return null

  const current = await getCurrentVersion(client, product.id)
  return { id: product.id, currentContentHash: current?.content_hash ?? null }
}

/**
 * Write one version and advance the pointer, in that order.
 *
 * THE ORDER AND THE CONDITION BOTH MIRROR `workflows/extract.ts` EXACTLY, and mirroring is the
 * point rather than an accident: two writers of one table disagreeing about when
 * `current_version_id` moves is worse than either rule on its own. The version is written first so
 * a pointer never names a row that was not written, and the pointer advances only when a version
 * was CREATED — `created: false` means the constraint recognised this draft as one already in the
 * product's history, and re-pointing at a row that has not moved is a write that says something
 * changed when nothing did.
 *
 * `runId` AND `fetchId` ARE NULL. A replay belongs to no run and read no response. `storageKey` is
 * the snapshot the draft was actually read from, which is the whole provenance of the row.
 */
async function writeVersion(
  client: Client,
  adapter: SourceAdapter,
  decision: ReplayDecision,
): Promise<boolean> {
  if (decision.productId === null || decision.draft === null || decision.contentHash === null) {
    return false
  }

  const version = await recordProductVersion(client, {
    researchProductId: decision.productId,
    runId: null,
    fetchId: null,
    draft: decision.draft,
    contentHash: decision.contentHash,
    storageKey: decision.snapshot.storageKey,
    adapterKey: adapter.key,
    adapterVersion: adapter.version,
  })

  if (!version.created) return false
  await setCurrentVersionId(client, decision.productId, version.id)
  return true
}

/**
 * The source's stored patterns, read ONCE for the whole replay.
 *
 * ONCE, WHERE `workflows/extract.ts` READS THEM PER ITEM, AND THE DIFFERENCE IS THE CALLER. That
 * loop is drained over cron ticks that can span an hour, so a cached list would spend the second
 * half of a run matching against a configuration an operator had already changed. This is a command
 * a person runs and watches; the configuration cannot move underneath it, and re-reading it two
 * hundred times would be two hundred queries to answer one question that has not changed.
 *
 * AN UNRECOGNISED KIND IS READ AS `EXCLUDE`, which is `workflows/extract.ts`'s rule and
 * `core/url-patterns.ts`'s before it: a refusal we cannot read is still a refusal somebody made.
 */
async function readUrlPatterns(
  client: Client,
  sourceId: string,
): Promise<readonly SourceUrlPattern[]> {
  const rows = await listUrlPatterns(client, sourceId)
  return rows.map((row) => ({
    id: row.id,
    kind: asPatternKind(row.kind),
    pattern: row.pattern,
    isRegex: row.is_regex,
    priority: row.priority,
  }))
}

const PATTERN_KINDS: ReadonlySet<string> = new Set(['PRODUCT', 'CATEGORY', 'EXCLUDE', 'PAGINATION'])

function asPatternKind(kind: string): UrlPatternKind {
  return PATTERN_KINDS.has(kind) ? (kind as UrlPatternKind) : 'EXCLUDE'
}

/**
 * The adapter's logger, pointed at the same seam the pipeline uses.
 *
 * `warnScraper` RATHER THAN `console.log`, so an adapter warning looks the same whether it was
 * raised at 03:00 by a cron tick or at a terminal by whoever is testing the fix. `debug` goes
 * nowhere for `core/log.ts`'s reason — there is no DEBUG channel to route it to, and sending the
 * most ordinary outcome there is to the warning channel is how a log stops being read. The source,
 * adapter and version keys are stamped LAST so an adapter cannot overwrite them with its own claim
 * about itself, and the message is collapsed and bounded because it was assembled next to a third
 * party's markup.
 */
function makeLogger(slug: string, adapter: SourceAdapter): AdapterLogger {
  return {
    debug: () => {},
    warn: (message, context) => {
      warnScraper({
        level: 'WARNING',
        event: 'research.adapter_warning',
        message: bounded(message, 300),
        context: {
          ...scalarContext(context),
          source: slug,
          adapter: adapter.key,
          version: adapter.version,
        },
      })
    },
  }
}

function bounded(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`
}

function scalarContext(
  context: Readonly<Record<string, string | number>> | undefined,
): Record<string, string | number> {
  if (context === undefined) return {}
  const result: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(context)) {
    result[key] = typeof value === 'string' ? bounded(value, 120) : value
  }
  return result
}

/**
 * What happened, as a person reads it.
 *
 * THE FAILURES ARE LISTED AND THE SUCCESSES ARE COUNTED, because a replay is run to find out what
 * is still wrong. A bounded list for the same reason `research_adapter_runs` keeps five errors: two
 * hundred identical reasons tell nobody anything the first twenty did not.
 */
function printReport(report: ReextractReport, options: ReextractOptions): void {
  console.log(
    `\n  ${report.replayed} replayed · ${report.unchanged} unchanged · ` +
      `${report.newVersions} changed · ${report.failed} failed · ` +
      `${report.unreadable} unreadable · ${report.withoutProduct} with no product`,
  )

  const notable = report.decisions.filter(
    (decision) => decision.verdict !== 'UNCHANGED' && decision.verdict !== 'NEW_VERSION',
  )
  for (const decision of notable.slice(0, MAX_REPORTED_LINES)) {
    console.log(`    ${decision.verdict.padEnd(12)} ${decision.snapshot.url}`)
    if (decision.detail !== null) console.log(`                 ${decision.detail}`)
  }
  if (notable.length > MAX_REPORTED_LINES) {
    console.log(`    … and ${notable.length - MAX_REPORTED_LINES} more`)
  }

  if (options.dryRun) {
    console.log(
      `\n✓ ${report.newVersions} version(s) would be written. Nothing was written — ` +
        'remove --dry-run to apply.\n',
    )
    return
  }

  console.log(`\n✓ ${report.written} version(s) written\n`)
}

/**
 * Run only when this file IS the command, never when a test imports it.
 *
 * WITHOUT THE GUARD THE SUITE WOULD RUN THE CLI. A module whose top level calls `main()` executes
 * that call the moment anything imports it, so `tests/unit/reextract.test.ts` — which imports
 * `parseArgs`, `selectSnapshots`, `plan` and `reextract` in order to exercise them without a
 * database — would open a service-role client, read `.env.local` and exit the worker process.
 * `prune-snapshots.ts` calls `main()` unguarded because nothing imports it; the moment a script has
 * exported parts worth testing, the guard is what makes them reachable.
 */
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
