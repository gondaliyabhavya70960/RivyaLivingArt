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
    out.push(`create policy ${table}_select_public on ${table} for select`)
    out.push(`  to anon, authenticated using (status = 'PUBLISHED');`)
    out.push('')
  } else if (policy.shape === 'B') {
    out.push(`create policy ${table}_select_public on ${table} for select`)
    out.push(`  to anon, authenticated using (`)
    out.push(`    ${policy.parentClause});`)
    out.push('')
  } else {
    out.push(`-- No anon policy. Shape C tables are never publicly readable.`)
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
    out.push(`create policy ${table}_update_staff on ${table} for update`)
    out.push(`  to authenticated using  (${scoped(hasRole(writeRoles))})`)
    out.push(`                with check (${scoped(hasRole(writeRoles))});`)
    out.push('')
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
