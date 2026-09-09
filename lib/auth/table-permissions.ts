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
   * The anon/authenticated SELECT predicate for a shape-A table, when `status = 'PUBLISHED'` is
   * not the whole story.
   *
   * Three of the Phase 08 tables need one and the reasons are different in kind. `pages` and
   * `page_sections` carry a SCHEDULE, so a published row with a future `publish_at` is not yet
   * public — leaving it out would make scheduling decorative, because the row would be readable
   * the moment its status changed. `pages` additionally requires `path is not null`: the reserved
   * `slug = 'global'` SYSTEM row has no public address, and without this clause it becomes
   * anon-readable the instant it is published. `global_content` has `is_enabled`, which is how an
   * editor turns a CTA off without unpublishing it.
   *
   * Omitting it is the common case and keeps the default.
   */
  publicClause?: string
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
export const PHASE_06_POLICIES = '0031_rls_policies_phase06.sql'
export const PHASE_07_POLICIES = '0041_rls_policies_phase07.sql'
export const PHASE_08_POLICIES = '0051_phase08_cms_rls.sql'
export const PHASE_15_POLICIES = '0131_phase15_product_specs_rls.sql'
export const PHASE_16_POLICIES = '0142_phase16_entity_relations_rls.sql'

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
  // Shape A with a PARENT TEST FOLDED IN, which is what `publicClause` is for. A spec row is a
  // sentence about a product — "Seat height · 450 mm" — and a published sentence attached to an
  // unpublished product is a fact about a piece the site does not admit exists. Both must be
  // PUBLISHED, so the row's own status is not the whole story and the clause says so.
  product_specs: {
    policiesIn: PHASE_15_POLICIES,
    shape: 'A',
    publicClause: `status = 'PUBLISHED'
      and exists (select 1 from products p
                   where p.id = product_specs.product_id and p.status = 'PUBLISHED')`,
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

  // --- Phase 08: the CMS -------------------------------------------------------------------------
  //
  // Six shape-A content tables and one shape-C record. Three carry a `publicClause` because
  // "published" is not the whole condition for them; see the field's own comment.
  //
  // DELETE IS `destructive.execute` (owner/admin), NOT `content.write`. §1.5's RLS-PUBLIC profile
  // fixes the delete leg at owner/admin and every shipped shape-A content table honours it. An
  // editor removes a block from a page by setting `is_visible = false`, which is what that column
  // is for — deleting the row destroys its revision history, and history that an editor can delete
  // is not an audit trail.
  pages: {
    policiesIn: PHASE_08_POLICIES,
    shape: 'A',
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
    publicClause:
      "status = 'PUBLISHED' and path is not null\n      and (publish_at is null or publish_at <= now())\n      and (unpublish_at is null or unpublish_at > now())",
  },
  // The section's OWN window and its page's, both. A published section on an unpublished page must
  // not be readable — otherwise a page scheduled for next week leaks section by section to anyone
  // who queries the table directly, which is exactly what an anon key can do.
  page_sections: {
    policiesIn: PHASE_08_POLICIES,
    shape: 'A',
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
    publicClause:
      "status = 'PUBLISHED' and is_visible\n      and (publish_at is null or publish_at <= now())\n      and (unpublish_at is null or unpublish_at > now())\n      and exists (select 1 from pages p\n                  where p.id = page_sections.page_id\n                    and p.status = 'PUBLISHED' and p.path is not null\n                    and (p.publish_at is null or p.publish_at <= now())\n                    and (p.unpublish_at is null or p.unpublish_at > now()))",
  },
  navigation_items: {
    policiesIn: PHASE_08_POLICIES,
    shape: 'A',
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
  },
  // `is_enabled` is how an editor turns a CTA or an announcement off without unpublishing it —
  // the row keeps its status, its history and its place in the group, and simply stops rendering.
  global_content: {
    policiesIn: PHASE_08_POLICIES,
    shape: 'A',
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
    publicClause: "status = 'PUBLISHED' and is_enabled",
  },
  seo_entries: {
    policiesIn: PHASE_08_POLICIES,
    shape: 'A',
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
  },
  faqs: {
    policiesIn: PHASE_08_POLICIES,
    shape: 'A',
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
  },
  // Shape C, and the deviation is the point of the table.
  content_revisions: {
    policiesIn: PHASE_08_POLICIES,
    shape: 'C',
    readPermission: 'content.read',
    deviation:
      'No write policy for any session role, and no UPDATE or DELETE policy at all. Rows are ' +
      'written solely by write_revision(), a SECURITY DEFINER trigger, so the history cannot be ' +
      'edited by the people it records. A revision an editor can rewrite is not an audit trail, ' +
      'and verification step 6 asserts exactly this by attempting an UPDATE as staff.',
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

  /**
   * `entity_relations` — Phase 16. The general edge: collection ↔ project, article, material or
   * another collection.
   *
   * STAFF-ONLY, WHICH IS A DEVIATION FROM ITS SIBLING AND IS ARGUED RATHER THAN INHERITED.
   * `product_relations` is Shape B with a parent clause testing its source product's status. That
   * works because its source is ALWAYS a product. This table's source is polymorphic — a
   * `source_type` chosen at runtime — and RLS cannot join a table named in a column, so there is no
   * parent clause to write.
   *
   * The alternative was an unconditional anon read. That leaks two things: `note`, which is an
   * editor's sentence about why two things belong together and may describe work not yet published,
   * and the mere EXISTENCE of edges pointing at unpublished projects and drafts. The phase document
   * settles it — "entity_relations is never publicly readable by itself" — and this is that
   * sentence expressed as a policy set.
   *
   * The public route still renders related content: it reads through a repository function that
   * resolves each target against the target table's own policies, so an unpublished project simply
   * yields nothing. That is the same reasoning `product_relations` relies on, applied one layer up.
   */
  entity_relations: {
    policiesIn: PHASE_16_POLICIES,
    shape: 'C',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
    deviation:
      'No anon policy: a polymorphic source cannot be tested by a parent clause, and the row ' +
      'carries an editorial `note` plus the existence of edges to unpublished work. The phase ' +
      'document requires that this table never be publicly readable by itself; the public reads ' +
      "related content through a repository that resolves each target under the target table's " +
      'own policies, so an unpublished target yields nothing.',
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

  // --- Phase 07 ---------------------------------------------------------------------------------
  higgsfield_migration_runs: {
    policiesIn: PHASE_07_POLICIES,
    shape: 'C',
    readPermission: 'media.read',
    deviation:
      'Run record, not content — the same shape and the same reasoning as content_seed_runs. No ' +
      'anon policy, and no authenticated WRITE policy: the migration script connects over ' +
      'DATABASE_URL and bypasses RLS entirely, so granting a session write access here would add ' +
      'reach without adding capability. Read is media.read rather than operations.logs.read ' +
      'because the thing being audited is the media library, and the people who need to ask "did ' +
      'all 250 land" are the six roles that can already see the assets.',
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

  // --- Phase 06 ---------------------------------------------------------------------------------
  media_usages: {
    policiesIn: PHASE_06_POLICIES,
    shape: 'C',
    readPermission: 'media.read',
    writePermission: 'media.write',
    deviation:
      'Reverse index, not content. No anon policy — and that is the interesting decision here, ' +
      'because it might look like one is needed: a public page renders an asset, so surely the ' +
      'binding must be public too? No. The page resolves its media from its own block payload, ' +
      'which already carries the asset id; this table answers the opposite question — "what uses ' +
      'this asset" — which is a Studio question. Exposing it to anon would publish the shape of ' +
      'every unpublished page: which slots exist, how many gallery items a draft has, which ' +
      'entities reference an asset nobody has seen.',
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
