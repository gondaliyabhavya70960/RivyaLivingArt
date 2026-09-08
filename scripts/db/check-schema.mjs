#!/usr/bin/env node
/**
 * db:check-schema — assert the schema invariants against a live database.
 *
 * These are the Phase 03 exit criteria expressed as a query rather than as a claim. The
 * distinction matters: the migrations SAY they enable RLS on every table, but the only way to know
 * a later migration did not create a table and forget is to ask the catalog.
 *
 * Every check reads pg_catalog / information_schema. None of them trusts the migration text.
 */
import { execFileSync } from 'node:child_process'

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL is not set. db:check-schema asserts against a real database:\n' +
      '  npm run db:reset && npm run db:check-schema',
  )
  process.exit(1)
}

function q(sql) {
  return execFileSync(
    'psql',
    [
      url,
      '--no-psqlrc',
      '--quiet',
      '--tuples-only',
      '--no-align',
      '--set',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean)
}

const problems = []
const notes = []

// --- 1. RLS is on everywhere, with no policy yet -------------------------------------------------
// A table with RLS enabled and no policy is unreachable by anon and authenticated. That is the
// intended Phase 03 state: nothing is readable until Phase 04 grants it deliberately. A table with
// RLS OFF is readable by anyone holding the anon key.
// `relrowsecurity` is emitted through an explicit case rather than concatenated directly:
// PostgreSQL's boolean-to-text cast produces 'true'/'false', not psql's display form 't'/'f', and
// comparing against the wrong one made every table look unprotected on the first run of this file.
const rls = q(`
  select c.relname || ' ' ||
         (case when c.relrowsecurity then 't' else 'f' end) || ' ' ||
         (select count(*) from pg_policy p where p.polrelid = c.oid)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
`)

if (rls.length === 0) problems.push('no tables found in schema public — has db:reset been run?')

for (const line of rls) {
  const [table, enabled, policies] = line.split(' ')
  if (enabled !== 't') problems.push(`${table}: RLS is NOT enabled — the anon key can read it`)
  // Policy COUNT and policy CONTENT are deliberately not asserted here. scripts/auth/check-rls.ts
  // owns all of that — it compares each staff-select policy's role list against the permission
  // matrix, which this file has no knowledge of. Splitting the two stops the same rule being
  // half-enforced in two places and fully enforced in neither.
  void policies
}

// --- 2. Common column tiers ----------------------------------------------------------------------
const TIER_A = ['created_at', 'updated_at', 'updated_by']
const TIER_B = [
  'status',
  'owner_verification',
  'fact_classification',
  'published_at',
  'published_by',
]
const TIER_C = [
  'seed_key',
  'content_seed_version',
  'seed_content_hash',
  'seed_last_applied_at',
  'owner_edited',
]

/**
 * Which tiers each table must carry, from DATA_MODEL.md §1.2 and §1.4.
 *
 * media_assets is A+B but NOT C: no seed module writes it. Phase 07 imports the 250 manifest
 * assets through a migration script, which is a different mechanism with a different ledger.
 *
 * The join tables and content_seed_runs carry neither B nor C: they are edges and run records,
 * not content, and a content_status on them would imply a publication workflow that does not
 * exist (§1.4).
 */
const EXPECTED = {
  categories: [...TIER_A, ...TIER_B, ...TIER_C],
  collections: [...TIER_A, ...TIER_B, ...TIER_C],
  materials: [...TIER_A, ...TIER_B, ...TIER_C],
  products: [...TIER_A, ...TIER_B, ...TIER_C],
  media_assets: [...TIER_A, ...TIER_B],
  product_collections: ['created_at', 'created_by'],
  product_materials: ['created_at', 'created_by'],
  product_media: ['created_at', 'created_by'],
  product_relations: ['created_at', 'created_by'],
  content_seed_runs: ['started_at', 'finished_at', 'is_dry_run', 'report'],

  // Phase 07. A RUN RECORD, the same §1.4 exemption as content_seed_runs above and deliberately
  // the same shape: no content_status, no owner_verification, no Tier C. What is being recorded is
  // an invocation, and an invocation has no publication workflow.
  higgsfield_migration_runs: [
    'started_at',
    'finished_at',
    'manifest_version',
    'requested_scope',
    'dry_run',
    'log',
  ],

  // Phase 04. Neither carries the content tiers, and both are §1.4 exemptions:
  //   staff_profiles is configuration — Tier A only, plus created_by.
  //   audit_logs is an immutable operational record with its own column set. A content_status on
  //   it would imply a publication workflow for the security log.
  staff_profiles: ['role', 'status', 'created_at', 'updated_at', 'updated_by'],
  audit_logs: ['occurred_at', 'actor_user_id', 'actor_role', 'action', 'result'],

  // Phase 05.
  //   activity_events is append-only, so §1.2 exempts it from Tier A outright: an `updated_at` on
  //   a row that must never be updated is a promise the table cannot keep.
  //   studio_preferences is Tier A only. It is per-user chrome state, never published and never
  //   seeded, so Tiers B and C would both be fictions.
  activity_events: ['occurred_at', 'actor_id', 'actor_role', 'action', 'metadata'],
  studio_preferences: ['user_id', 'sidebar_collapsed', ...TIER_A],

  // Phase 06. media_usages is an EDGE — the same shape as the Phase 03 join tables, and exempt
  // from the content tiers for the same reason (§1.4): a binding between a slot and an asset has
  // no publication lifecycle of its own. It carries created_at/created_by and nothing else,
  // deliberately: it is rewritten wholesale by the Phase 08 trigger on every save, so an
  // `updated_at` would only ever record when the page was last saved, which the page already knows.
  media_usages: [
    'media_id',
    'context_type',
    'context_id',
    'slot_key',
    'role',
    'created_at',
    'created_by',
  ],
}

const columnRows = q(`
  select table_name || ' ' || column_name
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, column_name;
`)

const columnsByTable = new Map()
for (const line of columnRows) {
  const [table, column] = line.split(' ')
  if (!columnsByTable.has(table)) columnsByTable.set(table, new Set())
  columnsByTable.get(table).add(column)
}

for (const [table, expected] of Object.entries(EXPECTED)) {
  const actual = columnsByTable.get(table)
  if (!actual) {
    problems.push(`${table}: table does not exist`)
    continue
  }
  for (const column of expected) {
    if (!actual.has(column)) problems.push(`${table}: missing required column "${column}"`)
  }
}

// A table that exists but is not in EXPECTED is a table nobody decided the tiers for.
for (const table of columnsByTable.keys()) {
  if (!(table in EXPECTED)) {
    problems.push(
      `${table}: exists but has no entry in EXPECTED — decide which column tiers it carries ` +
        `and record it in DATA_MODEL.md §1.2/§1.4, then add it here`,
    )
  }
}

// --- 3. price_state is exactly its three Phase 03 values ------------------------------------------
// Phase 14 adds FIXED alongside price_minor and the three-branch constraint. Until then, FIXED
// must not exist: a fixed price with nowhere to store the amount would render as no price at all.
const priceStates = q(`
  select string_agg(e.enumlabel, ' ' order by e.enumsortorder)
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'price_state';
`)[0]

const EXPECTED_PRICE_STATES = 'STARTING_FROM REQUEST_QUOTE PRICE_ON_REQUEST'
if (priceStates !== EXPECTED_PRICE_STATES) {
  problems.push(
    `price_state is "${priceStates}", expected "${EXPECTED_PRICE_STATES}".\n` +
      `      If Phase 14 has added FIXED, this assertion inverts — update it there, deliberately.`,
  )
}

// --- 4. Every content table refuses to publish an unverified row ---------------------------------
// D10 as a constraint rather than a review convention.
const CONTENT_TABLES = ['categories', 'collections', 'materials', 'products', 'media_assets']
const gates = q(`
  select conrelid::regclass::text
  from pg_constraint
  where contype = 'c' and conname like '%verified_before_publish'
  order by 1;
`)

for (const table of CONTENT_TABLES) {
  if (!gates.includes(table)) {
    problems.push(`${table}: no *_verified_before_publish constraint — D10 is not enforced on it`)
  }
}

// --- report --------------------------------------------------------------------------------------
if (notes.length > 0) {
  console.log('  notes:')
  for (const note of notes) console.log(`    ${note}`)
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} schema problem(s):\n`)
  for (const problem of problems) console.error(`    ${problem}`)
  console.error('')
  process.exit(1)
}

console.log(
  `✓ schema: ${rls.length} tables, RLS on all, column tiers correct, ` +
    `price_state has its three Phase 03 values, D10 gate on all ${CONTENT_TABLES.length} content tables`,
)
