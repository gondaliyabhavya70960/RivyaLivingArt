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
    out.push(`create policy ${table}_insert_staff on ${table} for insert`)
    out.push(`  to authenticated with check (${scoped(hasRole(writeRoles))});`)
    out.push('')
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
