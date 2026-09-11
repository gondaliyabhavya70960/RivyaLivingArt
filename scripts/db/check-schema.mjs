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
  /*
   * Phase 22. A SLOT IS STRUCTURE WITH A SWITCH: Tier A plus `status`, which is what makes it
   * readable by the public resolver (PUBLISHED) or not. No `owner_verification` and no
   * `fact_classification`, because a slot asserts nothing — it holds no copy and names no entity.
   * No Tier C: the rows come from migration 0200 and the categories trigger, never from a seed
   * module, because a slot an editor could create is a list nothing renders.
   *
   * AN ENTRY IS A SCHEDULED EDGE: Tier A, `status` and the publication pair, because "when did this
   * piece go into the band" is a fact the Studio shows. No verification columns — an entry names an
   * entity that carries its own — and no Tier C, because a seeded entry would be seeded
   * merchandising of products the seed is forbidden to create (SEED §32).
   */
  merchandising_slots: [...TIER_A, 'status'],
  merchandising_entries: [...TIER_A, 'status', 'published_at', 'published_by'],
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
  /*
   * Phase 23 — the search index and the relationship model. Five §1.4 exemptions and one ordinary
   * content table, and the split is the phase in miniature.
   *
   * THE TWO INDEXES ARE PROJECTIONS. Every row is derived from a source table by a trigger, so a
   * `status` of their own would be a second publication switch that could disagree with the first,
   * an `updated_by` would name a person for a row no person wrote, and Tier C would let a seeder
   * address search results for content that does not exist. `indexed_at` is the whole timestamp
   * story: when this projection was last rebuilt.
   *
   * `search_queries` IS A RECORD OF SOMETHING THAT HAPPENED, the same exemption as
   * `activity_events` — and deliberately the thinnest one in the schema, because every column it
   * does not have is a column that could identify a visitor.
   *
   * THE TWO EDGES CARRY `created_at` AND `created_by` AND NOTHING ELSE, exactly like
   * `product_relations`, `entity_relations` and the four Phase 03 join tables. An edge that is
   * DRAFT is a state nobody can act on: either an editor made the connection or they did not.
   * `relation_suppressions` names its own pair `suppressed_by`/`suppressed_at` rather than
   * `created_*`, because the row records a refusal rather than a creation.
   *
   * `product_attribute_terms` IS THE ONE CONTENT TABLE: Tier A + Tier B, plus the D10 gate in
   * CONTENT_TABLES below. No Tier C — it ships with zero rows and no seed module writes it,
   * because a wood species attached to Rivya is a capability claim only the owner may make.
   */
  /*
   * Phase 24 — the bulk engine. Four §1.4 exemptions of the "record of something that happened"
   * kind, the same family as `audit_logs` and `content_seed_runs`.
   *
   * `bulk_operations` HAS NO `updated_at` AND NO `updated_by`, and that is the design rather than
   * an omission: the row's lifecycle IS its timestamps — requested, started, finished, undone —
   * and `actor_user_id` is the whole actor story. A generic "last changed" column would name a
   * moment none of the four already covers.
   *
   * `bulk_operation_items` HAS NO TIMESTAMP AT ALL. An item belongs to exactly one operation and
   * happened when that operation did; a second time would be a value that can disagree with its
   * parent. What it carries instead is `row_version_before`, which is not a timestamp about this
   * row — it is the ENTITY's updated_at as the operation left it, and it is what undo compares
   * against.
   *
   * The two import tables carry `created_at` because a file is uploaded at a moment its operation
   * has not happened at yet, and `bulk_import_rows` is pruned by that column at thirty days.
   */
  /*
   * Phase 25 — the research subsystem. Three tiers, and the split is not arbitrary.
   *
   * `research_sources`, `research_jobs` and `research_products` ARE CONTENT-BEARING in the §1.2
   * sense — a person creates them, edits them and is accountable for them — so they carry the
   * full common set, `status` included. NONE of them carries `owner_verification`, which for
   * `research_sources` is a deliberate departure: it is the one research row D10 plainly governs,
   * and `policy_status` is already its verification gate, enforced by a CHECK that makes an
   * enabled-but-unapproved source unstorable. Two columns answering one question, only one of them
   * enforced, is how the unenforced one ends up being the one somebody reads.
   *
   * `research_runs`, `research_fetches`, `research_raw_items`, `research_work_items` and
   * `research_pipeline_events` are §1.4 exemptions of the "record of something that happened"
   * kind — the same family as `audit_logs` and `bulk_operations`. A run has `queued_at`,
   * `started_at` and `finished_at`, which say more than an `updated_at` could; a fetch happened at
   * one moment and never changes; a pipeline event is append-only by construction.
   *
   * `research_robots_cache` IS NEITHER. It is a cache: `fetched_at` and `expires_at` are its whole
   * lifecycle, and a `status` on a cached copy of somebody else's file would be a column nobody
   * could answer.
   */
  research_sources: [
    'slug',
    'name',
    'base_url',
    'is_enabled',
    'policy_status',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_jobs: [
    'source_id',
    'job_type',
    'name',
    'scope',
    'is_enabled',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_products: [
    'source_id',
    'source_url',
    'stage',
    'disposition',
    'first_seen_at',
    'last_seen_at',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_runs: ['job_id', 'source_id', 'status', 'trigger', 'queued_at', 'stats'],
  research_work_items: ['run_id', 'source_id', 'url', 'state', 'not_before_at', 'created_at'],
  research_fetches: ['run_id', 'source_id', 'url', 'robots_decision', 'fetched_at'],
  research_raw_items: ['run_id', 'source_id', 'source_url', 'raw', 'extracted_at'],
  research_pipeline_events: ['entity_type', 'entity_id', 'actor_kind', 'occurred_at'],
  research_robots_cache: ['host', 'fetched_at', 'expires_at'],
  /*
   * Phase 26 — the three source-configuration child tables.
   *
   * ALL THREE CARRY THE FULL COMMON SET, `status` INCLUDED, which follows `research_jobs` rather
   * than the §1.4 record-of-something-that-happened exemptions above it. A URL pattern, a category
   * mapping and a schedule are all things a PERSON writes, edits and is accountable for — the §1.2
   * test — and `updated_by` on each is what makes "who widened this source's reach" answerable.
   *
   * NONE CARRIES `owner_verification`, for the reason A25 records for `research_sources` itself:
   * the verification gate for this whole subsystem is `policy_status` on the parent, enforced by a
   * CHECK that makes an enabled-but-unapproved source unstorable. A second flag on a child row
   * would be a flag nothing reads.
   */
  /*
   * Phase 28 — three tables, and none of them carries Tier A whole.
   *
   * `research_validation_issues` and `research_match_candidates` are §1.4 exemptions of the
   * "record of something that happened" kind: a finding was found at a moment and a proposal was
   * made at one. Neither has `updated_at`, because neither is edited — an issue is DISMISSED,
   * which is four columns of its own recording who and why, and a candidate is DECIDED, which is
   * three. `updated_by` on either would name a person for the row's creation, and no person
   * created it.
   *
   * `research_material_lexicon` IS content-bearing in the §1.2 sense — a person adds a token, edits
   * its patterns and is accountable for them — so it carries the full common set, `status`
   * included, exactly as `research_source_url_patterns` does. It carries no `owner_verification`
   * for the reason A25 records for the whole subsystem: the verification gate here is
   * `policy_status` on the source, and a second flag on a parsing vocabulary would be a flag
   * nothing reads.
   */
  research_validation_issues: [
    'research_product_id',
    'rule',
    'severity',
    'is_dismissed',
    'detected_at',
  ],
  research_match_candidates: [
    'research_product_id',
    'candidate_id',
    'method',
    'score',
    'decided',
    'created_at',
  ],
  research_material_lexicon: [
    'token',
    'patterns',
    'is_enabled',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_source_url_patterns: [
    'source_id',
    'kind',
    'pattern',
    'is_regex',
    'priority',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_source_category_map: [
    'source_id',
    'source_label',
    'is_ignored',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  /*
   * Phase 27 — the two extraction tables, both §1.4 exemptions of the
   * "record of something that happened" kind.
   *
   * `research_product_versions` HAS `observed_at` AND NOTHING ELSE FROM TIER A, and the absence of
   * `updated_at` is the design rather than an omission: a version is APPEND-ONLY and deduplicated
   * by content hash, so a row that could be updated would be a row whose content hash no longer
   * describes it. `updated_by` would name a person for a row no person wrote — the adapter did.
   * The same reasoning `audit_logs`, `research_fetches` and `research_pipeline_events` already
   * carry.
   *
   * `research_adapter_runs` has `started_at` and `finished_at`, which say more than an `updated_at`
   * could: the counters move as a run is drained across many cron ticks, and what a reader wants
   * is when it began and whether it has ended, not when the row was last touched.
   */
  research_product_versions: [
    'research_product_id',
    'raw',
    'content_hash',
    'adapter_key',
    'adapter_version',
    'observed_at',
  ],
  research_adapter_runs: [
    'run_id',
    'source_id',
    'adapter_key',
    'adapter_version',
    'status',
    'items_seen',
    'items_extracted',
    'items_failed',
    'started_at',
  ],
  research_source_schedules: [
    'source_id',
    'job_type',
    'cron_expression',
    'timezone',
    'is_enabled',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  /*
   * Phase 29 — seven tables, and the split is the same one the policies take: what the SYSTEM
   * detected, what a PERSON decided, and what a person CONFIGURED.
   *
   * The two CONFIGURATION tables carry the full common set, `status` included, because every other
   * staff-editable research configuration table already does — `research_source_url_patterns`,
   * `research_source_category_map`, `research_source_schedules` and `research_material_lexicon`.
   * A tag and a threshold are edited by a person who is accountable for them, which is what §1.2
   * means by content-bearing.
   *
   * The five others are §1.4 exemptions of the "record of something that happened" kind, and none
   * of them has `updated_at` or `updated_by`:
   *
   *   `research_changes`          was detected at a moment. Its decision columns are a cache of
   *                               the action log and name their own actor and time.
   *   `research_review_actions`   is APPEND-ONLY at the trigger. A row that could be updated is a
   *                               decision somebody could rewrite, which is the one thing an audit
   *                               trail may not permit; the reversal is a new row.
   *   `research_notes`            the same, one step along: an edit is a new note.
   *   `research_product_tags`     is an edge. `assigned_by`/`assigned_at` are its whole story, and
   *                               the composite primary key IS the row — an UPDATE could only move
   *                               a tag between products, which is two decisions disguised as one.
   *   `research_change_digests`   is generated. `generated_at` is the only time anybody wants, and
   *                               `updated_by` would name a person for a row the cron wrote.
   */
  research_changes: [
    'research_product_id',
    'source_id',
    'field',
    'change_kind',
    'materiality',
    'version_after_id',
    'detected_at',
  ],
  research_change_rules: [
    'source_id',
    'field',
    'is_enabled',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_review_actions: ['research_product_id', 'action', 'actor_role', 'occurred_at'],
  research_notes: ['research_product_id', 'body', 'created_at'],
  research_tags: [
    'slug',
    'label',
    'is_enabled',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_product_tags: ['research_product_id', 'tag_id', 'assigned_at'],
  research_change_digests: ['digest_date', 'stats', 'generated_at'],

  /*
   * Phase 30 — two tables, both carrying the full common set, and for once the reason is the same
   * for both: a person creates the row and is accountable for it, which is what §1.2 means by
   * content-bearing.
   *
   * `research_large_format_rules` is configuration, exactly as `research_change_rules` and
   * `research_material_lexicon` are. `research_saved_views` is the one research table whose rows
   * belong to individual PEOPLE — it additionally carries `owner_user_id`, which is not a tier
   * column but is the row's whole identity, and its `status` defaults to PUBLISHED rather than
   * DRAFT because a view somebody just saved is one they mean to use.
   */
  research_large_format_rules: [
    'priority',
    'predicate',
    'is_enabled',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_saved_views: [
    'surface',
    'name',
    'filters',
    'is_shared',
    'owner_user_id',
    'status',
    'created_at',
    'updated_at',
    'updated_by',
  ],

  /*
   * Phase 31 — a person's workspace and the machine's record, and the tiers say which is which.
   *
   * `research_comparison_sets` carries the full common set because a human names and owns it.
   * `research_comparison_members` is a join row under it: `created_at`/`created_by` and nothing
   * to publish or verify. `research_analytics_snapshots` and `research_metric_coverage` are
   * measurements — a §1.4 exemption of the `activity_events` kind, timestamped by `computed_at` /
   * `as_of` and never edited, so `updated_at` would record an event that cannot happen.
   */
  research_comparison_sets: [
    'name',
    'slug',
    'band_rule',
    'status',
    'created_at',
    'created_by',
    'updated_at',
    'updated_by',
  ],
  research_comparison_members: ['set_id', 'member_type', 'position', 'created_at'],
  research_analytics_snapshots: [
    'scope_type',
    'metric_family',
    'payload',
    'row_count',
    'computed_at',
  ],
  research_metric_coverage: ['snapshot_id', 'metric_key', 'n', 'denominator', 'as_of'],

  /*
   * Phase 32 — the model register carries the full common set (a person publishes a version);
   * scores and components are measurements of the `activity_events` kind: timestamped by
   * `computed_at`, never edited.
   */
  /*
   * Phase 33 — every table is a measurement or a record of one, timestamped by `computed_at` /
   * `started_at` / `created_at` and never edited (the `activity_events` exemption of §1.4). A
   * suppression is a person's judgement, so it carries `created_by`.
   */
  research_image_hashes: [
    'research_product_id',
    'source_id',
    'source_image_key',
    'checksum',
    'phash',
    'dhash',
    'computed_at',
  ],
  research_similarity_runs: ['scope_type', 'method', 'status', 'started_at'],
  research_similarity_pairs: ['run_id', 'left_hash_id', 'right_hash_id', 'band', 'created_at'],
  research_similarity_suppressions: [
    'left_hash_id',
    'right_hash_id',
    'reason',
    'created_at',
    'created_by',
  ],
  media_asset_hashes: ['media_asset_id', 'kind', 'checksum', 'computed_at'],

  /*
   * Phase 34 — the brief carries the full common set (a person authors and edits it); evidence and
   * revisions are append-style records under it, timestamped at creation and never edited.
   */
  research_direction_briefs: [
    'slug',
    'title',
    'status',
    'owner_verification',
    'fact_classification',
    'created_at',
    'created_by',
    'updated_at',
    'updated_by',
  ],
  research_direction_brief_evidence: [
    'brief_id',
    'evidence_type',
    'evidence_id',
    'rationale',
    'created_at',
    'created_by',
  ],
  research_direction_brief_revisions: ['brief_id', 'revision', 'action', 'body', 'created_at'],

  /*
   * Phase 35 — two decision records, timestamped by `opened_at` / `confirmed_at` and closed or
   * archived in place; a person's act each time, so the actor is required.
   */
  research_shortlist_entries: ['research_product_id', 'reason', 'opened_at', 'opened_by'],
  research_confirmations: ['research_product_id', 'decision_note', 'confirmed_at', 'confirmed_by'],

  /* Phase 36 — an export definition names its entity, columns and tab; a run names its definition. */
  sheets_export_definitions: ['slug', 'name', 'entity', 'columns', 'tab_name', 'schedule'],
  sheets_sync_runs: ['definition_id', 'status', 'trigger', 'started_at'],

  /* Phase 37 — one row per metric per day; the reason column travels with UNAVAILABLE (CHECK). */
  analytics_snapshots: ['metric_id', 'dimension', 'as_of', 'availability', 'computed_at'],

  /*
   * Phase 38 — the third log. Append-only like audit_logs and activity_events, so §1.2 exempts it
   * from Tier A: an `updated_at` on a row that must never be updated is a promise the table
   * cannot keep. `first_occurred_at` and `occurred_at` are the event times; `dedupe_key` is
   * what keeps a storm to one row.
   */
  system_logs: ['occurred_at', 'first_occurred_at', 'level', 'channel', 'event', 'dedupe_key'],

  /*
   * Phase 39. A keyword theme is seeded (§42) and owner-edited, so it carries all three tiers; a
   * redirect is operational and never seeded, so Tier A and B only — B because the anon leg keys
   * on `status`, and a paused redirect is a DRAFT one.
   */
  seo_keyword_themes: [...TIER_A, ...TIER_B, ...TIER_C],
  seo_redirects: [...TIER_A, ...TIER_B],

  research_scoring_models: [
    'version',
    'signals',
    'weights_total',
    'lifecycle',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  research_opportunity_scores: [
    'research_product_id',
    'model_id',
    'model_version',
    'confidence',
    'completeness',
    'state',
    'computed_at',
  ],
  research_opportunity_components: ['score_id', 'signal_key', 'weight', 'included'],

  bulk_operations: [
    'kind',
    'target_entity',
    'status',
    'selection',
    'requested_at',
    'actor_user_id',
  ],
  bulk_operation_items: ['operation_id', 'entity_id', 'result', 'before', 'row_version_before'],
  bulk_imports: ['filename', 'checksum', 'column_map', 'status', 'created_at'],
  bulk_import_rows: ['import_id', 'row_number', 'raw', 'issues', 'action', 'created_at'],

  search_documents: ['entity_type', 'entity_id', 'visibility', 'status', 'indexed_at'],
  research_search_documents: ['entity_type', 'entity_id', 'visibility', 'status', 'indexed_at'],
  search_queries: ['query_text', 'normalized_query', 'scope', 'result_count', 'occurred_at'],
  content_relations: ['created_at', 'created_by'],
  relation_suppressions: ['rule_key', 'suppressed_by', 'suppressed_at'],
  product_attribute_terms: [...TIER_A, ...TIER_B],

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

/*
 * BASE TABLES ONLY, AND THE RESTRICTION ARRIVED WITH THE FIRST VIEW (Phase 26).
 *
 * `information_schema.columns` reports a view's columns exactly as it reports a table's, so
 * `research_source_health_v` showed up here as a relation nobody had decided the column tiers for
 * — and there are no tiers to decide. A view has no `created_at` because nothing creates it and no
 * `updated_by` because nobody writes it; §1.2 and §1.4 are both about rows somebody is accountable
 * for, and a derived relation has none.
 *
 * What IS worth asserting about a view is asserted elsewhere, because it is a different question:
 * `scripts/research/check-research-isolation.mjs` fails if any research_* view is granted to
 * `anon`, which for a relation with no policies is the whole of its access control.
 */
const columnRows = q(`
  select c.table_name || ' ' || c.column_name
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
  order by c.table_name, c.column_name;
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
  // Phase 23. A term names something the workshop can supposedly work in — a wood species, a resin
  // style — which is exactly the class of claim D10 exists for. It defaults to
  // OWNER_VERIFICATION_REQUIRED, so without this gate the default would be decorative.
  'product_attribute_terms',
  // Phase 39. A keyword theme can assert a service geography ("custom furniture India") and two
  // are seeded OWNER_VERIFICATION_REQUIRED; a redirect carries no claim but has the same status
  // column and the same gate, so the rule is uniform rather than remembered per table.
  'seo_keyword_themes',
  'seo_redirects',
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
