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
  TABLE_POLICY_MAP,
  type ManagedTable,
} from '../../lib/auth/table-permissions'

const OUT = 'supabase/migrations/0011_rls_policies.sql'

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
  out.push(`create policy ${table}_select_staff on ${table} for select`)
  out.push(`  to authenticated using (${hasRole(readRoles)});`)
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
    out.push(`  to authenticated with check (${hasRole(writeRoles)});`)
    out.push('')
    out.push(`create policy ${table}_update_staff on ${table} for update`)
    out.push(`  to authenticated using  (${hasRole(writeRoles)})`)
    out.push(`                with check (${hasRole(writeRoles)});`)
    out.push('')
  } else {
    out.push(`-- No write policy for authenticated: see the deviation note above.`)
    out.push('')
  }

  // --- policy 4: delete --------------------------------------------------------------------------
  if (policy.deletePermission) {
    out.push(`create policy ${table}_delete_staff on ${table} for delete`)
    out.push(`  to authenticated using (${hasRole(deleteRoles)});`)
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

export function generate(): string {
  // audit_logs is created in 0012, so its policies live there, not here.
  const tables = MANAGED_TABLES.filter((t) => t !== 'audit_logs')

  const header = `-- 0011_rls_policies.sql — Phase 04
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by \`npm run auth:gen-policies\` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. \`npm run auth:check-policies\` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Every staff-select role list below is the set of roles holding that table's *.read permission.
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
-- The service role bypasses RLS by role attribute, and that is the designed escape hatch.

set search_path = public, extensions;
`

  return `${header}\n${tables.map(policiesFor).join('\n')}`
}

// --- CLI ------------------------------------------------------------------------------------
const check = process.argv.includes('--check')
const sql = generate()

if (check) {
  let committed: string
  try {
    committed = readFileSync(OUT, 'utf8')
  } catch {
    console.error(`✗ ${OUT} does not exist. Run: npm run auth:gen-policies`)
    process.exit(1)
  }
  if (committed !== sql) {
    console.error(
      `\n✗ ${OUT} is out of date with the permission matrix.\n\n` +
        `  Either lib/auth/permissions.ts or lib/auth/table-permissions.ts changed without the\n` +
        `  migration being regenerated, or the migration was edited by hand. Both are drift\n` +
        `  between the two enforcement layers, which is the failure this check exists to catch.\n\n` +
        `      npm run auth:gen-policies\n\n` +
        `  then review the diff and commit it.\n`,
    )
    process.exit(1)
  }
  console.log(`✓ ${OUT} matches the permission matrix`)
} else {
  writeFileSync(OUT, sql)
  console.log(`✓ wrote ${OUT}`)
}
