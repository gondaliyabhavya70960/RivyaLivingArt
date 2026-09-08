import type { Permission, Role } from './permissions'

/**
 * Which permission governs reads and writes on each table in `public`, and which policy shape the
 * table takes.
 *
 * THIS FILE IS WHY THE TWO ENFORCEMENT LAYERS CANNOT DISAGREE. It is declared once here;
 * scripts/auth/gen-role-sql.ts emits the policy role lists from it, and scripts/auth/check-rls.ts
 * reads pg_policies back and fails when a policy's role list differs from the roles holding that
 * table's read permission, or when a table in `public` is missing from this map entirely.
 *
 * The rule it enforces, in one line: **a table's staff-select role set must equal the set of roles
 * holding that table's `*.read` permission.**
 *
 * Without that rule the pattern is not merely loose, it is dangerous. `using (is_staff())` copied
 * onto `inquiries` in Phase 20 would let a researcher — denied `inquiries.read` — read every
 * customer name, phone number and email straight through PostgREST with their own session, never
 * touching requirePermission(). The same copy onto `audit_logs` hands every role the security log.
 *
 * EVERY NEW TABLE MUST BE ADDED HERE. check-rls.ts fails on a table it does not know, which is
 * deliberate: the failure mode of forgetting is a table with no considered policy, and the failure
 * mode of remembering is thirty seconds of typing.
 */

/**
 * A — content table. Has its own `status`, so anon sees `status = 'PUBLISHED'`.
 * B — join table. No `status` of its own; anon visibility is derived from its parent rows.
 * C — staff-only. No anon policy at all. Every C entry is a declared deviation and must say why.
 */
export type PolicyShape = 'A' | 'B' | 'C'

export type TablePolicy = {
  shape: PolicyShape
  /** Governs who may SELECT as staff. The staff-select policy's role list is generated from this. */
  readPermission: Permission
  /** Governs INSERT and UPDATE. Absent means no `authenticated` write policy at all. */
  writePermission?: Permission
  /** Governs DELETE. Absent means no delete policy — nobody may delete through an ordinary session. */
  deletePermission?: Permission
  /**
   * Shape B only: the SQL predicate making a join row public. Written out per table rather than
   * generated, because which parents must be published is a judgement, not a pattern.
   */
  parentClause?: string
  /**
   * Shape C only, and required there: why this table deviates. A deviation without a stated reason
   * is indistinguishable from an oversight, so check-rls.ts requires the string to be non-empty.
   */
  deviation?: string
  /**
   * Roles allowed to SELECT beyond those from readPermission, with the predicate that admits them.
   * Exactly one table needs this and it is not a general escape hatch — see staff_profiles.
   */
  extraSelectPolicy?: { name: string; using: string; why: string }
  /**
   * A predicate ANDed into EVERY generated policy for this table, narrowing "which staff" to
   * "which row". `extraSelectPolicy` widens access; this narrows it, and the two are not
   * interchangeable — a table whose rows belong to individual people needs the narrowing on the
   * write policies too, where an extra SELECT leg would do nothing.
   */
  ownerScope?: { clause: string; why: string }
  /**
   * The migration file that defines this table's policies.
   *
   * Policy migrations are GENERATED, and a generated file that grows as tables are added would be
   * rewritten by every later phase — which `db:migrate` correctly refuses, because a migration
   * edited after it was applied means the database and the repository disagree while every run
   * reports "0 pending". So each phase's policies get their own file, and each file's table set is
   * fixed forever once shipped.
   *
   * A file the generator does not own (`0012_audit_logs.sql`) is hand-written and skipped here.
   * `check-rls.ts` still verifies its result against the live database, which is the check that
   * actually matters.
   */
  policiesIn: string
}

/** Generated policy migrations. One per phase that introduces tables; never re-opened. */
export const PHASE_04_POLICIES = '0011_rls_policies.sql'
export const PHASE_05_POLICIES = '0021_rls_policies_phase05.sql'

export const TABLE_POLICIES = {
  // --- Shape A: content tables ------------------------------------------------------------------
  categories: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'A',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },
  collections: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'A',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },
  materials: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'A',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },
  products: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'A',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },
  // media.delete rather than destructive.execute — the matrix gives media its own delete
  // permission, and it happens to hold the same two roles. Naming the specific one keeps the
  // policy honest if that ever stops being true.
  media_assets: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'A',
    readPermission: 'media.read',
    writePermission: 'media.write',
    deletePermission: 'media.delete',
  },

  // --- Shape B: join tables ---------------------------------------------------------------------
  // A join row carries no status of its own. Shape A's anon policy cannot be applied — the
  // migration would fail with `column "status" does not exist` — and simply omitting it is worse:
  // anon would lose select on product_media and a published product's gallery would render empty.
  //
  // BOTH parents must be published on the two two-parent tables. The phase document requires it per
  // table; DATA_MODEL §6 generalised the single-parent product_media rule across all three, which
  // would leak the existence and id of an unannounced DRAFT collection to anonymous visitors
  // through a published product. Resolved in favour of the stricter reading — see amendment A5·a.
  product_collections: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'B',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
    parentClause: `exists (select 1 from products p
             where p.id = product_collections.product_id and p.status = 'PUBLISHED')
    and exists (select 1 from collections c
             where c.id = product_collections.collection_id and c.status = 'PUBLISHED')`,
  },
  product_materials: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'B',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
    parentClause: `exists (select 1 from products p
             where p.id = product_materials.product_id and p.status = 'PUBLISHED')
    and exists (select 1 from materials m
             where m.id = product_materials.material_id and m.status = 'PUBLISHED')`,
  },
  // Single parent BY DESIGN. The asset itself is filtered by media_assets' own Shape A policy when
  // the join is resolved, so an unpublished asset drops out of the gallery rather than leaking.
  // Adding a media_assets leg here would be redundant, and would hide that layering from a reader.
  product_media: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'B',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
    parentClause: `exists (select 1 from products p
             where p.id = product_media.product_id and p.status = 'PUBLISHED')`,
  },
  // Source product only. target_type + target_id is a polymorphic edge and RLS cannot join a table
  // chosen at runtime. That is safe rather than leaky: the row exposes a type name and a uuid, and
  // resolving that uuid goes through the target table's own policies, which return nothing for an
  // unpublished target.
  product_relations: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'B',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
    parentClause: `exists (select 1 from products p
             where p.id = product_relations.source_product_id and p.status = 'PUBLISHED')`,
  },

  // --- Shape C: staff-only, each a declared deviation --------------------------------------------
  staff_profiles: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'C',
    readPermission: 'system.users.manage',
    writePermission: 'system.users.manage',
    deviation:
      'No anon policy: staff identity is never public. Carries an extra self-select leg that is ' +
      'by construction not derivable from any *.read permission, so it is declared rather than ' +
      'generated. This is the table current_staff_role() reads, so its policies must not recurse.',
    extraSelectPolicy: {
      name: 'staff_profiles_select_self',
      using: 'user_id = auth.uid()',
      why:
        'A staff member must be able to read their own row — the Studio shell shows their name and ' +
        'role. Written as a bare uid comparison rather than through has_role() so it cannot recurse ' +
        'into the very table the role lookup reads.',
    },
  },
  audit_logs: {
    policiesIn: '0012_audit_logs.sql',
    shape: 'C',
    readPermission: 'operations.audit.read',
    // No writePermission, deliberately. An `authenticated` insert policy would let any signed-in
    // staff member forge entries in the security log — including entries implicating someone else.
    // writeAudit() goes through the service-role client instead, which is the only writer.
    // DATA_MODEL §1.5 RLS-APPEND already specifies "insert by trigger or service role"; the phase
    // document's revoke line left insert ambiguous. Resolved to service-role-only: amendment A5·b.
    deviation:
      'Append-only security log. No anon policy, no authenticated write policy of any kind, and ' +
      'update/delete are revoked outright so no session can rewrite history. Only the service role ' +
      'writes, via lib/auth/audit.ts.',
  },
  content_seed_runs: {
    policiesIn: PHASE_04_POLICIES,
    shape: 'C',
    readPermission: 'operations.logs.read',
    deviation:
      'Run record, not content. No anon policy and no authenticated write policy: the seed runner ' +
      'connects over DATABASE_URL and bypasses RLS entirely, so granting a session write access ' +
      'here would add reach without adding capability. DATA_MODEL classifies it RLS-SERVICE.',
  },

  // --- Phase 05 ---------------------------------------------------------------------------------
  activity_events: {
    policiesIn: PHASE_05_POLICIES,
    shape: 'C',
    readPermission: 'activity.read',
    // No writePermission. The feed is written by logActivity() through the service-role client,
    // for the same reason as audit_logs: a signed-in staff member who can insert here can write
    // "editor published X" naming somebody else, and the feed is the record people actually read.
    deviation:
      'Append-only activity feed. No anon policy — an internal record of who changed what is ' +
      'never public — and no authenticated write policy: only the service role inserts, through ' +
      'lib/logging/activity.ts. Update and delete are revoked outright, so a session cannot ' +
      'rewrite the feed even if a policy is added later by mistake.',
  },
  studio_preferences: {
    policiesIn: PHASE_05_POLICIES,
    shape: 'C',
    readPermission: 'studio.access',
    writePermission: 'studio.access',
    deviation:
      'Per-user Studio chrome state, not content. No anon policy. Every role may read and write ' +
      'it, but ONLY their own row — see ownerScope, which is what makes "every role" safe here.',
    ownerScope: {
      clause: 'user_id = (select auth.uid())',
      why:
        'Both permissions above are held by all six roles, so without this narrowing any staff ' +
        "member could read and overwrite everyone else's sidebar state and pinned routes. The " +
        'scope is what carries the security, not the permission. Wrapped in a sub-select so the ' +
        'planner evaluates auth.uid() once per statement rather than once per row.',
    },
  },
} as const satisfies Record<string, TablePolicy>

export type ManagedTable = keyof typeof TABLE_POLICIES

export const MANAGED_TABLES = Object.keys(TABLE_POLICIES) as ManagedTable[]

/**
 * The same map, widened to TablePolicy.
 *
 * TABLE_POLICIES above is `as const satisfies`, which keeps the KEYS literal — that is what makes
 * ManagedTable a union of real table names rather than `string`. The cost is that each entry's
 * type is its own literal shape, so an entry without `writePermission` genuinely has no such
 * property and consumers cannot read it uniformly. This view restores the uniform shape without
 * giving up the literal keys.
 */
export const TABLE_POLICY_MAP: Record<ManagedTable, TablePolicy> = TABLE_POLICIES

export function tablePolicy(table: ManagedTable): TablePolicy {
  return TABLE_POLICY_MAP[table]
}

export type { Role }
