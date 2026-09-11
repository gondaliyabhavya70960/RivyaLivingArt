#!/usr/bin/env node
/**
 * auth:gen-policies — emit supabase/migrations/0011_rls_policies.sql from the permission matrix.
 *
 * The policy role lists are NOT hand-written. They are generated from lib/auth/permissions.ts and
 * lib/auth/table-permissions.ts, and CI regenerates and diffs (`npm run auth:check-policies`). So
 * the two enforcement layers cannot disagree about which roles read what: changing a cell in the
 * matrix without regenerating fails the build, and editing the migration by hand fails it too.
 *
 * This is the generator half. scripts/auth/check-rls.ts is the other half and asks a different
 * question — it reads pg_policies back OUT of a live database and compares that to the matrix.
 * Both are needed: this one proves the file matches the matrix, that one proves the DATABASE does.
 * A migration can be correct and never applied; a database can drift from the migration that made
 * it.
 *
 *   npm run auth:gen-policies           write the migration
 *   npm run auth:check-policies         regenerate in memory and diff, exit 1 on drift
 */
import { readFileSync, writeFileSync } from 'node:fs'

import { rolesWithPermission, type Role } from '../../lib/auth/permissions'
import {
  MANAGED_TABLES,
  PHASE_04_POLICIES,
  PHASE_05_POLICIES,
  PHASE_06_POLICIES,
  PHASE_07_POLICIES,
  PHASE_08_POLICIES,
  PHASE_15_POLICIES,
  PHASE_16_POLICIES,
  PHASE_17_POLICIES,
  PHASE_18_POLICIES,
  PHASE_19_LIMIT_POLICIES,
  PHASE_20_POLICIES,
  PHASE_21_POLICIES,
  PHASE_22_POLICIES,
  PHASE_23_RELATION_POLICIES,
  PHASE_23_SEARCH_POLICIES,
  PHASE_24_POLICIES,
  PHASE_25_POLICIES,
  PHASE_26_POLICIES,
  PHASE_27_POLICIES,
  PHASE_28_POLICIES,
  PHASE_29_POLICIES,
  PHASE_30_POLICIES,
  PHASE_31_POLICIES,
  PHASE_32_POLICIES,
  PHASE_33_POLICIES,
  PHASE_34_POLICIES,
  PHASE_19_POLICIES,
  TABLE_POLICY_MAP,
  type ManagedTable,
} from '../../lib/auth/table-permissions'

/**
 * The generated policy migrations, and the preamble each one carries.
 *
 * ONE FILE PER PHASE, AND A SHIPPED FILE IS NEVER RE-OPENED. A single growing file would be
 * rewritten by every phase that adds a table, and `db:migrate` refuses a migration edited after it
 * was applied — correctly, because the database would hold the old definition while the repository
 * showed the new one, with every run reporting "0 pending". Each table names its file in
 * `policiesIn`; a table naming a file absent from this map is hand-written elsewhere and skipped.
 *
 * A CONSEQUENCE WORTH STATING. Changing the permission matrix for a table that has ALREADY shipped
 * cannot be done by regenerating its file. It needs a new migration that drops and recreates the
 * affected policies. `auth:check-policies` will catch the attempt — the shipped file no longer
 * matches the matrix — and that failure is the reminder, not a bug.
 */
const GENERATED: Record<string, { title: string; preamble: string }> = {
  [PHASE_04_POLICIES]: {
    title: `-- ${PHASE_04_POLICIES} — Phase 04`,
    preamble: `-- Every staff-select role list below is the set of roles holding that table's *.read permission.
-- That equality is the rule this phase exists to make unbreakable: scripts/auth/check-rls.ts reads
-- pg_policies back out of the migrated database and fails when a policy's list has drifted from
-- the matrix, when a public table is missing from table-permissions.ts, or when a table matches
-- none of Shape A, Shape B or a declared deviation.
--
-- Until this migration runs, every table has RLS enabled with NO policy — which denies everything
-- to anon and authenticated. This file is where access is granted deliberately, for the first time.
--
-- Note what is NOT here: \`force row level security\`. Adding it would also subject the seed runner
-- and every RLS-SERVICE writer to these policies, which DATA_MODEL deliberately does not intend.
-- The service role bypasses RLS by role attribute, and that is the designed escape hatch.`,
  },
  [PHASE_06_POLICIES]: {
    title: `-- ${PHASE_06_POLICIES} — Phase 06`,
    preamble: `-- Policies for media_usages, which migration 0030 creates. Separate from 0021 for the same
-- reason 0021 was separate from 0011: a generated policy file is never re-opened once shipped.
--
-- media_assets' own policies are NOT here. They were generated into 0011 in Phase 04, and that file
-- has shipped — its table set is fixed. Phase 06 widens the media_assets COLUMN set, which changes
-- no policy: every policy on that table gates on \`status\` and \`has_role()\`, neither of which is
-- affected by adding columns.`,
  },
  [PHASE_07_POLICIES]: {
    title: `-- ${PHASE_07_POLICIES} — Phase 07`,
    preamble: `-- Policies for higgsfield_migration_runs, which migration 0040 creates. Its own file for the
-- same reason 0031 and 0021 were: a generated policy file is never re-opened once shipped.
--
-- ONE POLICY, and the absence of the other three is the point. This table is written by a CLI
-- migration over DATABASE_URL, which bypasses RLS by role attribute — so an insert policy would
-- describe a path nothing uses, and reviewing it later would suggest a session can write run
-- records when none can. Staff read it; nothing else touches it through PostgREST.`,
  },
  [PHASE_08_POLICIES]: {
    title: `-- ${PHASE_08_POLICIES} — Phase 08`,
    preamble: `-- Policies for the seven tables migration 0050 creates. Its own file for the same reason 0021,
-- 0031 and 0041 were: a generated policy file is never re-opened once shipped.
--
-- THREE TABLES CARRY A CUSTOM PUBLIC CLAUSE, and each one is load-bearing rather than a
-- refinement. \`pages\` and \`page_sections\` add the SCHEDULE WINDOW: without it a row scheduled
-- for next week is readable the instant its status changes, and scheduling is decorative.
-- \`pages\` also requires \`path is not null\`, which is what keeps the reserved slug='global'
-- SYSTEM row off the public site — it has no address, and an application-level filter is a
-- promise a refactor can break, while a null in the predicate cannot be. \`global_content\` adds
-- \`is_enabled\`, the switch that turns a CTA off without unpublishing it.
--
-- page_sections tests its PAGE's window as well as its own. A published section on an
-- unpublished page must not be readable, or a page scheduled for next week leaks section by
-- section to anyone querying the table directly — which is precisely what an anon key can do.
--
-- content_revisions is shape C with no write policy of any kind. See its declared deviation.`,
  },
  [PHASE_05_POLICIES]: {
    title: `-- ${PHASE_05_POLICIES} — Phase 05`,
    preamble: `-- Policies for the two tables migration 0020 creates. Separate from 0011 because 0011 has shipped:
-- see GENERATED in scripts/auth/gen-role-sql.ts for why a policy file is never re-opened.
--
-- studio_preferences carries an OWNER SCOPE, which is new here. Both its permissions are held by
-- all six roles, so the role list alone grants nothing useful — \`user_id = auth.uid()\` is what
-- makes it safe, and it is ANDed into the select, insert and update policies alike. An extra
-- SELECT leg would not have done: the danger is one staff member OVERWRITING another's row.`,
  },
  [PHASE_16_POLICIES]: {
    title: `-- ${PHASE_16_POLICIES} — Phase 16`,
    preamble: `-- Policies for \`entity_relations\`, which migration 0141 creates. Separate from that file for the
-- reason every policy file is separate: this one is GENERATED from lib/auth/table-permissions.ts and
-- is rewritten whole, so it may hold nothing a human wrote.
--
-- \`collections\` IS NOT HERE. It has carried Phase 04 policies since 0011 and gains no new ones —
-- the columns Phase 16 adds are read and written under the same catalog.read / catalog.write it
-- already had. A policy file is never re-opened once shipped, so the absence is correct rather than
-- an omission.
--
-- entity_relations is SHAPE C: staff-only, no anon policy at all. Its sibling product_relations is
-- shape B with a parent clause testing its source product's status, which works because that
-- table's source is always a product. This one's source is polymorphic — a \`source_type\` chosen at
-- runtime — and RLS cannot join a table named in a column, so there is no parent clause to write.
-- An unconditional anon read was the alternative, and it would publish an editor's \`note\` about
-- work that may not be published, plus the existence of edges pointing at drafts.`,
  },
  [PHASE_15_POLICIES]: {
    title: `-- ${PHASE_15_POLICIES} — Phase 15`,
    preamble: `-- Policies for \`product_specs\`, which migration 0130 creates. Separate from that file for the
-- reason every policy file is separate: this one is GENERATED from lib/auth/table-permissions.ts and
-- is rewritten whole, so it may hold nothing a human wrote.
--
-- product_specs is shape A with a PARENT TEST FOLDED INTO ITS PUBLIC CLAUSE. A spec row is a
-- sentence about a product — "Seat height · 450 mm" — so a published row hanging off an unpublished
-- product would publish a measurement of a piece the site does not admit exists. The row's own
-- status is therefore not the whole condition, and \`publicClause\` says so explicitly rather than
-- leaving the parent test to the application that happens to join the two.`,
  },
  [PHASE_17_POLICIES]: {
    title: `-- ${PHASE_17_POLICIES} — Phase 17`,
    preamble: `-- Policies for \`portfolio_projects\`, \`portfolio_project_media\` and \`testimonials\`, which
-- migration 0150 creates. Separate from that file for the reason every policy file is separate:
-- this one is GENERATED from lib/auth/table-permissions.ts and is rewritten whole, so it may hold
-- nothing a human wrote.
--
-- ALL THREE ARE SHAPE A, AND THE PUBLIC CLAUSE IS DELIBERATELY THIN. \`status = 'PUBLISHED'\` is the
-- whole test on a project and on a testimonial, because the two rules that actually matter — the
-- owner has verified this happened, and anyone the row names has consented to be named — are
-- enforced by \`enforce_project_evidence_gate()\` and \`enforce_testimonial_evidence_gate()\` at the
-- moment of publication. A row cannot REACH published without satisfying them, so re-testing
-- \`owner_verification\` here would be a second copy of a rule that could drift from the trigger.
--
-- \`portfolio_project_media\` DOES carry a parent test, matching \`product_specs\`: the photographs
-- of an unpublished project must not be readable, or the existence and the contents of unannounced
-- work leak through the join even while the project row itself stays hidden.`,
  },
  [PHASE_18_POLICIES]: {
    title: `-- ${PHASE_18_POLICIES} — Phase 18`,
    preamble: `-- Policies for \`journal_categories\`, \`journal_articles\` and
-- \`journal_article_categories\`, which migration 0160 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- \`journal_articles\` IS THE ONLY TABLE ON THE SITE WHOSE PUBLIC READ IS GATED BY A DATE.
-- \`status = 'PUBLISHED' and published_at <= now()\`. Scheduling matters for editorial in a way it
-- does not for a product or a project: a piece is written, approved and set to appear on a given
-- morning, and a row that is PUBLISHED with a future date must not be readable before it. The
-- Phase 08 scheduler flips status on a cron; a cron that runs early — or a publish performed by
-- hand ahead of the date — would otherwise put the article on the site immediately. The clause is
-- the guard that does not depend on a job running at the right minute.
--
-- \`journal_article_categories\` CARRIES A PARENT TEST, matching \`portfolio_project_media\` and
-- \`product_specs\`. Which categories an unpublished article belongs to is a fact about
-- unpublished editorial — a reader could enumerate the studio's unannounced pieces by category
-- from the join alone, without ever reading the article row.
--
-- \`journal_categories\` HAS THE ORDINARY THIN CLAUSE. A category asserts nothing about the
-- business beyond "the studio writes about this", and the nine seeded ones ship PUBLISHED
-- precisely so their pages can render.`,
  },
  [PHASE_19_POLICIES]: {
    title: `-- ${PHASE_19_POLICIES} — Phase 19`,
    preamble: `-- Policies for the four customization-form tables migration 0170 creates and \`feature_flags\`
-- from 0171. GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it may hold
-- nothing a human wrote.
--
-- THE THREE FORM TABLES USE CATALOGUE PERMISSIONS, NOT CONTENT ONES. A form definition is edited
-- at /studio/catalog/customization-forms, is bound to products and categories, and is the same
-- person's work as naming a product — so \`catalog.read\` / \`catalog.write\`, which admits the
-- merchandiser and not the editor. Using \`content.write\` would have inverted that for the one
-- surface whose entire job is asking questions about a product.
--
-- STEPS AND FIELDS CARRY A PARENT TEST. A step is a question; the questions of an unpublished
-- PRESERVATION template are a legible plan of a service not yet offered, readable by anon straight
-- through PostgREST even while the form row itself stays hidden. \`product_customization_forms\`
-- goes further and tests BOTH ends: without the product and category halves, that table is a list
-- of every unreleased product id the studio has bound a brief to.
--
-- \`feature_flags\` IS SHAPE C AND ITS READ IS \`studio.access\`, held by all six roles. That is
-- deliberate: the register of what is switched on is how anyone in the Studio accounts for a
-- surface that is missing, and STUDIO_GUIDE §2.3 explicitly rejected hiding it behind the write
-- permission. Nothing public reads it, and publishing it would hand a visitor the list of features
-- being prepared with the date each one was switched.`,
  },
  [PHASE_20_POLICIES]: {
    title: `-- ${PHASE_20_POLICIES} — Phase 20`,
    preamble: `-- Policies for the three tables migration 0190 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- \`inquiries\` IS THE ONLY TABLE ON THIS SITE A STRANGER MAY WRITE, and the only one whose write
-- has no session behind it. D1 forbids customer accounts, so the person filling in the form is
-- nobody: the \`with check\` below is doing the work \`requirePermission\` does everywhere else.
--
-- THERE IS NO ANON SELECT ON ANY OF THE THREE, and that absence is the most load-bearing thing in
-- this file. An enquiry carries a name, a phone number, a city and whatever a visitor chose to say
-- about their home; one \`using (true)\` and the customer list is a GET away through PostgREST,
-- with the publishable key that ships in every browser. anon INSERTS and never reads back — not
-- even the row it has just written.
--
-- READ IS \`inquiries.read\`, WHICH THE RESEARCHER DOES NOT HOLD. table-permissions.ts used this
-- table as its worked example years before it existed: \`using (is_staff())\` here would hand every
-- customer's phone number to a role whose entire remit is looking at competitors.
--
-- \`inquiry_attachments\` HAS NO ANON INSERT despite the phase document naming one. An attachment
-- references \`media_assets\`, and anon cannot create one of those — so the policy would describe a
-- path with no way to satisfy its own foreign key. \`attach_inquiry_references()\` is SECURITY
-- DEFINER instead (amendment A20). \`inquiry_events\` has no write policy at all: it is written by
-- triggers and refuses UPDATE and DELETE outright.`,
  },
  [PHASE_19_LIMIT_POLICIES]: {
    title: `-- ${PHASE_19_LIMIT_POLICIES} — Phase 19`,
    preamble: `-- Policies for \`rate_limit_buckets\`, which migration 0182 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- ONE POLICY, and the absence of the other three is the point. The table is written solely by
-- \`consume_rate_limit()\`, a SECURITY DEFINER function granted to \`service_role\` alone — because
-- the bucket key is derived from the caller's address, and a session that could pass its own key
-- could exhaust somebody else's window on their behalf. An INSERT policy here would describe a
-- path nothing uses and would tell a later reader that a session can move a counter.
--
-- NO ANON POLICY EITHER. A visitor who could read their own bucket would learn exactly how close
-- they are to the ceiling and exactly when it resets, which is the information needed to pace an
-- attack rather than to stop one.`,
  },
  [PHASE_21_POLICIES]: {
    title: `-- ${PHASE_21_POLICIES} — Phase 21`,
    preamble: `-- Policies for \`model_variant_labels\`, which migration 0194 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- SHAPE B ON A MEDIA PARENT. A label has no status of its own: it is public exactly when the model
-- it names is PUBLISHED, and never on its own — a switch here would be a second switch that could
-- disagree with the first. Writes mirror \`media_assets\`: \`media.write\` to add or edit a label,
-- \`media.delete\` to remove one.
--
-- WHAT THE POLICY DOES NOT DECIDE. Whether a label may carry a \`material_id\` is a CHECK on the
-- row (a material forces at least OWNER_VERIFICATION_REQUIRED), and who may mark it VERIFIED is
-- the Phase 08 authority trigger (owner and admin). Neither is an access question, so neither is
-- here; \`lib/media/model.ts\` then returns the material name to the public viewer only at VERIFIED.`,
  },
  [PHASE_22_POLICIES]: {
    title: `-- ${PHASE_22_POLICIES} — Phase 22`,
    preamble: `-- Policies for \`merchandising_slots\` and \`merchandising_entries\`, which migration 0200 creates.
-- GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human
-- wrote.
--
-- THE PUBLIC RESOLVER READS WITH THE ANON KEY, so both tables are shape A rather than staff-only:
-- a slot is readable while PUBLISHED, and an entry only while PUBLISHED, inside its half-open
-- window, AND inside a PUBLISHED slot. The window is part of the clause for the reason it is on
-- \`page_sections\`: a plan readable the moment it is saved makes scheduling decorative.
--
-- WRITES ARE \`merchandising.write\` (owner, admin, merchandiser) ON BOTH, and removing an entry is
-- the same permission — curation, not destruction. Removing a SLOT is \`destructive.execute\`:
-- nothing in the Studio does it, because a slot nothing reads is a dead end.
--
-- WHAT THE POLICY DOES NOT DECIDE. Whether an entry names a type its slot admits, whether the entity
-- exists, and whether a collection is still a concept are all \`guard_merchandising_entry()\` on the
-- row (0200). None is an access question, so none is here.`,
  },
  [PHASE_23_SEARCH_POLICIES]: {
    title: `-- ${PHASE_23_SEARCH_POLICIES} — Phase 23`,
    preamble: `-- Policies for \`search_documents\`, \`research_search_documents\` and \`search_queries\`, which
-- migration 0210 creates. GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it
-- may hold nothing a human wrote.
--
-- THE INDEX IS READ BY ANON AND WRITTEN BY NOBODY. \`search_documents\` gets the one named \`anon\`
-- grant §1.5 permits — \`visibility = 'PUBLIC' and status = 'PUBLISHED'\` — and NO insert or update
-- policy for any session role at all. Every row is written by \`refresh_search_document()\`, a
-- security-definer trigger function (0211), so a signed-in member of staff cannot hand-write a
-- search result carrying a title, a URL and a picture that the entity itself does not say.
--
-- TWO INDEXES, AND THE SECOND HAS NO ANON LEG AND NEVER WILL. \`research_search_documents\` is
-- staff-only under \`research.read\` — the one permission \`editor\` does not hold — which is
-- research isolation invariant I2 arriving two phases before the subsystem it protects.
--
-- \`search_queries\` IS NOT PUBLICLY READABLE EITHER, in either direction: a visitor may not read
-- what other visitors searched for, and may not write a row claiming a search that never happened.
-- Both scopes log through the service role.`,
  },
  [PHASE_23_RELATION_POLICIES]: {
    title: `-- ${PHASE_23_RELATION_POLICIES} — Phase 23`,
    preamble: `-- Policies for \`content_relations\`, \`relation_suppressions\` and \`product_attribute_terms\`,
-- which migration 0213 creates. GENERATED from lib/auth/table-permissions.ts and rewritten whole,
-- so it may hold nothing a human wrote.
--
-- A SECOND GENERATED FILE FOR ONE PHASE, because a generated file is rewritten whole and therefore
-- cannot also carry the DDL that creates its tables. 0212 covers the search index; this covers the
-- relation tables 0213 adds. Phase 19 did the same with 0172 and 0183.
--
-- \`content_relations\` IS SHAPE B ON A POLYMORPHIC PARENT, so its public clause is three
-- exists-tests — one per source type — rather than one. An edge is visible exactly when the row it
-- hangs off is published; the TARGET is not tested here, because an edge to an unpublished product
-- must resolve to nothing rather than to a broken link and that filter belongs in the repository,
-- where it also serves the Studio preview this policy does not apply to.
--
-- \`relation_suppressions\` IS STAFF-ONLY. It records what an editor decided NOT to connect, which
-- is a view of the editing process rather than of the catalogue.
--
-- \`product_attribute_terms\` IS ORDINARY SHAPE-A CONTENT and ships with zero rows. What stops a
-- term reaching a visitor is not this policy but the D10 gate on the row: it defaults to
-- OWNER_VERIFICATION_REQUIRED and cannot be PUBLISHED until somebody with \`content.verify\` says
-- the workshop really works in it.`,
  },
  [PHASE_25_POLICIES]: {
    title: `-- ${PHASE_25_POLICIES} — Phase 25`,
    preamble: `-- Policies for the nine research tables, which migrations 0231 and 0232 create. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- ISOLATION INVARIANT I2 IS THIS FILE. NOT ONE \`anon\` POLICY APPEARS BELOW, on any table, and
-- none ever may. There is no visitor-facing view of a competitor's catalogue, of what Rivya
-- fetched from one, or of what it decided about the result — so an anon leg here would not be a
-- change of policy but a defect with a syntax. \`scripts/research/check-research-isolation.mjs\`
-- reads \`pg_policies\` and fails the build the moment one exists.
--
-- READ IS \`research.read\` THROUGHOUT — owner, admin, merchandiser, researcher and viewer.
-- \`editor\` is the one role that does not hold it, which is the line Phase 23 already drew for
-- \`research_search_documents\`.
--
-- WRITE SPLITS THREE WAYS, AND THE SPLIT IS THE PHASE DOCUMENT'S: a researcher OPERATES the
-- pipeline and a merchandiser JUDGES its output.
--
--   research.write    sources, jobs, runs — the machinery
--   research.confirm  research_products — because its editable columns here are \`stage\` and
--                     \`disposition\`, and both are disposition-bearing. The dividing line is the
--                     COLUMN, not the screen
--   nobody            fetches, raw items, work items, the robots cache and the pipeline events
--
-- THAT LAST GROUP IS THE POLITENESS POSTURE, AND IT IS WHY THEY HAVE NO SESSION WRITE. A row in
-- \`research_fetches\` is the evidence that a URL was refused before any packet left; a session
-- able to write one could record a request that never happened, or claim a robots-DISALLOWED URL
-- had been ALLOWED. A session able to write \`research_robots_cache\` could tell the fetcher that a
-- forbidden host permits everything. A session able to write \`research_work_items\` could clear a
-- \`not_before_at\` and edit the rate limit from inside the building. All four are written by the
-- engine through the service role, after \`requirePermission\`.
--
-- \`research_pipeline_events\` IS APPEND-ONLY, the \`audit_logs\` precedent applied to the
-- pipeline's own history: no write policy at all, and 0231 revokes update and delete outright.
-- \`lib/scraper/core/stage.ts\` writes it in the same call that moves the stage, so a move without
-- an event is not something that can happen.`,
  },
  [PHASE_26_POLICIES]: {
    title: `-- ${PHASE_26_POLICIES} — Phase 26`,
    preamble: `-- Policies for the three source-configuration child tables, which migration 0240 creates.
-- GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human
-- wrote. Its own file for the reason every generated policy file has one: 0240 carries the DDL and
-- a shipped generated file is never re-opened.
--
-- ISOLATION INVARIANT I2 AGAIN, AND IT IS WORTH RESTATING HERE RATHER THAN ASSUMED FROM 0233. One
-- of these three tables holds the first foreign key from the research schema into a public one —
-- \`research_source_category_map.category_id\` — and the temptation a reader should not have to
-- resist is that a table pointing at \`categories\` might reasonably be readable wherever
-- \`categories\` is. It is not. The pointer is Rivya's private reading of a competitor's taxonomy;
-- the direction of the reference says nothing about who may see it.
--
-- ALL THREE ARE \`research.write\`, NOT \`research.confirm\`. They are configuration, and
-- configuration is what a researcher operates. The confirm/write split the phase document draws is
-- about columns that carry a DISPOSITION, and no column in these three tables does.
--
-- DELETE IS \`destructive.execute\` ON ALL THREE, which is stricter than it first looks for the URL
-- patterns: deleting an EXCLUDE row does not remove information, it WIDENS what Rivya will fetch.
-- That is the same class of act as unpublishing live content, and it takes the same permission.`,
  },
  [PHASE_27_POLICIES]: {
    title: `-- ${PHASE_27_POLICIES} — Phase 27`,
    preamble: `-- Policies for the two extraction tables, which migration 0250 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote. Its own
-- file for the reason every generated policy file has one: 0250 carries the DDL, and a shipped
-- generated file is never re-opened.
--
-- READ ONLY, FOR EVERYONE, AND THAT IS THE WHOLE FILE. Four select policies' worth of decision:
-- \`research.read\` may look, and no session role may write either table by any means.
--
-- WHY NOT \`research.write\` ON THE VERSIONS TABLE, which a reader might expect by analogy with
-- \`research_sources\`? Because these two tables are not configuration — they are the RECORD of what
-- happened. \`research_product_versions\` is what Phase 29 diffs to say a competitor's price moved,
-- and \`research_adapter_runs\` is what proves a broken adapter stopped at its own source. A
-- researcher able to edit the first could make a change appear that never happened; one able to
-- edit the second could make a failure they caused look like somebody else's. Both are written by
-- \`lib/scraper/workflows/extract.ts\` through the service role, after the drain loop has already
-- checked the kill switch, the policy review and robots.txt.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED AND UNCHANGEABLE: not one \`anon\` leg appears below, on
-- either table, and \`scripts/research/check-research-isolation.mjs\` fails the build the moment one
-- does.`,
  },
  [PHASE_28_POLICIES]: {
    title: `-- ${PHASE_28_POLICIES} — Phase 28`,
    preamble: `-- Policies for the three tables migration 0260 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote. Its own
-- file for the reason every generated policy file has one: 0260 carries the DDL, and a shipped
-- generated file is never re-opened.
--
-- THREE TABLES, THREE DIFFERENT WRITE POSTURES, AND THE DIFFERENCE IS THE PHASE DOCUMENT'S RULE
-- MADE VISIBLE: the dividing line is the COLUMN, not the screen.
--
--   \`research_material_lexicon\`   research.write   — configuration, like a URL pattern
--   \`research_validation_issues\`  research.write   — UPDATE ONLY. The dismissal is the person's
--                                                    part; an ERROR raised by hand is a way to hold
--                                                    rows back with nothing saying why
--   \`research_match_candidates\`   research.confirm — UPDATE ONLY. Deciding one writes
--                                                    \`duplicate_of_id\` and \`disposition\`, and a
--                                                    researcher who may not set those directly must
--                                                    not reach them through a candidate
--
-- NEITHER OF THE TWO UPDATE-ONLY TABLES HAS A DELETE POLICY. An issue that turned out to be wrong
-- is a fact about the RULE that raised it, and deleting the row deletes the evidence that the rule
-- needs changing; a rejected candidate is the record that somebody looked at two rows and said they
-- were different, which is exactly what stops the matcher proposing them again as though nobody had.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one \`anon\` leg appears below, on any of the three, and
-- \`scripts/research/check-research-isolation.mjs\` fails the build the moment one does.`,
  },
  [PHASE_29_POLICIES]: {
    title: `-- ${PHASE_29_POLICIES} — Phase 29`,
    preamble: `-- Policies for the seven tables migration 0270 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote. Its own
-- file for the reason every generated policy file has one: 0270 carries the DDL, and a shipped
-- generated file is never re-opened.
--
-- SEVEN TABLES, THREE POSTURES, AND THE QUESTION THAT SORTS THEM IS "WHO MAY WRITE":
--
--   DETECTED BY THE SYSTEM, no write policy at all
--     \`research_changes\`           the detector's output; a change a session could insert is a
--                                   competitor price move somebody could invent
--     \`research_change_digests\`    a summary read as a trend, which is the worst thing to be able
--                                   to hand-edit
--
--   DECIDED BY A PERSON, \`research.confirm\`, INSERT ONLY
--     \`research_review_actions\`    append-only at the trigger as well as at the policy; a
--                                   reversal is a new row
--     \`research_notes\`             an edit is a new note; the old one is superseded, never rewritten
--     \`research_product_tags\`      applied or removed, never amended — and the only table here
--                                   with a DELETE policy, because removing a tag applied in error
--                                   is a correction and no decision is recorded on the row
--
--   CONFIGURED BY A PERSON, \`research.write\`
--     \`research_change_rules\`      a threshold is a parsing decision about somebody else's page
--     \`research_tags\`              a controlled vocabulary, exactly as the material lexicon is
--
-- THE SPLIT IS THE PHASE 04 ONE, RESTATED AT THE COLUMN: a researcher OPERATES the pipeline and
-- may tune how loudly a source is read; a merchandiser JUDGES its output and is the only one who
-- may record a verdict. Neither may write what the detector found.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED AND UNCHANGEABLE: not one \`anon\` leg appears below, on any
-- of the seven, and \`scripts/research/check-research-isolation.mjs\` fails the build the moment
-- one does.`,
  },
  [PHASE_32_POLICIES]: {
    title: `-- ${PHASE_32_POLICIES} — Phase 32`,
    preamble: `-- Policies for the three tables migration 0300 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   \`research_scoring_models\`         research.score.manage — owner and admin only. The weights
--                                      decide which competitor rows sort first, and the phase
--                                      document's named risk is weights quietly tuned until a
--                                      favoured row ranks first. Readable by research.read.
--
--   \`research_opportunity_scores\`     NO SESSION WRITE POLICY AT ALL. A score a session could
--   \`research_opportunity_components\` insert is a rank somebody typed. The CLI, the cron and the
--                                      Studio recompute action write through the service role.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one \`anon\` leg appears below.`,
  },
  [PHASE_33_POLICIES]: {
    title: `-- ${PHASE_33_POLICIES} — Phase 33`,
    preamble: `-- Policies for the four research tables migration 0310 creates and the ONE first-party table
-- migration 0311 creates. GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it
-- may hold nothing a human wrote.
--
--   \`research_image_hashes\`            SERVICE-ROLE WRITES ONLY, and under amendment A33 there is
--                                      no writer: competitor images are referenced by URL and never
--                                      fetched, so the table holds no rows. Readable by research.read.
--
--   \`research_similarity_runs\`         research.similarity.run — owner, admin, researcher. A run is
--                                      an operator's act, recorded with its counts. No delete leg.
--
--   \`research_similarity_pairs\`        SERVICE-ROLE WRITES ONLY, with its run. Readable by research.read.
--
--   \`research_similarity_suppressions\` research.write records and undoes a dismissal.
--
--   \`media_asset_hashes\`               NOT A RESEARCH TABLE. Read under media.read, exactly as
--                                      media_assets is; written by the service role only (the
--                                      upload path and npm run media:hash). A hash is not published
--                                      content, so there is no anon leg here either.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one \`anon\` leg appears below, on any of the five.
-- I1 IS UNCHANGED TOO: the research tables reference research tables; media_asset_hashes
-- references media_assets; neither names the other, in a constraint or a policy.`,
  },
  [PHASE_34_POLICIES]: {
    title: `-- ${PHASE_34_POLICIES} — Phase 34`,
    preamble: `-- Policies for the three tables migration 0320 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   \`research_direction_briefs\`           research.direction.write — owner, admin, merchandiser,
--                                          researcher. A person's document. Moving it INTO
--                                          APPROVED is gated again, on research.direction.approve,
--                                          by guard_direction_brief_approval() in 0320. No delete
--                                          leg: a brief is ARCHIVED, never removed.
--
--   \`research_direction_brief_evidence\`  research.direction.write attaches and detaches; every
--                                          row carries a non-empty rationale by CHECK.
--
--   \`research_direction_brief_revisions\` NO SESSION WRITE OF ANY KIND. The trigger writes them
--                                          as SECURITY DEFINER; restore goes through
--                                          research_restore_brief_revision(), which re-checks the
--                                          write permission inside.
--
-- PUBLISHED IS UNREACHABLE: the CHECK on research_direction_briefs.status admits four values and
-- not that one, so no policy here could ever admit a public read. ISOLATION INVARIANT I2 IS
-- UNCHANGED: not one \`anon\` leg appears below.`,
  },
  [PHASE_31_POLICIES]: {
    title: `-- ${PHASE_31_POLICIES} — Phase 31`,
    preamble: `-- Policies for the four tables migration 0290 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- FOUR TABLES IN TWO POSTURES, AND THE POSTURE ANSWERS ONE QUESTION: WHO MAY WRITE.
--
--   \`research_comparison_sets\`      research.write — a PERSON'S WORKSPACE. A named selection of
--   \`research_comparison_members\`   sources and rows a researcher builds and recomputes. Choosing
--                                    rows to look at judges none of them, so this is the operating
--                                    half of the Phase 04 split and not \`research.confirm\`.
--
--   \`research_analytics_snapshots\`  NO SESSION WRITE POLICY AT ALL. A snapshot a session could
--   \`research_metric_coverage\`      insert is a market figure nobody computed, sitting in the
--                                    dashboard beside the ones that were. The CLI, the cron and the
--                                    Studio recompute action write through the service role.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one \`anon\` leg appears below, on any of the four.`,
  },
  [PHASE_30_POLICIES]: {
    title: `-- ${PHASE_30_POLICIES} — Phase 30`,
    preamble: `-- Policies for the two tables migration 0280 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- TWO TABLES, AND THEY ARE AS DIFFERENT AS TWO RESEARCH TABLES GET.
--
--   \`research_large_format_rules\`  research.write — CONFIGURATION, exactly as the material lexicon
--                                   and the change thresholds are. A scale band says what KIND of
--                                   object a page describes; it carries no disposition meaning, and
--                                   this phase requires \`research.confirm\` for nothing at all.
--
--   \`research_saved_views\`         research.read, NARROWED TO THE OWNER. The one research table
--                                   whose rows belong to individual people. Five of the six roles
--                                   hold \`research.read\`, so the SCOPE carries the security here
--                                   rather than the permission — without it any of them could
--                                   rewrite everyone else's views.
--
-- THE SHARED LEG IS A SECOND SELECT POLICY, NOT A WIDENED SCOPE. Sharing widens who may READ one
-- row and must not widen who may edit it: a view somebody else can edit is a view whose results
-- change under the person who linked to it.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one \`anon\` leg appears below, on either table.`,
  },
  [PHASE_24_POLICIES]: {
    title: `-- ${PHASE_24_POLICIES} — Phase 24`,
    preamble: `-- Policies for the four bulk tables, which migration 0220 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- FOUR SHAPE-C TABLES AND NOT ONE WRITE POLICY BETWEEN THEM. Every write goes through
-- \`lib/bulk/run.ts\` on the service-role client, AFTER \`requirePermission\`. An \`authenticated\`
-- insert policy would let a signed-in merchandiser hand-write a \`bulk_operations\` row — a preview
-- carrying a selection nobody previewed, or a SUCCEEDED row for an operation that never ran — and
-- an update policy on \`bulk_operation_items\` would let one edit the \`before\` snapshot that undo
-- re-applies, writing anything they liked into a live row while the audit log recorded a
-- restoration.
--
-- NO DELETE POLICY FOR THE TWO RECORD TABLES, EVER, and 0220 revokes the grant as well. They are
-- the account of what somebody did to a page of live content, and a record its author can erase is
-- not a record. The two IMPORT tables are deletable under \`destructive.execute\`, because an
-- import is a working file whose rows are pruned at thirty days rather than history.
--
-- READ IS \`bulk.execute\` (owner, admin, merchandiser). The phase document says "bulk.execute or
-- operations.audit.read"; those two hold {owner, admin, merchandiser} and {owner, admin}, so the
-- union IS \`bulk.execute\`'s set and naming the wider one is the same policy with one fewer thing
-- that can drift.`,
  },
}

/** `'owner','admin'` — the literal list a has_role() call takes. */
function roleList(roles: readonly Role[]): string {
  return roles.map((r) => `'${r}'`).join(',')
}

/** Wrap a has_role() call, or `false` when nobody holds the permission. */
function hasRole(roles: readonly Role[]): string {
  if (roles.length === 0) return 'false'
  return `public.has_role(${roleList(roles)})`
}

function policiesFor(table: ManagedTable): string {
  const policy = TABLE_POLICY_MAP[table]
  const readRoles = rolesWithPermission(policy.readPermission)
  const writeRoles = policy.writePermission ? rolesWithPermission(policy.writePermission) : []
  const deleteRoles = policy.deletePermission ? rolesWithPermission(policy.deletePermission) : []

  /**
   * AND the owner scope into a predicate. Applied to every generated policy on a scoped table —
   * select, insert and update — because the row belongs to a person, not to a role.
   */
  const scoped = (predicate: string): string =>
    policy.ownerScope ? `${predicate} and ${policy.ownerScope.clause}` : predicate

  const out: string[] = []

  out.push(`-- ${'-'.repeat(94)}`)
  out.push(`-- ${table} — shape ${policy.shape}`)
  out.push(`-- ${'-'.repeat(94)}`)
  if (policy.deviation) {
    for (const line of wrap(`DECLARED DEVIATION. ${policy.deviation}`, 96)) out.push(`-- ${line}`)
  }
  out.push(
    `-- read: ${policy.readPermission} (${readRoles.join(', ')})` +
      (policy.writePermission
        ? `   write: ${policy.writePermission} (${writeRoles.join(', ')})`
        : ''),
  )
  out.push('')

  // --- policy 1: the public leg -----------------------------------------------------------------
  if (policy.shape === 'A') {
    // `status = 'PUBLISHED'` is the default and stays the default, so every file generated before
    // `publicClause` existed re-renders byte-identically. A table overrides it only when
    // "published" is not the whole condition — a scheduling window, an `is_enabled` flag, or a
    // null `path` that means "this row has no public address at all".
    const publicClause = policy.publicClause ?? "status = 'PUBLISHED'"
    out.push(`create policy ${table}_select_public on ${table} for select`)
    // Single line for the default so every file generated before `publicClause` existed
    // re-renders byte-identically; a multi-line override indents its own continuation lines.
    out.push(`  to anon, authenticated using (${publicClause});`)
    out.push('')
  } else if (policy.shape === 'B') {
    out.push(`create policy ${table}_select_public on ${table} for select`)
    out.push(`  to anon, authenticated using (`)
    out.push(`    ${policy.parentClause});`)
    out.push('')
  } else {
    // The sentence changes when an anon INSERT is declared, because "no anon policy" would then be
    // false three lines above one. What stays true either way is the half that matters: nothing
    // shape C holds is publicly READABLE.
    out.push(
      policy.anonInsert
        ? `-- No anon SELECT policy. Shape C tables are never publicly readable; this one is written by anon and read by nobody outside the studio.`
        : `-- No anon policy. Shape C tables are never publicly readable.`,
    )
    out.push('')
  }

  // --- policy 1b: the anon write leg ------------------------------------------------------------
  // Emitted only where declared, which today is one table. It sits between the public read leg and
  // the staff legs because that is the order a reader asks the questions in: who may read this
  // without a session, who may write it without one, and then who may do either with one.
  if (policy.anonInsert) {
    for (const line of wrap(`ANON INSERT. ${policy.anonInsert.why}`, 96)) out.push(`-- ${line}`)
    out.push(`create policy ${table}_insert_public on ${table} for insert`)
    out.push(`  to anon, authenticated with check (${policy.anonInsert.withCheck});`)
    out.push('')
  }

  // --- policy 2: staff select, role list derived from the read permission ------------------------
  if (policy.ownerScope) {
    for (const line of wrap(`OWNER SCOPE. ${policy.ownerScope.why}`, 96)) out.push(`-- ${line}`)
  }
  out.push(`create policy ${table}_select_staff on ${table} for select`)
  out.push(`  to authenticated using (${scoped(hasRole(readRoles))});`)
  out.push('')

  if (policy.extraSelectPolicy) {
    for (const line of wrap(policy.extraSelectPolicy.why, 96)) out.push(`-- ${line}`)
    out.push(`create policy ${policy.extraSelectPolicy.name} on ${table} for select`)
    out.push(`  to authenticated using (${policy.extraSelectPolicy.using});`)
    out.push('')
  }

  // --- policies 3: writes ------------------------------------------------------------------------
  if (policy.writePermission) {
    if (policy.writeIsUpdateOnly) {
      for (const line of wrap(`NO INSERT POLICY. ${policy.writeIsUpdateOnly.why}`, 96)) {
        out.push(`-- ${line}`)
      }
      out.push('')
    } else {
      out.push(`create policy ${table}_insert_staff on ${table} for insert`)
      out.push(`  to authenticated with check (${scoped(hasRole(writeRoles))});`)
      out.push('')
    }
    if (policy.writeIsInsertOnly) {
      for (const line of wrap(`NO UPDATE POLICY. ${policy.writeIsInsertOnly.why}`, 96)) {
        out.push(`-- ${line}`)
      }
      out.push('')
    } else {
      out.push(`create policy ${table}_update_staff on ${table} for update`)
      out.push(`  to authenticated using  (${scoped(hasRole(writeRoles))})`)
      out.push(`                with check (${scoped(hasRole(writeRoles))});`)
      out.push('')
    }
  } else {
    out.push(`-- No write policy for authenticated: see the deviation note above.`)
    out.push('')
  }

  // --- policy 4: delete --------------------------------------------------------------------------
  if (policy.deletePermission) {
    out.push(`create policy ${table}_delete_staff on ${table} for delete`)
    out.push(`  to authenticated using (${scoped(hasRole(deleteRoles))});`)
    out.push('')
  }

  return out.join('\n')
}

/** Soft-wrap a comment to keep generated SQL inside the project's line length. */
function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line.length + word.length + 1 > width) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines
}

export function generate(file: string): string {
  const spec = GENERATED[file]
  if (!spec) throw new Error(`${file} is not a generated policy migration`)

  const tables = MANAGED_TABLES.filter((t) => TABLE_POLICY_MAP[t].policiesIn === file)
  if (tables.length === 0) throw new Error(`no table names ${file} in policiesIn`)

  const header = `${spec.title}
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by \`npm run auth:gen-policies\` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. \`npm run auth:check-policies\` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
${spec.preamble}

set search_path = public, extensions;
`

  return `${header}\n${tables.map(policiesFor).join('\n')}`
}

/** Every generated file, keyed by path. */
export function generateAll(): Map<string, string> {
  const out = new Map<string, string>()
  for (const file of Object.keys(GENERATED)) {
    out.set(`supabase/migrations/${file}`, generate(file))
  }
  return out
}

// --- CLI ------------------------------------------------------------------------------------
const check = process.argv.includes('--check')
const files = generateAll()
let failed = false

for (const [path, sql] of files) {
  if (!check) {
    writeFileSync(path, sql)
    console.log(`✓ wrote ${path}`)
    continue
  }

  let committed: string
  try {
    committed = readFileSync(path, 'utf8')
  } catch {
    console.error(`✗ ${path} does not exist. Run: npm run auth:gen-policies`)
    failed = true
    continue
  }

  if (committed !== sql) {
    console.error(
      `\n✗ ${path} is out of date with the permission matrix.\n\n` +
        `  Either lib/auth/permissions.ts or lib/auth/table-permissions.ts changed without the\n` +
        `  migration being regenerated, or the migration was edited by hand. Both are drift\n` +
        `  between the two enforcement layers, which is the failure this check exists to catch.\n\n` +
        `  If this file has ALREADY BEEN APPLIED anywhere, do NOT simply regenerate it: a shipped\n` +
        `  migration must not change. Write a new migration that drops and recreates the affected\n` +
        `  policies, and give the changed tables a new policiesIn.\n\n` +
        `      npm run auth:gen-policies\n\n` +
        `  then review the diff and commit it.\n`,
    )
    failed = true
    continue
  }
  console.log(`✓ ${path} matches the permission matrix`)
}

if (failed) process.exit(1)
