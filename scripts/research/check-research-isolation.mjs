#!/usr/bin/env node
/**
 * RESEARCH ISOLATION GATE (Phase 25) — I1, I2, I3, I4.
 *
 * THE SINGLE MOST IMPORTANT ARTEFACT IN THIS PHASE, and the reason is not the code it rejects but
 * the code it makes unwritable. Everything about the research subsystem is designed so that a
 * competitor's data cannot reach a visitor, and every one of those designs is a decision somebody
 * can undo later in one line, for a good reason, without realising what they have done:
 *
 *   "the related-products query could also look at research_products" — I3, and now a visitor's
 *   page render reads competitor rows;
 *   "the import button could create the Rivya product directly" — I4, and now scraped content is
 *   catalogue content with nobody having typed it;
 *   "research_products should reference categories so we can filter" — I1, and now the two halves
 *   of the schema are joined and cannot be separated again;
 *   "the researcher role needs an anon read for the preview" — I2, and now every research table is
 *   world-readable through PostgREST.
 *
 * Each of those changes compiles, type-checks and passes every other gate. This is where they stop.
 *
 * FOUR CHECKS, AND THREE OF THEM NEED NO DATABASE so the gate runs in `npm run check` on any
 * machine. I1 is the exception: it reads `information_schema` when `DATABASE_URL` is set, and says
 * plainly that it was skipped when it is not, rather than reporting a pass it did not perform.
 *
 * Exit 1 on any violation.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const ROOT = process.cwd()
const problems = []
const notes = []

/**
 * Which invariants this run actually examined.
 *
 * THE SUMMARY LINE MUST NOT CLAIM MORE THAN THE RUN DID. An earlier version printed the same
 * four-part tick whether or not I1 had a database to read, so a note saying "not checked" sat
 * directly above a line saying it passed — and the tick is the part anybody remembers. Each check
 * marks itself as having run, and the summary is assembled from what did.
 */
const checked = { I1: false, I2: false }

// ================================================================================================
// I1 — no foreign key crosses the research/public boundary
// ================================================================================================
//
// THE ALLOWLIST IS EMPTY AT THIS PHASE AND THAT IS THE POINT. Phase 26 adds
// `research_source_category_map.category_id` and Phase 28 adds
// `research_products.matched_category_id`; both are staff-written taxonomy pointers rather than
// scraped values, both are `on delete set null`, and both need a dated amendment to D5 before they
// ship (the phase document's Open question 4). Naming them individually here means a THIRD such
// reference — the one nobody argued about — fails the build.
const ALLOWED_CROSSINGS = new Set([
  // (empty at Phase 25)
])

const CROSSING_SQL = `
  select tc.constraint_name, tc.table_name as child, ccu.table_name as parent
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
   and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
    and ccu.table_schema = 'public'
    and ((tc.table_name like 'research\\_%') <> (ccu.table_name like 'research\\_%'))
`

function checkForeignKeys() {
  const url = process.env.DATABASE_URL
  if (url === undefined || url === '') {
    // SAID OUT LOUD, not silently skipped. A gate that reports success for a check it did not run
    // is worse than one that is missing, because it is trusted.
    notes.push('I1 not checked: DATABASE_URL is not set. CI sets it; a local run may not.')
    return
  }

  // IS THERE ANYTHING TO CHECK? A database that has not had the Phase 25 migrations applied has no
  // research tables, so the crossing query finds nothing and I1 reports a clean pass having looked
  // at an empty schema. That is the same dishonesty as skipping silently, wearing a tick — and it
  // is the likely state of a developer's database mid-rebase, or of a CI job that runs this before
  // `db:reset`. Say so instead.
  let present
  try {
    present = execFileSync(
      'psql',
      [
        url,
        '-At',
        '-c',
        'select count(*) from information_schema.tables ' +
          "where table_schema = 'public' and table_name like 'research\\_%'",
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (error) {
    notes.push(`I1 not checked: psql could not run (${error.message.split('\n')[0]}).`)
    return
  }

  if (Number(present.trim()) === 0) {
    notes.push(
      'I1 not checked: this database holds no research_* tables, so there is nothing to cross. ' +
        'Apply the migrations (npm run db:reset) before trusting this line.',
    )
    return
  }

  let output
  try {
    output = execFileSync('psql', [url, '-At', '-F', '|', '-c', CROSSING_SQL], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    notes.push(`I1 not checked: psql could not run (${error.message.split('\n')[0]}).`)
    return
  }

  checked.I1 = true

  for (const line of output.trim().split('\n').filter(Boolean)) {
    const [constraint, child, parent] = line.split('|')
    if (ALLOWED_CROSSINGS.has(constraint)) continue
    problems.push(
      `I1: foreign key "${constraint}" joins ${child} to ${parent}, crossing the research boundary.\n` +
        '      Scraped data never joins directly to public product tables (D5). The two allowlisted\n' +
        '      taxonomy pointers arrive in Phases 26 and 28 and must be added to ALLOWED_CROSSINGS\n' +
        '      in this file, with the D5 amendment that permits them.',
    )
  }
}

// ================================================================================================
// I2 — no research_* table has an anon policy
// ================================================================================================
//
// CHECKED TWICE, IN TWO PLACES, ON PURPOSE. Against the DATABASE when one is reachable, which is
// the truth; and against the generated POLICY FILES always, which is what a reviewer reads and
// what a pull request changes. A policy added by hand to a migration would pass the first check on
// a machine whose database predates it, and fails the second immediately.
const POLICY_DIR = join(ROOT, 'supabase', 'migrations')

function checkAnonPolicies() {
  for (const file of readdirSync(POLICY_DIR).filter((name) => name.endsWith('.sql'))) {
    const sql = readFileSync(join(POLICY_DIR, file), 'utf8')
    // `create policy <name> on research_x for select to anon, authenticated ...`
    const pattern = /create\s+policy\s+\S+\s+on\s+(research_\w+)[\s\S]*?\bto\s+([a-z_,\s]+)/gi
    let match
    while ((match = pattern.exec(sql)) !== null) {
      const roles = match[2].toLowerCase()
      if (/\banon\b/.test(roles)) {
        problems.push(
          `I2: ${file} creates a policy on ${match[1]} granted to anon.\n` +
            '      No research_* table may ever be readable without a session. There is no\n' +
            "      visitor-facing view of a competitor's catalogue.",
        )
      }
    }
  }

  const url = process.env.DATABASE_URL
  if (url === undefined || url === '') {
    notes.push('I2 checked against the migration files only: DATABASE_URL is not set.')
    return
  }
  try {
    const output = execFileSync(
      'psql',
      [
        url,
        '-At',
        '-c',
        "select tablename || '.' || policyname from pg_policies " +
          "where schemaname = 'public' and tablename like 'research\\_%' and 'anon' = any(roles)",
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    checked.I2 = true
    for (const line of output.trim().split('\n').filter(Boolean)) {
      problems.push(`I2: the database carries an anon policy: ${line}`)
    }
  } catch (error) {
    notes.push(`I2 database check skipped: psql could not run (${error.message.split('\n')[0]}).`)
  }
}

// ================================================================================================
// I3 — no research identifier appears on a public surface
// ================================================================================================
//
// BY DIRECTORY, NOT BY IMPORT GRAPH, and that is the difference between this and Phase 23's
// `check-search-scope.mjs`. That one walks four entry points because it is asking a narrow
// question about one path. This one asks a blunter question of whole trees: nothing under these
// directories may so much as NAME a research thing, whether it is imported from a page or not.
// A file that is unreachable today is a file somebody imports tomorrow.
const PUBLIC_TREES = [
  join(ROOT, 'app', '(site)'),
  join(ROOT, 'lib', 'cms'),
  join(ROOT, 'lib', 'catalog'),
  join(ROOT, 'lib', 'seo'),
  join(ROOT, 'components', 'sections'),
  join(ROOT, 'content'),
]

const FORBIDDEN = /research_|researchProduct|researchSearch|\bscraper\b/i

const EXTENSIONS = ['.tsx', '.ts', '.mjs', '.js', '.jsx']

function filesUnder(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...filesUnder(full))
    } else if (EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      out.push(full)
    }
  }
  return out
}

function checkPublicTrees() {
  for (const tree of PUBLIC_TREES) {
    for (const file of filesUnder(tree)) {
      const code = stripCommentsAndStrings(readFileSync(file, 'utf8'))
      const match = FORBIDDEN.exec(code)
      FORBIDDEN.lastIndex = 0
      if (match === null) continue
      const line = code.slice(0, match.index).split('\n').length
      problems.push(
        `I3: ${relative(ROOT, file)}:${line} names "${match[0]}" on a public surface.\n` +
          '      Research data never reaches a visitor. If a Studio surface needs it, it belongs\n' +
          '      under app/(studio)/ — which this gate does not police, because that is where it\n' +
          '      is supposed to live.',
      )
    }
  }
}

// ================================================================================================
// I4 — nothing writes a public table from a research read, and no browser automation exists
// ================================================================================================
//
// TWO HALVES OF ONE RULE. The first is the invariant itself: `lib/scraper/**` may not import the
// catalog repositories, and the catalog repositories may not import `lib/scraper/**`. A row in
// `research_*` becomes a Rivya product only by an owner typing one, and the way to keep that true
// is that no code path connects the two — not a policy, not a review convention.
//
// The second is the phase document's other permanent prohibition: no headless browser, no proxy
// rotation, no CAPTCHA solving. Those arrive as DEPENDENCIES, always, and always with a reason
// attached to one difficult source. An import of any of them anywhere under `lib/scraper/**` is
// the moment the posture changes, and it fails here.
const SCRAPER_DIR = join(ROOT, 'lib', 'scraper')

/** Public write surfaces the scraper may never reach. */
const FORBIDDEN_IMPORTS = [
  /repositories\/(catalog|products|catalog-admin|media|collections|journal|portfolio|cms)/,
  /lib\/media\/providers/,
  /cloudinary/i,
]

/** Browser automation and evasion tooling. Permanently out of scope (phase document, Risks). */
const FORBIDDEN_PACKAGES =
  /\b(puppeteer|playwright|selenium|webdriver|playwright-core|puppeteer-core|chrome-remote-interface|cheerio-httpcli|proxy-agent|https-proxy-agent|socks-proxy-agent|2captcha|anticaptcha)\b/i

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s*['"]([^'"]+)['"]/g
const BARE_IMPORT = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g

function importsOf(file) {
  const raw = readFileSync(file, 'utf8')
  const found = []
  for (const pattern of [IMPORT, BARE_IMPORT]) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(raw)) !== null) found.push(match[1])
  }
  return found
}

function checkScraperImports() {
  for (const file of filesUnder(SCRAPER_DIR)) {
    const rel = relative(ROOT, file)
    for (const specifier of importsOf(file)) {
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (forbidden.test(specifier)) {
          problems.push(
            `I4: ${rel} imports "${specifier}".\n` +
              '      Nothing in lib/scraper/** may write a public table. A research row becomes a\n' +
              '      Rivya product only by an owner typing one — there is no code path, and this is\n' +
              '      what keeps it that way.',
          )
        }
      }
      if (FORBIDDEN_PACKAGES.test(specifier)) {
        problems.push(
          `I4: ${rel} imports "${specifier}" — browser automation or proxy tooling.\n` +
            '      No headless browser, no proxy rotation, no CAPTCHA solving, permanently. If a\n' +
            '      source requires one of those to read, the answer is that Rivya does not read it.',
        )
      }
    }
  }
}

/** And the reverse direction: a catalog write path may not reach the scraper. */
const CATALOG_FILES = [
  join(ROOT, 'lib', 'supabase', 'repositories', 'products.ts'),
  join(ROOT, 'lib', 'supabase', 'repositories', 'catalog.ts'),
  join(ROOT, 'lib', 'supabase', 'repositories', 'catalog-admin.ts'),
  join(ROOT, 'lib', 'supabase', 'repositories', 'bulk-products.ts'),
  join(ROOT, 'lib', 'supabase', 'repositories', 'bulk-import.ts'),
]

function checkCatalogImports() {
  for (const file of CATALOG_FILES) {
    if (!existsSync(file)) continue
    for (const specifier of importsOf(file)) {
      if (/lib\/scraper|repositories\/research/.test(specifier)) {
        problems.push(
          `I4: ${relative(ROOT, file)} imports "${specifier}".\n` +
            '      The catalogue never reads the research subsystem. An import here is the bridge\n' +
            '      the invariant exists to prevent.',
        )
      }
    }
  }
}

/**
 * `lib/scraper/**` may not write `research_products.stage` except through the stage machine.
 *
 * NOT AN INVARIANT FROM THE TABLE ABOVE, but the same shape of rule and the same reason to enforce
 * it here: the pipeline event log is only complete if one function writes both halves.
 */
function checkStageWriter() {
  const allowed = relative(ROOT, join(ROOT, 'lib', 'scraper', 'core', 'stage.ts'))
  const roots = [SCRAPER_DIR, join(ROOT, 'app'), join(ROOT, 'components')]
  for (const root of roots) {
    for (const file of filesUnder(root)) {
      const rel = relative(ROOT, file)
      if (rel === allowed) continue
      const code = stripCommentsAndStrings(readFileSync(file, 'utf8'))
      if (/\bwriteProductStage\b/.test(code)) {
        problems.push(
          `I4: ${rel} calls writeProductStage.\n` +
            '      Only lib/scraper/core/stage.ts may move a stage, because it is what writes the\n' +
            '      research_pipeline_events row alongside. A stage moved anywhere else is a stage\n' +
            '      with no record of who moved it.',
        )
      }
    }
  }
}

checkForeignKeys()
checkAnonPolicies()
checkPublicTrees()
checkScraperImports()
checkCatalogImports()
checkStageWriter()

for (const note of notes) console.log(`  ▸ ${note}`)

if (problems.length > 0) {
  console.error('\n✗ research isolation violated:\n')
  for (const problem of problems) console.error(`  ${problem}\n`)
  process.exit(1)
}

const parts = [
  checked.I1
    ? `I1 no boundary-crossing foreign key (allowlist holds ${ALLOWED_CROSSINGS.size})`
    : 'I1 NOT CHECKED (see above)',
  checked.I2
    ? 'I2 no anon policy on any research table, in the migrations and in the database'
    : 'I2 no anon policy in the migrations (the database was not checked — see above)',
  'I3 no research identifier on a public surface',
  'I4 no path from the scraper to a public write and no browser automation',
]

console.log(`✓ research isolation: ${parts.join(', ')}`)
