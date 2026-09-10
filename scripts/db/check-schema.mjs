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
  // Tier A + B but NOT C: product_specs is never seeded. Every row is a measurement the owner
  // typed, and a seeded specification would be a fabricated business fact wearing the clothes of
  // one (Phase 15, D10). The absence of the seed columns is what makes that unenforceable-by-hand
  // rule structural — a seeder has no key to address a row by.
  product_specs: [...TIER_A, ...TIER_B],
  product_collections: ['created_at', 'created_by'],
  product_materials: ['created_at', 'created_by'],
  product_media: ['created_at', 'created_by'],
  product_relations: ['created_at', 'created_by'],
  // Phase 16's general edge. An edge, not content: created_at and created_by only, the same
  // shape as the four Phase 03 join tables. A `status` here would let a relation be draft,
  // which is a state nobody can act on — either an editor made the connection or they did not.
  entity_relations: ['created_at', 'created_by'],

  // Phase 17. Tier A + B but NOT C, for the same reason as product_specs one line of reasoning
  // along: `portfolio_projects` and `testimonials` are never seeded. SEED §17 says so in capitals
  // and D10 lists delivered projects, named customers and testimonials among the things that may
  // never be fabricated — so the seed columns are absent, and a seeder has no key to address a row
  // by. That is the rule made structural rather than remembered.
  portfolio_projects: [...TIER_A, ...TIER_B],
  testimonials: [...TIER_A, ...TIER_B],
  // The gallery join is an edge, like the four above it.
  portfolio_project_media: ['created_at', 'created_by'],

  // Phase 18. Both journal tables ARE seeded — SEED §19's nine categories and §20's ten article
  // ideas — so unlike the portfolio pair they carry Tier C. What the seed writes is a title and an
  // angle; the body is the owner's, and no seed record can publish one.
  journal_categories: [...TIER_A, ...TIER_B, ...TIER_C],
  journal_articles: [...TIER_A, ...TIER_B, ...TIER_C],
  // The secondary-category join is an edge, like the gallery one above.
  journal_article_categories: ['created_at', 'created_by'],
  content_seed_runs: ['started_at', 'finished_at', 'is_dry_run', 'report'],

  /*
   * Phase 19. THE FORM IS CONTENT AND ITS PARTS ARE STRUCTURE, which is why the three tiers split
   * unevenly across three tables that arrived together.
   *
   * `customization_forms` carries all three: it is seeded from SEED §33-35, it has a publication
   * workflow, and §35 requires the 3D + resin template to sit at OWNER_VERIFICATION_REQUIRED until
   * the owner defines real manufacturing options — which is Tier B doing exactly its job.
   *
   * A STEP AND A FIELD CARRY TIER A AND TIER C BUT NOT TIER B, and the omission is the decision.
   * They ARE seeded, so Tier C is compulsory: SEED §33 requires every field to be renameable, and a
   * rename that the next seed run reverted would not be a rename. But a question has no publication
   * workflow of its own — it is asked or it is not, which is `is_enabled` — and no owner
   * verification, because a question asserts nothing about the business. Giving a field a `status`
   * would invite a DRAFT question: a row that is neither asked nor removed, in a form whose whole
   * contract is that an editor can see what it asks.
   */
  customization_forms: [...TIER_A, ...TIER_B, ...TIER_C],
  customization_form_steps: [...TIER_A, ...TIER_C],
  customization_form_fields: [...TIER_A, ...TIER_C],
  // The product/category binding is an edge, like the six join tables above it.
  product_customization_forms: ['created_at', 'created_by'],

  /*
   * Phase 19's flag table. A §1.4 exemption of a fourth kind: not an invocation record, but a
   * SWITCH. It has no content, no publication workflow and nothing to seed — a flag with no row is
   * off, so the register of which flags exist lives in `lib/flags/flags.ts` where deleting one
   * breaks its call sites at compile time. What the row records is that somebody moved it, which is
   * `updated_at` and `updated_by` and nothing else.
   */
  feature_flags: ['updated_at', 'updated_by'],

  /*
   * A COUNTER, WHICH IS THE FOURTH KIND OF §1.4 EXEMPTION AND THE THINNEST. `rate_limit_buckets`
   * has no audit columns at all — no `created_at`, no `updated_by` — and that is deliberate rather
   * than an omission to fix later. Every column it has IS the record: a hashed key, a window and a
   * count. Adding `updated_at` would double the write cost of the hottest table on the site to
   * store a value `window_start` already bounds, and `updated_by` would name an actor that by
   * definition has no account.
   */
  /*
   * Phase 20's three. `inquiries` carries TIER A AND NOTHING ELSE, and both absences are decisions
   * recorded in DATA_MODEL §1.4.
   *
   * NO TIER B, because an enquiry is not content. It is never published, never scheduled, never
   * revised and never verified — it moves through a SALES pipeline, which is what `pipeline_status`
   * is and why it is not `content_status`. Giving it `owner_verification` would ask the owner to
   * confirm that a customer really said what they said.
   *
   * NO TIER C, because nothing seeds a customer. A seeded enquiry is a fabricated conversation with
   * a fabricated person, which is D10 at its most direct; the absence of a `seed_key` is what makes
   * that structural rather than a rule somebody has to remember.
   */
  inquiries: [...TIER_A],

  /*
   * Phase 21. A VARIANT LABEL IS EDITORIAL COPY WITH ONE FOOT IN THE CATALOGUE: Tier A, plus the two
   * Tier B columns that carry D10 — `owner_verification` and `fact_classification` — and neither
   * `status` nor the publication pair, because a label is never published on its own. It is public
   * exactly when the model it names is (shape B), and a `status` here would be a second switch that
   * could disagree with the first. No Tier C: nothing seeds a label, because nothing seeds a model.
   */
  model_variant_labels: [...TIER_A, 'owner_verification', 'fact_classification'],
  // An attachment is an edge, like every other join table here — and it has no `created_by`,
  // because the visitor who created it is not a user and never will be (D1).
  inquiry_attachments: ['created_at'],
  /*
   * APPEND-ONLY, SO IT HAS NO `updated_at` AND NO `updated_by` — a §1.4 exemption of the same kind
   * as `activity_events`. The trigger refuses UPDATE outright, so a column recording when a row was
   * last changed would name a moment that can never arrive. `occurred_at` is the whole timestamp
   * story and `actor_id` is the whole actor story.
   */
  inquiry_events: ['occurred_at'],

  rate_limit_buckets: ['bucket_key', 'window_start', 'count'],

  // `db:migrate`'s own bookkeeping, and a §1.4 exemption for the same reason `content_seed_runs` is
  // one: what it records is an INVOCATION, and an invocation has no publication workflow, no owner
  // verification and nothing to seed. It is created by the runner rather than by a migration —
  // which is why `gen-types.mjs` excludes it too (amendment A13·4): whether it exists at generation
  // time depends on how a database was built, and that made the same schema produce two type files.
  // The runner enables RLS on it at creation, with no policy, so the anon key cannot read the
  // schema's history.
  schema_migrations: ['version', 'checksum', 'applied_at'],

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

  // Phase 08 — the CMS. Six content tables carrying the full A+B+C set, because Phase 09 seeds
  // every one of them and the seed runner needs Tier C to tell its own writes from a human's.
  pages: [...TIER_A, ...TIER_B, ...TIER_C],
  page_sections: [...TIER_A, ...TIER_B, ...TIER_C],
  navigation_items: [...TIER_A, ...TIER_B, ...TIER_C],
  global_content: [...TIER_A, ...TIER_B, ...TIER_C],
  seo_entries: [...TIER_A, ...TIER_B, ...TIER_C],
  faqs: [...TIER_A, ...TIER_B, ...TIER_C],

  // `content_revisions` is the §1.4 exemption of the set, and for the same reason `audit_logs` is:
  // it is an IMMUTABLE RECORD OF SOMETHING THAT HAPPENED, not content. A `status` on it would imply
  // a revision can be drafted and published; an `updated_at` would imply it can be edited, when the
  // whole guarantee is that it cannot — there is no UPDATE or DELETE policy for any session role.
  // It carries `created_at`/`created_by` rather than §1.4's `occurred_at` shorthand because the row
  // IS the event, so its creation time is the event time and a second column would be a lie waiting
  // to diverge.
  content_revisions: ['created_at', 'created_by'],

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

// --- 3. price_state carries FIXED, and only alongside somewhere to put the amount ----------------
// Phase 03 seeded three values, all of which mean "there is no number here". Phase 14 (0120) added
// FIXED, and this assertion inverted with it, exactly as its previous wording instructed.
//
// THE PAIRING IS THE POINT, not the list. FIXED without `products.price_minor` is the failure the
// original assertion was written to prevent: a product could claim a fixed price with nowhere to
// store the amount, and the card would render a price state with no price. So this checks both,
// and reports the pairing rather than only the enum, because a run that added the enum and skipped
// the column is the case worth naming.
const priceStates = q(`
  select string_agg(e.enumlabel, ' ' order by e.enumsortorder)
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'price_state';
`)[0]

const EXPECTED_PRICE_STATES = 'STARTING_FROM REQUEST_QUOTE PRICE_ON_REQUEST FIXED'
if (priceStates !== EXPECTED_PRICE_STATES) {
  problems.push(
    `price_state is "${priceStates}", expected "${EXPECTED_PRICE_STATES}".\n` +
      `      0120 appends FIXED to the three Phase 03 values; a different list means a migration ` +
      `added a state this gate has not been told about.`,
  )
}

const hasPriceMinor = columnsByTable.get('products')?.has('price_minor') === true
if (priceStates?.includes('FIXED') === true && !hasPriceMinor) {
  problems.push(
    'price_state carries FIXED but products.price_minor does not exist.\n' +
      '      A fixed price with nowhere to store the amount renders as no price at all — 0120 and ' +
      '0121 must be applied together.',
  )
}

// --- 4. Every content table refuses to publish an unverified row ---------------------------------
// D10 as a constraint rather than a review convention.
// Every table whose rows can be PUBLISHED and can therefore carry an unverified business claim to
// the public site. The six Phase 08 additions matter as much as the Phase 03 five: `faqs` answers
// questions about lead times and materials, `global_content` holds the CTA library, and
// `page_sections` is where most seeded copy will live.
//
// `content_revisions` is absent deliberately — a revision is a record of what a row WAS, and
// gating it on verification would refuse to record the history of an unverified claim, which is
// the opposite of what an audit trail is for.
const CONTENT_TABLES = [
  'categories',
  'collections',
  'materials',
  'products',
  'media_assets',
  'pages',
  'page_sections',
  'navigation_items',
  'global_content',
  'seo_entries',
  'faqs',
  // Phase 15. A spec row can be PUBLISHED, so it needs the same D10 gate as any other row that can
  // carry a claim to the public site.
  'product_specs',
]
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
    `price_state has its four values with price_minor to match, D10 gate on all ${CONTENT_TABLES.length} content tables`,
)
