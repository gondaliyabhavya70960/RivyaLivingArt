#!/usr/bin/env node
/**
 * auth:check-rls — read the policies back out of a live database and hold them to the matrix.
 *
 * This is the second of the two drift gates, and it asks a different question from the first.
 * `auth:check-policies` proves the MIGRATION FILE matches lib/auth/permissions.ts. This proves the
 * DATABASE does. Both are needed: a migration can be correct and never applied, and a database can
 * be changed by a hand-run statement that no migration records.
 *
 * It fails when any table in `public`:
 *
 *   1. has row security disabled                     — one forgotten line and the table is public
 *   2. has zero policies                             — reachable only by service role; usually a mistake
 *   3. is missing from lib/auth/table-permissions.ts — nobody decided what governs it
 *   4. carries a staff-select role list that differs from the roles holding its read permission
 *   5. matches none of Shape A, Shape B or a declared deviation
 *   6. references auth.role() in a policy expression — see below
 *
 * Rule 4 is the one this phase exists for. `using (public.is_staff())` copied onto `inquiries` in
 * Phase 20 would let a researcher — who does not hold `inquiries.read` — read every customer name
 * and phone number straight through PostgREST with their own session, never touching
 * requirePermission(). The same copy onto `audit_logs` hands every role the security log. Neither
 * is caught by review; both are caught here.
 *
 * Rule 6 needs its reasoning stated. PostgREST decides which Postgres role a request runs as by
 * verifying the JWT and issuing `set local role <claim>`. The `TO anon` / `TO authenticated`
 * grantee list on a policy is therefore anchored to something PostgREST verified. An
 * `auth.role() = '...'` predicate reads the same claim a second time, from a channel nothing in the
 * database verifies — locally the two can be made to disagree outright, and the grantee list is the
 * half that reflects reality. So policies must gate on the grantee list, never on auth.role().
 */
import { execFileSync } from 'node:child_process'

import { ROLES, rolesWithPermission, type Role } from '../../lib/auth/permissions'
import { TABLE_POLICY_MAP, type ManagedTable } from '../../lib/auth/table-permissions'

const FS = '\x1f'
const RS = '\x1e'

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL is not set. auth:check-rls asserts against a real database:\n' +
      '  npm run db:reset && npm run auth:check-rls',
  )
  process.exit(1)
}

function query(sql: string): string[][] {
  const out = execFileSync(
    'psql',
    [
      url!,
      '--no-psqlrc',
      '--quiet',
      '--tuples-only',
      '--no-align',
      '--field-separator',
      FS,
      '--record-separator',
      RS,
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return out
    .split(RS)
    .map((line) => line.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .map((line) => line.split(FS))
}

const problems: string[] = []

// --- what the database actually has -------------------------------------------------------------

const tables = query(`
  select c.relname, case when c.relrowsecurity then 't' else 'f' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
`)

const policies = query(`
  select tablename, policyname, cmd,
         coalesce(array_to_string(roles, ','), ''),
         coalesce(qual, ''),
         coalesce(with_check, '')
  from pg_policies where schemaname = 'public'
  order by tablename, policyname;
`)

if (tables.length === 0) {
  console.error('No tables found in schema public — has db:reset been run?')
  process.exit(1)
}

type PolicyRow = {
  table: string
  name: string
  cmd: string
  grantees: string
  using: string
  check: string
}
const byTable = new Map<string, PolicyRow[]>()
/**
 * Is the predicate the database re-printed the same rule the map declares?
 *
 * POSTGRES DOES NOT STORE WHAT YOU WROTE. It stores a parse tree and prints it back with its own
 * parentheses, its own casts (`'NEW'::inquiry_status`) and its own spacing, so a literal string
 * comparison fails on a policy nobody has touched. This normalises both sides to the parts that
 * carry meaning — column names, operators and literal values — and compares those as a set, which
 * is strict about WHAT is pinned and forgiving about how the parser chose to print it.
 */
function equivalentPredicate(seen: string, want: string): boolean {
  const normalise = (text: string): string =>
    text
      .toLowerCase()
      .replace(/::[a-z_ ]+/g, '')
      .replace(/[()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const parts = (text: string): string[] =>
    normalise(text)
      .split(' and ')
      .map((p) => p.trim())
      .sort()
  const a = parts(seen)
  const b = parts(want)
  return a.length === b.length && a.every((part, i) => part === b[i])
}

for (const [table, name, cmd, grantees, using, check] of policies) {
  const row = {
    table: table!,
    name: name!,
    cmd: cmd!,
    grantees: grantees!,
    using: using!,
    check: check!,
  }
  if (!byTable.has(row.table)) byTable.set(row.table, [])
  byTable.get(row.table)!.push(row)
}

/** Pull the role names out of `has_role('owner','admin')`, in canonical order. */
function rolesInExpression(expr: string): Role[] | null {
  if (!/has_role/.test(expr)) return null
  const found = new Set<string>()
  for (const match of expr.matchAll(/'([a-z]+)'::user_role/g)) found.add(match[1]!)
  // Some PostgreSQL versions render the array without per-element casts.
  for (const match of expr.matchAll(/'([a-z]+)'(?!::)/g)) {
    if ((ROLES as readonly string[]).includes(match[1]!)) found.add(match[1]!)
  }
  return ROLES.filter((r) => found.has(r))
}

/**
 * THE ONE TABLE IN `public` THAT IS NOT APPLICATION DATA.
 *
 * `schema_migrations` is the migration runner's own bookkeeping. It is created by
 * `scripts/db/migrate.mjs` rather than by a migration — a migration cannot cover the table whose
 * existence lets migrations be tracked — and it carries RLS ON WITH NO POLICY ON PURPOSE, which
 * means nobody: no anon read, no authenticated read, and the runner reaches it as the database
 * owner, bypassing RLS by role attribute.
 *
 * Both rules it would otherwise fail are therefore satisfied in the strictest possible direction.
 * Rule 2 wants at least one policy because a table nothing can reach is usually a mistake; here it
 * is the intent. Rule 3 wants an entry in the permission matrix; there is no permission that
 * governs it, because no session role may touch it at all, and inventing one would put a
 * bookkeeping table in the vocabulary the Studio uses to describe content.
 *
 * It is named here rather than skipped by pattern so that adding a second exemption is a decision
 * somebody has to write down. Rule 1 still applies to it: if row security were ever switched off,
 * the checks below would report it, because the exemption is from the policy rules and not from
 * the one that matters most.
 */
const NOT_APPLICATION_DATA = new Set(['schema_migrations'])

// --- the checks -----------------------------------------------------------------------------------

for (const [table, rlsEnabled] of tables) {
  const name = table!
  const rows = byTable.get(name) ?? []
  const bookkeeping = NOT_APPLICATION_DATA.has(name)

  // 1. RLS on. Asserted from pg_class directly, never inferred from "the query returned nothing" —
  //    a query can return nothing because of a missing GRANT, which is a pass for the wrong reason.
  if (rlsEnabled !== 't') {
    problems.push(`${name}: row security is DISABLED — anon can read it through PostgREST`)
  }

  // 2. At least one policy.
  if (rows.length === 0 && !bookkeeping) {
    problems.push(
      `${name}: RLS is on but there are no policies — nothing but the service role can reach it`,
    )
  }

  // 3. Known to the map.
  if (bookkeeping) continue
  if (!(name in TABLE_POLICY_MAP)) {
    problems.push(
      `${name}: missing from lib/auth/table-permissions.ts. Every table in public must declare ` +
        `which permission governs it and which policy shape it takes.`,
    )
    continue
  }

  const declared = TABLE_POLICY_MAP[name as ManagedTable]
  const expectedReadRoles = rolesWithPermission(declared.readPermission)

  // 5. Shape.
  const anonPolicies = rows.filter((r) => r.grantees.includes('anon'))
  if (declared.shape === 'C') {
    if (!declared.deviation || declared.deviation.trim().length === 0) {
      problems.push(`${name}: shape C requires a stated deviation reason, and it is empty`)
    }
    /*
     * A DECLARED ANON INSERT IS THE ONE ANON POLICY A SHAPE-C TABLE MAY CARRY, and it is still not
     * permission to be read. `inquiries` is written by a visitor with no account, so the policy is
     * the whole guard on that write — but the check below stays absolute in the direction that
     * matters: any anon policy that can SELECT is a failure whether or not an insert was declared.
     * A stranger writing an enquiry and a stranger reading the customer list are not the same
     * concession, and one must never become a licence for the other.
     */
    const anonReads = anonPolicies.filter((p) => p.cmd === 'SELECT' || p.cmd === 'ALL')
    const anonWrites = anonPolicies.filter((p) => p.cmd !== 'SELECT' && p.cmd !== 'ALL')

    if (anonReads.length > 0) {
      problems.push(
        `${name}: shape C must have NO anon read policy, found ${anonReads.map((p) => p.name).join(', ')}`,
      )
    }
    if (declared.anonInsert) {
      const inserts = anonWrites.filter((p) => p.cmd === 'INSERT')
      if (inserts.length !== 1) {
        problems.push(
          `${name}: declares an anon insert and has ${inserts.length} anon INSERT policies on the database`,
        )
      }
      for (const policy of inserts) {
        // The predicate is the guard, so it is compared rather than merely counted. Whitespace is
        // normalised because Postgres re-prints an expression its own way.
        const seen = policy.check.replace(/\s+/g, ' ').trim()
        const want = declared.anonInsert.withCheck.replace(/\s+/g, ' ').trim()
        if (!equivalentPredicate(seen, want)) {
          problems.push(
            `${name}.${policy.name}: anon insert check has drifted from table-permissions.ts\n` +
              `        declared: ${want}\n` +
              `        database: ${seen}`,
          )
        }
      }
      if (anonWrites.some((p) => p.cmd !== 'INSERT')) {
        problems.push(
          `${name}: an anon policy may only INSERT here, found ` +
            anonWrites
              .filter((p) => p.cmd !== 'INSERT')
              .map((p) => `${p.name} (${p.cmd})`)
              .join(', '),
        )
      }
    } else if (anonWrites.length > 0) {
      problems.push(
        `${name}: shape C must have NO anon policy, found ${anonWrites.map((p) => p.name).join(', ')}`,
      )
    }
  } else if (anonPolicies.length === 0) {
    problems.push(`${name}: shape ${declared.shape} requires an anon select policy and has none`)
  } else {
    const publicPolicy = anonPolicies[0]!
    if (declared.shape === 'A' && !/status/.test(publicPolicy.using)) {
      problems.push(`${name}: shape A anon policy does not test status — ${publicPolicy.using}`)
    }
    if (declared.shape === 'B' && !/exists/i.test(publicPolicy.using)) {
      problems.push(
        `${name}: shape B anon policy must derive visibility from its parent via EXISTS — ${publicPolicy.using}`,
      )
    }
  }

  // 4. THE RULE: staff-select role list == roles holding the read permission.
  const staffSelects = rows.filter(
    (r) =>
      (r.cmd === 'SELECT' || r.cmd === 'ALL') &&
      !r.grantees.includes('anon') &&
      r.name !== declared.extraSelectPolicy?.name,
  )

  if (staffSelects.length === 0) {
    problems.push(`${name}: no staff select policy — signed-in staff cannot read it at all`)
  }

  for (const policy of staffSelects) {
    const actual = rolesInExpression(policy.using)
    if (actual === null) {
      // is_staff() / current_staff_role() is not null is the shorthand. It is only equivalent to
      // an explicit list when every role holds the read permission.
      if (/is_staff|current_staff_role/.test(policy.using)) {
        if (expectedReadRoles.length !== ROLES.length) {
          problems.push(
            `${name}.${policy.name}: uses the "any active staff" shorthand, but ${declared.readPermission} ` +
              `is held by only ${expectedReadRoles.join(', ')}. The shorthand would grant ` +
              `${ROLES.filter((r) => !expectedReadRoles.includes(r)).join(', ')} access they do not have. ` +
              `Write the role list out.`,
          )
        }
      } else {
        problems.push(
          `${name}.${policy.name}: staff select does not gate on a role — ${policy.using}`,
        )
      }
      continue
    }
    const same =
      actual.length === expectedReadRoles.length &&
      actual.every((r, i) => r === expectedReadRoles[i])
    if (!same) {
      problems.push(
        `${name}.${policy.name}: staff-select role list has drifted from the matrix.\n` +
          `        policy says:  ${actual.join(', ') || '(none)'}\n` +
          `        ${declared.readPermission} is held by: ${expectedReadRoles.join(', ')}`,
      )
    }
  }

  // 6. No policy may gate on auth.role().
  for (const policy of rows) {
    if (/auth\.role\(\)/.test(policy.using) || /auth\.role\(\)/.test(policy.check)) {
      problems.push(
        `${name}.${policy.name}: gates on auth.role(). Use the TO grantee list instead — it is the ` +
          `channel PostgREST actually verifies.`,
      )
    }
  }
}

// A table declared in the map that does not exist is the reverse drift, and just as wrong.
for (const declaredName of Object.keys(TABLE_POLICY_MAP)) {
  if (!tables.some(([t]) => t === declaredName)) {
    problems.push(
      `${declaredName}: declared in table-permissions.ts but does not exist in the database`,
    )
  }
}

// --- report ---------------------------------------------------------------------------------------
if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} RLS problem(s):\n`)
  for (const problem of problems) console.error(`    ${problem}`)
  console.error('')
  process.exit(1)
}

const policyCount = policies.length
console.log(
  `✓ RLS: ${tables.length} tables, all with row security on and ${policyCount} policies total; ` +
    `every staff-select role list matches the permission matrix`,
)
