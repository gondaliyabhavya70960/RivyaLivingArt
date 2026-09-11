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
   * The write permission covers INSERT and NOTHING ELSE, because the table is append-only.
   *
   * `inquiry_events` is the case: a trigger refuses UPDATE and DELETE outright, so an update policy
   * would describe a path the database will not take. Shipping one anyway is not harmless — a
   * generated file is read as a statement of what is possible, and a dead policy tells the next
   * reader that a session can edit the timeline.
   */
  writeIsInsertOnly?: { why: string }
  /**
   * The write permission covers UPDATE and NOTHING ELSE, because nobody with a session may CREATE
   * a row of this kind — only change one the pipeline already wrote.
   *
   * `research_validation_issues` is the case, and it is the mirror image of `inquiry_events`. An
   * issue is a FINDING: it is raised by `lib/scraper/validation/rules.ts` from the evidence, and a
   * researcher's part in it is to DISMISS one with a reason. An insert policy would let a member of
   * staff raise an `ERROR` by hand — and an `ERROR` is what stops a row being promoted, so forging
   * one is a way to quietly hold rows back with nothing in the pipeline log saying why.
   */
  writeIsUpdateOnly?: { why: string }
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
   * An `anon` INSERT policy, with the `with check` that constrains what a stranger may write.
   *
   * ONE TABLE NEEDS THIS AND IT IS THE ONE THE WHOLE SITE EXISTS TO FILL. `inquiries` is written by
   * a visitor who has no account — D1 forbids giving them one — so the policy IS the guard: there is
   * no session to check and no permission to hold. The predicate is what stops a crafted payload
   * arriving pre-triaged, pre-assigned, or claiming to have been edited by a member of staff.
   *
   * It is deliberately NOT a shape. A shape describes how a table is READ, and this table is read
   * by nobody outside the studio: `inquiries` is shape C with an anon insert bolted on, which is
   * exactly what it is, rather than a fourth shape implying a family that has one member.
   */
  anonInsert?: { withCheck: string; why: string }
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
export const PHASE_17_POLICIES = '0151_phase17_portfolio_rls.sql'
export const PHASE_18_POLICIES = '0161_phase18_journal_rls.sql'
export const PHASE_19_POLICIES = '0172_phase19_rls.sql'
export const PHASE_19_LIMIT_POLICIES = '0183_phase19_rate_limit_rls.sql'
export const PHASE_20_POLICIES = '0191_phase20_inquiries_rls.sql'
export const PHASE_21_POLICIES = '0195_phase21_model_rls.sql'
export const PHASE_22_POLICIES = '0201_phase22_merchandising_rls.sql'

/**
 * Phase 23 needs TWO generated files, not one, and the reason is mechanical rather than editorial.
 * A generated policy file is rewritten whole on every `auth:gen-policies` run, so it cannot also
 * hold the DDL that creates its tables — and `0213` creates the relation tables. The search
 * policies therefore sit at `0212`, after `0210`/`0211` create the index, and the relation
 * policies at `0214`, after `0213` creates the edges. Phase 19 set the precedent with `0172` and
 * `0183`. `0214` is recorded in DATA_MODEL §12 alongside the phase document's own `0210`–`0213`.
 */
export const PHASE_23_SEARCH_POLICIES = '0212_phase23_search_rls.sql'
export const PHASE_23_RELATION_POLICIES = '0214_phase23_relations_rls.sql'
export const PHASE_24_POLICIES = '0221_phase24_bulk_rls.sql'
export const PHASE_25_POLICIES = '0233_phase25_research_rls.sql'
export const PHASE_26_POLICIES = '0241_phase26_source_config_rls.sql'
export const PHASE_27_POLICIES = '0251_phase27_extraction_rls.sql'
export const PHASE_28_POLICIES = '0261_phase28_normalization_rls.sql'
export const PHASE_29_POLICIES = '0271_phase29_changes_rls.sql'

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

  /**
   * `portfolio_projects` — Phase 17. Delivered work, and the most consequential public read on the
   * site: every row is a claim that Rivya made something for someone.
   *
   * THE PUBLIC CLAUSE IS `status = 'PUBLISHED'` AND NOTHING ELSE, and that is not laxness. The two
   * gates that matter — owner verification, and consent from anyone the row names — are enforced
   * by `enforce_project_evidence_gate()` at the moment of publication, so a row cannot REACH
   * PUBLISHED without satisfying them. Re-testing `owner_verification` here would be a second copy
   * of the rule that could drift from the trigger, and the trigger is the one that cannot be
   * bypassed.
   */
  portfolio_projects: {
    policiesIn: PHASE_17_POLICIES,
    shape: 'A',
    publicClause: `status = 'PUBLISHED'`,
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
  },

  /**
   * `portfolio_project_media` — Phase 17. Shape A with a parent clause, matching `product_specs`:
   * the pictures of an unpublished project must not be readable, or the existence and contents of
   * unannounced work leak through the join.
   */
  portfolio_project_media: {
    policiesIn: PHASE_17_POLICIES,
    shape: 'A',
    publicClause: `exists (select 1 from portfolio_projects p
                   where p.id = portfolio_project_media.project_id and p.status = 'PUBLISHED')`,
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
  },

  /**
   * `testimonials` — Phase 17. Same shape and the same reasoning as `portfolio_projects`: the
   * consent gate lives in `enforce_testimonial_evidence_gate()`, so PUBLISHED already implies a
   * granted consent for any row that names someone.
   */
  /**
   * `journal_categories` — Phase 18. Taxonomy, and PUBLISHED for the nine seeded ones.
   *
   * THE PUBLIC CLAUSE IS THE ORDINARY ONE. A category asserts nothing about the business beyond
   * "the studio writes about this", and `/journal/category/<slug>` cannot render at all if `anon`
   * cannot read the row. Categories therefore seed PUBLISHED where articles seed DRAFT — the
   * difference is deliberate and is explained in `0160`.
   */
  journal_categories: {
    policiesIn: PHASE_18_POLICIES,
    shape: 'A',
    publicClause: `status = 'PUBLISHED'`,
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
  },

  /**
   * `journal_articles` — Phase 18.
   *
   * `published_at <= now()` IS PART OF THE PUBLIC CLAUSE, and it is the only content table where a
   * date gates the read. Scheduling matters here in a way it does not for a product or a project: an
   * article is written, approved and set to appear on a morning, and a row that is PUBLISHED with a
   * future `published_at` must not be readable before that morning. The Phase 08 scheduler flips
   * status on a cron, and a cron that runs late would otherwise publish early.
   */
  journal_articles: {
    policiesIn: PHASE_18_POLICIES,
    shape: 'A',
    publicClause: `status = 'PUBLISHED' and published_at <= now()`,
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
  },

  /**
   * `journal_article_categories` — Phase 18. Shape A with a parent clause, matching
   * `portfolio_project_media`: which categories an unpublished article belongs to is a fact about
   * unpublished editorial, and it leaks through the join if the edge is readable on its own.
   */
  journal_article_categories: {
    policiesIn: PHASE_18_POLICIES,
    shape: 'A',
    publicClause: `exists (select 1 from journal_articles a
                   where a.id = journal_article_categories.article_id
                     and a.status = 'PUBLISHED' and a.published_at <= now())`,
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
  },

  testimonials: {
    policiesIn: PHASE_17_POLICIES,
    shape: 'A',
    publicClause: `status = 'PUBLISHED'`,
    readPermission: 'content.read',
    writePermission: 'content.write',
    deletePermission: 'destructive.execute',
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

  // --- Phase 19 ---------------------------------------------------------------------------------
  /**
   * `customization_forms` — Phase 19.
   *
   * SHAPE A WITH THE THIN CLAUSE. A form definition is public the moment it is published, because
   * the configurator that renders it is served to anonymous visitors; there is no second condition
   * to add. What keeps an unfinished template off the site is `enforce_form_publishable()`, which
   * refuses PUBLISHED for a form with no contact step, no way to reply on it, or a choice field
   * with no choices — enforced at the write rather than re-tested here where it could drift.
   *
   * CATALOGUE PERMISSIONS RATHER THAN CONTENT ONES, and that is a considered split. The form lives
   * at `/studio/catalog/customization-forms`, is bound to products and categories, and is edited by
   * the same person who decides what a product is called. `content.write` would have given the
   * editor the form and denied it to the merchandiser, which is the wrong way round for a surface
   * whose whole job is to ask about a product.
   */
  customization_forms: {
    policiesIn: PHASE_19_POLICIES,
    shape: 'A',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },

  /**
   * `customization_form_steps` and `customization_form_fields` — Phase 19.
   *
   * BOTH CARRY A PARENT TEST, matching `product_specs`, `portfolio_project_media` and
   * `journal_article_categories`. A step row is a question — "Preferred Shape", "Item / Flower
   * Type" — and a published step hanging off an unpublished form would publish the questions of a
   * brief the site does not yet offer. Worse, it is a legible plan: reading the steps and fields of
   * an unpublished PRESERVATION template tells a competitor exactly which service is being
   * prepared, without the form row ever being readable.
   *
   * The field's test goes through its FORM rather than through its step, even though a field has a
   * step. Both are correct; the form is the shorter path, and the composite foreign key
   * `(step_id, form_id)` already guarantees a field's step belongs to the same form, so the two
   * predicates cannot disagree.
   */
  customization_form_steps: {
    policiesIn: PHASE_19_POLICIES,
    shape: 'A',
    publicClause: `exists (select 1 from customization_forms f
                   where f.id = customization_form_steps.form_id and f.status = 'PUBLISHED')`,
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },
  customization_form_fields: {
    policiesIn: PHASE_19_POLICIES,
    shape: 'A',
    publicClause: `exists (select 1 from customization_forms f
                   where f.id = customization_form_fields.form_id and f.status = 'PUBLISHED')`,
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },

  /**
   * `product_customization_forms` — Phase 19. Shape B: a join with no status of its own.
   *
   * THE PARENT CLAUSE TESTS BOTH ENDS, and the second half is the one that matters. Requiring the
   * FORM to be published is obvious. Requiring the PRODUCT or CATEGORY to be published is what
   * stops the binding table from being a list of unreleased products: a row naming a draft product
   * is readable by anon otherwise, and `select product_id from product_customization_forms` becomes
   * an inventory of everything the studio is about to launch.
   */
  product_customization_forms: {
    policiesIn: PHASE_19_POLICIES,
    shape: 'B',
    parentClause: `exists (select 1 from customization_forms f
      where f.id = product_customization_forms.form_id and f.status = 'PUBLISHED')
    and (
      product_customization_forms.product_id is null
      or exists (select 1 from products p
          where p.id = product_customization_forms.product_id and p.status = 'PUBLISHED')
    )
    and (
      product_customization_forms.category_id is null
      or exists (select 1 from categories c
          where c.id = product_customization_forms.category_id and c.status = 'PUBLISHED')
    )`,
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },

  /**
   * `feature_flags` — Phase 19.
   *
   * READ IS `studio.access`, WHICH EVERY ROLE HOLDS, and that is the whole point rather than a
   * loose default: the register of what is switched on is how anyone in the Studio finds out why a
   * surface is missing. Hiding it behind the write permission — STUDIO_GUIDE §2.3 considered and
   * rejected exactly that — would leave four of the six roles looking at a site whose behaviour
   * they cannot account for.
   *
   * WRITE IS `system.flags.write`: owner and admin. See amendment A17 and the header of migration
   * 0171 for why the phase document's "owner-only" did not win.
   */
  feature_flags: {
    policiesIn: PHASE_19_POLICIES,
    shape: 'C',
    readPermission: 'studio.access',
    writePermission: 'system.flags.write',
    deviation:
      'No anon policy, and no public read of any kind. A flag is evaluated SERVER-SIDE and the ' +
      'browser is never told a flag exists — it is told markup that is present or absent. ' +
      'Publishing this table would hand every visitor the list of features being prepared, ' +
      'their key names, and the moment each one was switched: an unreleased-roadmap feed with a ' +
      'timestamp. Nothing public needs it, because nothing public reads it.',
  },

  /**
   * `rate_limit_buckets` — Phase 19 `0182`, early on Phase 41's behalf.
   *
   * SHAPE C WITH A READ AND NO WRITE, which is the same shape `higgsfield_migration_runs` takes and
   * for the same reason: the only writer is a SECURITY DEFINER function granted to `service_role`,
   * so an INSERT policy would describe a path nothing uses and would suggest to a later reader that
   * a session can increment a counter. None can.
   *
   * THE READ IS `operations.logs.read` — owner and admin — rather than `studio.access`. A counter
   * keyed on a hashed visitor address is operational telemetry, not something a viewer needs, and
   * Phase 41's security surface is where it will be shown. Narrower than the table's sensitivity
   * strictly requires, deliberately: the key is a hash and reveals no address, but the SHAPE of the
   * data — how many anonymous visitors hit an endpoint and when — is still the kind of thing that
   * belongs with the audit log rather than beside the content editor.
   */
  rate_limit_buckets: {
    policiesIn: PHASE_19_LIMIT_POLICIES,
    shape: 'C',
    readPermission: 'operations.logs.read',
    deviation:
      'No anon policy and no write policy for any session role. Rows are written solely by ' +
      'consume_rate_limit(), a SECURITY DEFINER function granted to service_role, because the ' +
      'bucket key is derived from the caller and a session able to pass its own key could ' +
      "exhaust somebody else's window. Nothing public reads it: a visitor learning how close " +
      'they are to a rate limit learns how to pace an attack.',
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

  /**
   * `inquiries` — Phase 20. Shape C with an `anon` INSERT, and it is the only table on the site
   * that a stranger may write.
   *
   * NO ANON SELECT, EVER. An enquiry carries a name, a phone number, a city and whatever a visitor
   * chose to say about their home. One `using (true)` here and the whole customer list is a GET
   * away through PostgREST — no session, no key beyond the publishable one that ships in the
   * browser. The absence of a select policy is the single most load-bearing line in this file.
   *
   * THE INSERT POLICY IS THE ONLY GUARD ON THE WRITE, because there is no session to check: D1
   * forbids customer accounts, so the person filling in the form is nobody. The `with check` is
   * therefore doing the work `requirePermission` does everywhere else, and it pins the three
   * columns a crafted payload would otherwise use to arrive pre-triaged, pre-assigned, or bearing a
   * staff member's id as its editor.
   *
   * READ IS `inquiries.read`, WHICH THE RESEARCHER DOES NOT HOLD. That is this file's own header
   * example, written before the table existed: `using (is_staff())` copied onto this table would
   * hand every customer's phone number to a role whose entire remit is competitor research.
   */
  inquiries: {
    policiesIn: PHASE_20_POLICIES,
    shape: 'C',
    readPermission: 'inquiries.read',
    writePermission: 'inquiries.write',
    anonInsert: {
      withCheck:
        "pipeline_status = 'NEW' and assigned_to is null and updated_by is null and whatsapp_state = 'NOT_SENT'",
      why:
        'The public write path. A visitor has no account, so this predicate is the whole guard: it ' +
        'pins the enquiry to the start of the pipeline, unassigned, with no claimed editor and no ' +
        'claimed handoff. `reference_code` is not pinned here because the BEFORE trigger overwrites ' +
        'it, which is stronger than a check — a caller cannot supply one at all.',
    },
    deviation:
      'No anon SELECT of any kind. An enquiry carries a name, a phone number and a city; a public ' +
      'read policy would publish the customer list through PostgREST with the publishable key that ' +
      'ships in every browser. anon INSERTS and never reads back — not even the row it just wrote.',
  },

  /**
   * `inquiry_attachments` — Phase 20. Shape C, staff-read, and NO anon insert despite the phase
   * document naming one.
   *
   * THE REASON IS MECHANICAL. An attachment references `media_assets`, and `anon` cannot create a
   * `media_assets` row — Phase 06's policies do not admit it and should not, because that table is
   * the studio's library. An anon insert policy here would describe a path with no way to satisfy
   * its own foreign key. `attach_inquiry_references()` is SECURITY DEFINER instead, checks the
   * enquiry is one created in the last ten minutes, and refuses any `public_id` outside the folder
   * `upload-sign` signs. Recorded as amendment A20.
   */
  inquiry_attachments: {
    policiesIn: PHASE_20_POLICIES,
    shape: 'C',
    readPermission: 'inquiries.read',
    deviation:
      'No anon policy of either kind. A public read would list what a customer sent; a public ' +
      'insert could not satisfy its foreign key, because anon cannot create the media_assets row ' +
      'an attachment points at. Rows arrive through attach_inquiry_references(), which is SECURITY ' +
      'DEFINER, checks the enquiry is fresh, and refuses a public_id outside the incoming folder.',
  },

  /**
   * `inquiry_events` — Phase 20. Shape C, staff-read, and NO write policy for any session role.
   *
   * APPEND-ONLY IS ENFORCED BY TRIGGER AND THE ABSENCE OF A WRITE POLICY IS THE OTHER HALF. Rows
   * are written by the three triggers and by `record_inquiry_handoff()`, all SECURITY DEFINER, so
   * the timeline records what happened rather than what somebody later wished had happened. An
   * insert policy here would let a session write an event by hand — including one saying an enquiry
   * was answered.
   */
  inquiry_events: {
    policiesIn: PHASE_20_POLICIES,
    shape: 'C',
    readPermission: 'inquiries.read',
    writePermission: 'inquiries.write',
    writeIsInsertOnly: {
      why:
        'APPEND ONLY. A trigger refuses UPDATE and DELETE for every role including the owner, so an ' +
        'update policy would name a path the database will not take. Staff APPEND — a note, an ' +
        'export record — and the timeline is what happened rather than what somebody later wished ' +
        'had happened.',
    },
    deviation:
      'No anon policy, and no UPDATE or DELETE policy for any session role. Staff holding ' +
      'inquiries.write may APPEND an event; nobody may change one, because a log that can be ' +
      'edited cannot answer what happened.',
  },
  /**
   * `model_variant_labels` — Phase 21. Shape B on a MEDIA parent.
   *
   * A LABEL HAS NO STATUS OF ITS OWN, and that is the design rather than an omission. It is public
   * exactly when the model it names is PUBLISHED; a `status` here would be a second switch that
   * could disagree with the first, and a variant label with no model to attach to is not a thing a
   * visitor can see. Writes mirror `media_assets`: `media.write` adds or edits a label and
   * `media.delete` removes one — the label set is dictated by the file's variant keys, so removal is
   * the rare case and belongs with the role that may remove the model.
   *
   * WHAT THE POLICY DOES NOT DECIDE. Whether a label may carry a `material_id` is a CHECK on the row
   * (a material forces at least OWNER_VERIFICATION_REQUIRED), and who may mark it VERIFIED is the
   * Phase 08 authority trigger. Neither is an access question. `lib/media/model.ts` then hands the
   * material name to the public viewer only at VERIFIED.
   */
  model_variant_labels: {
    policiesIn: PHASE_21_POLICIES,
    shape: 'B',
    readPermission: 'media.read',
    writePermission: 'media.write',
    deletePermission: 'media.delete',
    parentClause: `exists (select 1 from media_assets m
             where m.id = model_variant_labels.media_asset_id and m.status = 'PUBLISHED')`,
  },
  /**
   * `merchandising_slots` — Phase 22. Shape A, read under `catalog.read`, written under
   * `merchandising.write`.
   *
   * A SLOT IS STRUCTURE THE PUBLIC RESOLVER MUST READ. `lib/cms/merchandising.ts` runs with the
   * page's own client, which for a visitor is the anon key, so a slot must be anon-readable or every
   * band resolves to its fallback for everyone but staff. The rows carry no copy and no entity —
   * a key, a surface, a minimum and a fallback mode — so publishing them reveals which arrangements
   * the site HAS, not what is in them; the entries below say what is in them, and their clause is
   * stricter. Delete is `destructive.execute`: nothing in the Studio removes a slot, and a slot
   * nothing reads is a dead end, so removal is the owner's act at the database.
   */
  merchandising_slots: {
    policiesIn: PHASE_22_POLICIES,
    shape: 'A',
    readPermission: 'catalog.read',
    writePermission: 'merchandising.write',
    deletePermission: 'destructive.execute',
  },
  /**
   * `merchandising_entries` — Phase 22. Shape A with the slot's status AND the entry's own window
   * folded into the public clause.
   *
   * THE WINDOW IS PART OF "PUBLIC", exactly as it is for `page_sections`: a PUBLISHED entry with a
   * future `publish_at` is a plan, and a plan readable through the anon key the moment it is saved
   * would make scheduling decorative. The slot must be PUBLISHED too — an entry in a slot being
   * prepared is not on any page. The resolver re-checks all of this in code (`isLive`) because a
   * Studio preview reads with a staff client that this clause does not apply to; the two must agree,
   * and `lib/cms/windowing.ts` states the rule once for both.
   *
   * DELETE IS `merchandising.write`, NOT `destructive.execute`. Removing a piece from a curated band
   * is ordinary curation — the same act `product_collections` admits under `catalog.write` — and it
   * destroys no history: the entity is untouched and `activity_events` records the change.
   */
  merchandising_entries: {
    policiesIn: PHASE_22_POLICIES,
    shape: 'A',
    publicClause: `status = 'PUBLISHED'
      and (publish_at is null or publish_at <= now())
      and (unpublish_at is null or unpublish_at > now())
      and exists (select 1 from merchandising_slots s
                   where s.id = merchandising_entries.slot_id and s.status = 'PUBLISHED')`,
    readPermission: 'catalog.read',
    writePermission: 'merchandising.write',
    deletePermission: 'merchandising.write',
  },

  /**
   * `search_documents` — Phase 23. THE ONE TABLE IN THE PROJECT THAT IS READ BY ANON AND WRITTEN BY
   * NOBODY.
   *
   * Shape A with an overridden clause, because "published" is not the whole condition: a STAFF
   * document — a material, a media asset, an enquiry — can perfectly well be PUBLISHED in its own
   * table, and the visibility column is what keeps it out of a visitor's results. Both halves are
   * in the predicate, and a CHECK on the table (0210) makes the three Studio-only entity types
   * structurally incapable of carrying `visibility = 'PUBLIC'` in the first place.
   *
   * NO WRITE PERMISSION AT ALL, which is the deviation worth arguing. Every row is derived from a
   * source table by `refresh_search_document()`, a security-definer trigger function. An
   * `authenticated` insert policy would let a signed-in member of staff hand-write a search result
   * — a title, a URL and a picture of their choosing — for an entity that says something else. A
   * projection nobody may write by hand is a projection that cannot be forged, so the only writer
   * is the trigger, and the reindex script connects as the service role.
   */
  search_documents: {
    policiesIn: PHASE_23_SEARCH_POLICIES,
    shape: 'A',
    publicClause: `visibility = 'PUBLIC' and status = 'PUBLISHED'`,
    readPermission: 'catalog.read',
  },
  /**
   * `research_search_documents` — Phase 23, created empty, populated from Phase 25 onward.
   *
   * ISOLATION INVARIANT I2 AS A POLICY DECLARATION: no anon leg, and staff select requires
   * `research.read`, which `editor` alone among the six roles does not hold. It is shape C for the
   * same reason every research table will be — there is no visitor-facing view of a competitor's
   * catalogue, and a `publicClause` here would be a bug with a syntax.
   */
  research_search_documents: {
    policiesIn: PHASE_23_SEARCH_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      'The research corpus. No anon policy may ever exist on any research_* table (isolation ' +
      'invariant I2), and no authenticated write policy either: the index is maintained by the ' +
      'Phase 25-28 pipeline through the service role, never by a session.',
  },
  /**
   * `search_queries` — Phase 23. What was typed and how many rows came back.
   *
   * READ UNDER `analytics.read`, WRITTEN BY NOBODY WITH A SESSION. The write path is deliberately
   * the service role: a public search has no session at all, so an anon insert policy would be the
   * only alternative — and an anon-writable table on the public path is an endpoint a stranger can
   * fill with whatever text they like, attributed to a search that never happened.
   */
  search_queries: {
    policiesIn: PHASE_23_SEARCH_POLICIES,
    shape: 'C',
    readPermission: 'analytics.read',
    deviation:
      'A record of searches, not content. No anon read: it would expose what other visitors ' +
      'looked for. No authenticated write: public searches have no session, so logging runs ' +
      'through the service role for both scopes rather than opening an anon insert policy.',
  },
  /**
   * `content_relations` — Phase 23. The sibling of `product_relations`, and it takes the same shape
   * B for the same reason: the public reads relations, so an edge is visible exactly when the row
   * it hangs off is published.
   *
   * THE PARENT IS POLYMORPHIC, so the clause is three exists-tests rather than one. Written out
   * per source type rather than generated, because which parents make an edge public is a
   * judgement — and the judgement is that a DRAFT project's edges are as private as the project.
   * The TARGET side is not tested here and that is deliberate: an edge to an unpublished product
   * must resolve to nothing rather than to a broken link, and that is the repository's job, where
   * the same filter also serves the Studio preview which this policy does not apply to.
   */
  content_relations: {
    policiesIn: PHASE_23_RELATION_POLICIES,
    shape: 'B',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'catalog.write',
    parentClause: `(source_type = 'portfolio_project'
              and exists (select 1 from portfolio_projects pp
                           where pp.id = content_relations.source_id and pp.status = 'PUBLISHED'))
          or (source_type = 'journal_article'
              and exists (select 1 from journal_articles ja
                           where ja.id = content_relations.source_id and ja.status = 'PUBLISHED'))
          or (source_type = 'collection'
              and exists (select 1 from collections c
                           where c.id = content_relations.source_id and c.status = 'PUBLISHED'))`,
  },
  /**
   * `relation_suppressions` — Phase 23. A record of what an editor said no to.
   *
   * STAFF-ONLY, AND THE ABSENCE OF AN ANON LEG IS THE POINT: a suppression names a connection
   * somebody considered and rejected, which is an editorial judgement about two pieces of content
   * and none of a visitor's business. Written under `catalog.write` — dismissing a suggestion is an
   * ordinary editorial act — and deletable under the same permission, because un-dismissing is how
   * an editor changes their mind and it destroys no history that is not already in `audit_logs`.
   */
  relation_suppressions: {
    policiesIn: PHASE_23_RELATION_POLICIES,
    shape: 'C',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'catalog.write',
    deviation:
      'An editorial judgement about what NOT to connect. Never publicly readable: it would tell a ' +
      'visitor which relationships were considered and refused, which is a view of the editing ' +
      'process rather than of the catalogue.',
  },
  /**
   * `product_attribute_terms` — Phase 23. Shape A, the ordinary content shape, because a term IS
   * read by a visitor once it is published — that is what makes it content rather than a lookup
   * list in TypeScript.
   *
   * IT SHIPS WITH ZERO ROWS, so the anon leg reads nothing today. The D10 gate on the row
   * (`*_verified_before_publish`, 0213) is what stops that changing without an owner: a term
   * defaults to OWNER_VERIFICATION_REQUIRED and cannot be PUBLISHED until somebody with
   * `content.verify` says the workshop really works in it.
   */
  product_attribute_terms: {
    policiesIn: PHASE_23_RELATION_POLICIES,
    shape: 'A',
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
    deletePermission: 'destructive.execute',
  },

  /**
   * The four Phase 24 bulk tables. All shape C, all read under `bulk.execute`, none writable by a
   * session.
   *
   * WHY `bulk.execute` AND NOT A UNION. The phase document says select requires `bulk.execute` OR
   * `operations.audit.read`. Those hold {owner, admin, merchandiser} and {owner, admin}: the union
   * is exactly `bulk.execute`'s set, so naming the wider permission is the same policy with one
   * fewer thing that can drift. If `operations.audit.read` ever gains a role `bulk.execute` lacks,
   * this becomes wrong and `check-rls.ts` says so on the next run, which is the point of deriving
   * the role list from the matrix rather than writing it out.
   *
   * NO SESSION WRITE POLICY ON ANY OF THE FOUR. Every write goes through `lib/bulk/run.ts` on the
   * admin client, AFTER `requirePermission`. An `authenticated` insert policy would let a signed-in
   * merchandiser hand-write a `bulk_operations` row — a preview with a selection they never saw
   * previewed, or a SUCCEEDED row for an operation that never ran — and the per-item snapshots are
   * what the undo and the audit trail are built on.
   *
   * AND NO DELETE POLICY FOR THE TWO RECORD TABLES, EVER. `bulk_operations` and
   * `bulk_operation_items` are the account of what somebody did to a page of live content; a
   * record that the person who wrote it can erase is not a record. 0220 revokes the grant as well.
   */
  bulk_operations: {
    policiesIn: PHASE_24_POLICIES,
    shape: 'C',
    readPermission: 'bulk.execute',
    deviation:
      'The record of a bulk operation. No anon policy — a visitor has no business knowing what ' +
      'was archived — and no authenticated write policy: the engine writes through the service ' +
      'role after requirePermission, so a session cannot forge a preview or a result. Delete is ' +
      'absent by design and revoked in 0220.',
  },
  bulk_operation_items: {
    policiesIn: PHASE_24_POLICIES,
    shape: 'C',
    readPermission: 'bulk.execute',
    deviation:
      'The per-item before/after snapshot the 24-hour undo re-applies. Same reasoning as ' +
      'bulk_operations, and one more: a session able to edit `before` could make an undo write ' +
      'whatever it liked into a live row while the audit log recorded a restoration.',
  },
  bulk_imports: {
    policiesIn: PHASE_24_POLICIES,
    shape: 'C',
    readPermission: 'bulk.execute',
    // DELETABLE, unlike the two above, and the difference is what each table is. An import is a
    // working file whose rows are pruned at 30 days; the operation record is history.
    deletePermission: 'destructive.execute',
    deviation:
      'An uploaded file and its column mapping. No anon policy and no session write: the import ' +
      'pipeline runs through the service role after requirePermission, and the uploaded file ' +
      'itself is not retained after apply.',
  },
  bulk_import_rows: {
    policiesIn: PHASE_24_POLICIES,
    shape: 'C',
    readPermission: 'bulk.execute',
    deletePermission: 'destructive.execute',
    deviation:
      'One row of an uploaded file, retained 30 days for post-hoc review. No anon policy — it is ' +
      "an operator's spreadsheet — and no session write: only the import pipeline writes it.",
  },
  /*
   * Phase 25 — the research subsystem's first nine tables, and ISOLATION INVARIANT I2 IS WHAT
   * THIS BLOCK IS.
   *
   * NINE SHAPE-C TABLES, NO ANON POLICY ON ANY OF THEM, EVER. Not one of these tables has a
   * `publicClause`, and adding one would not be a change of policy — it would be a defect with a
   * syntax. There is no visitor-facing view of a competitor's catalogue, of what Rivya fetched
   * from one, or of what it decided about the result. The generated file carries no `anon` leg
   * for any of them and `scripts/research/check-research-isolation.mjs` fails the build if one
   * ever appears.
   *
   * READ IS `research.read` — owner, admin, merchandiser, researcher and viewer. `editor` is the
   * one role that does not hold it, which is the same line Phase 23 already drew for
   * `research_search_documents`.
   *
   * WRITE IS `research.write` — owner, admin, researcher — EXCEPT WHERE IT IS NOT, and the
   * exception is the point of the phase document's permission table: a researcher OPERATES the
   * pipeline and a merchandiser JUDGES its output. `research_products` therefore takes
   * `research.confirm` (owner, admin, merchandiser), because its editable columns in this phase
   * are `stage` and `disposition` and both are disposition-bearing. The dividing line is the
   * COLUMN, not the screen, and later phases add `research.write` columns to the same table —
   * which is a column-level concern the server actions enforce, not something RLS can express.
   *
   * FOUR TABLES ARE WRITTEN ONLY BY THE ENGINE, THROUGH THE SERVICE ROLE, and have no session
   * write policy at all: `research_fetches`, `research_raw_items`, `research_work_items` and
   * `research_robots_cache`. A session able to insert a fetch row could record a request that
   * never happened — including one claiming a `DISALLOWED` URL had been allowed — and a session
   * able to write the robots cache could tell the fetcher that a forbidden host permits
   * everything. Both are the politeness posture being forged from inside the building.
   *
   * `research_pipeline_events` IS APPEND-ONLY: insert under `research.write`, no update and no
   * delete policy, and 0231 revokes both grants. It is the account of how a row reached CONFIRMED,
   * and an account its author can rewrite is not one.
   */
  research_sources: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deletePermission: 'destructive.execute',
    deviation:
      'A competitor website and its politeness settings. No anon policy may ever exist on any ' +
      'research_* table (isolation invariant I2). Enabling one, and approving its policy review, ' +
      'additionally require system.settings.write and are checked in the server action — RLS ' +
      'cannot express a per-column rule, and the row-level CHECK refuses an enabled source that ' +
      'was never approved whatever the session.',
  },
  research_jobs: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deletePermission: 'destructive.execute',
    deviation:
      'The standing definition of work against a source. Staff-only under research.read; ' +
      'operated by research.write, which is owner, admin and researcher.',
  },
  research_runs: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deviation:
      'One execution of a job. A researcher may queue and cancel one; nobody deletes one, ' +
      'because a run is the record of what Rivya asked a third party for and when.',
  },
  research_work_items: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      'The lease queue. Readable by staff so a run can be watched, and written by NOBODY with a ' +
      'session: the drain loop leases and releases through the service role. A session able to ' +
      'write here could re-point a queued URL or clear a not_before_at, which is the rate limit ' +
      'being edited from inside the building.',
  },
  research_fetches: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      'One attempt per row, including the ones refused before any packet left. No session write: ' +
      'a hand-written fetch row could record a request that never happened, or claim a ' +
      'robots-DISALLOWED URL had been ALLOWED — which is the evidence that the rules were ' +
      'honoured being forged.',
  },
  research_raw_items: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      'What a page said, unstructured. Written only by the pipeline through the service role, ' +
      'after the Zod schema that refuses anything richer than a title, a canonical URL and links.',
  },
  research_products: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    // `research.confirm`, NOT `research.write`, and the phase document's permission table is
    // explicit about why: a researcher operates the pipeline, a merchandiser judges its output.
    // Both editable columns here — `stage` and `disposition` — are disposition-bearing.
    writePermission: 'research.confirm',
    deviation:
      'A discovered product, carried through the seven FEAT §23 stages. Write is ' +
      'research.confirm rather than research.write because the two columns a person edits in ' +
      'this phase are stage and disposition, and the dividing line the phase document draws is ' +
      'the column rather than the screen. It has no foreign key to any public table and never ' +
      'will (isolation invariant I1).',
  },
  research_pipeline_events: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    // NO WRITE POLICY OF ANY KIND, which is the `audit_logs` and `activity_events` precedent
    // applied to the pipeline's own history. A signed-in researcher able to insert here could
    // write "merchandiser confirmed this row" naming somebody else, or emit a move that never
    // happened — and this table is the record people would read to check. `stage.ts` writes it
    // through the service role, after `requirePermission`, in the same call that moves the stage:
    // that is what makes "a stage never moves without an event" true rather than customary.
    deviation:
      'Append-only. No anon policy, no authenticated write policy of any kind, and update and ' +
      'delete are revoked outright in 0231. Only lib/scraper/core/stage.ts writes it, through ' +
      'the service role, in the same call that moves the stage — so a move without an event is ' +
      'not a thing that can happen.',
  },
  research_robots_cache: {
    policiesIn: PHASE_25_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      'One robots.txt per host, 24-hour TTL. Readable so an operator can see what a host asked ' +
      'for; written by nobody with a session, because a hand-written row could tell the fetcher ' +
      'that a forbidden host permits everything.',
  },
  /*
   * Phase 26 — the three child tables that make a source configurable without a deploy.
   *
   * SHAPE C, LIKE EVERY OTHER RESEARCH TABLE, AND FOR THE SAME REASON: isolation invariant I2.
   * A URL pattern names paths at somebody else's website, a category mapping is Rivya's private
   * reading of their taxonomy, and a schedule says when Rivya intends to read them. None of the
   * three is a fact a visitor has any business seeing, and none of them ever gains an `anon` leg.
   *
   * WRITE IS `research.write` ON ALL THREE — owner, admin, researcher — because none of these
   * tables carries a disposition. They are configuration a researcher OPERATES with, and the
   * phase document's dividing line is the column: `disposition`, `duplicate_of_id` and `stage`
   * are `research.confirm` work and none of them appears here.
   *
   * ONE THING THIS BLOCK CANNOT SAY, AND THE SERVER ACTION SAYS INSTEAD. Enabling a source and
   * approving its policy review require `research.write` AND `system.settings.write`. RLS gates a
   * ROW, not a COLUMN, so a researcher who may edit a source's delay may — as far as PostgreSQL is
   * concerned — also write its `policy_status`. What stops that is `requirePermission` in the
   * server action plus `research_sources_approval_is_attributed` at the row, which refuses an
   * approval that names nobody.
   */
  research_source_url_patterns: {
    policiesIn: PHASE_26_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deletePermission: 'destructive.execute',
    deviation:
      'What a product, category, paginated or never-to-be-fetched URL looks like at one source. ' +
      'No anon policy may ever exist on any research_* table (isolation invariant I2). Delete is ' +
      'destructive.execute because removing an EXCLUDE pattern widens what Rivya will fetch.',
  },
  research_source_category_map: {
    policiesIn: PHASE_26_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deletePermission: 'destructive.execute',
    deviation:
      "A staff-authored mapping from a source's own category label to a Rivya category, or an " +
      'explicit IGNORE. It carries the FIRST of exactly two research → public foreign keys ' +
      '(amendment A26) and still has no anon policy: the pointer is staff configuration, not a ' +
      'reason to publish anything.',
  },
  research_source_schedules: {
    policiesIn: PHASE_26_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deletePermission: 'destructive.execute',
    deviation:
      'When a job type runs against a source. Staff-only, written by research.write, and bounded ' +
      'at the row by a six-hour minimum interval the form cannot be bypassed to beat.',
  },
  /*
   * Phase 27 — the two tables that make extraction accountable.
   *
   * BOTH ARE SHAPE C AND BOTH ARE WRITTEN BY NOBODY WITH A SESSION, which puts them in the same
   * group as `research_fetches` and `research_raw_items` rather than with `research_sources`.
   * The reason is the same one, and it is worth restating because these two tables are the ones a
   * later phase is most likely to want to "correct" by hand:
   *
   *   `research_product_versions` IS EVIDENCE. It holds what an adapter read off a page at a
   *   moment, and Phase 29 diffs consecutive rows to say what changed. A member of staff able to
   *   edit one could make a change appear that never happened, or make one disappear that did —
   *   and this table is precisely what somebody would read to check. It is written by
   *   `lib/scraper/workflows/extract.ts` through the service role, and by the offline
   *   re-extraction script over the same path.
   *
   *   `research_adapter_runs` IS THE ACCOUNT OF A FAILURE. Its whole purpose is to make "a broken
   *   adapter did not break other sources" a checkable claim, and a claim about failure that the
   *   failing party can edit is not one.
   *
   * NEITHER IS DELETABLE EITHER. Pruning removes the SNAPSHOT at 180 days and clears
   * `storage_key`; the version outlives the evidence deliberately, because the draft is what a
   * diff compares and the page body is only how it was obtained.
   */
  research_product_versions: {
    policiesIn: PHASE_27_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      'One observation of one product, append-only and deduplicated by content hash. No anon ' +
      'policy may ever exist on any research_* table (isolation invariant I2), and no session ' +
      'write policy of any kind: this table is the evidence a change record is reproduced from, ' +
      'and evidence its author can edit is not evidence.',
  },
  research_adapter_runs: {
    policiesIn: PHASE_27_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      "The per-(run, source, adapter) accounting that makes FEAT §27's isolation claim " +
      'checkable. Staff read it on the run detail screen; nobody writes it with a session, ' +
      'because a record of what failed that the failing party can edit proves nothing.',
  },
  /*
   * Phase 28 — the three tables normalisation adds, and they take three DIFFERENT write postures
   * from one another. That is the phase document's rule expressed at the table: the dividing line
   * is the COLUMN, not the screen.
   *
   *   `research_material_lexicon` is CONFIGURATION. A researcher adds a material nobody
   *   anticipated, exactly as they add a URL pattern — `research.write`, full stop.
   *
   *   `research_validation_issues` is a FINDING, and a person's part in it is to DISMISS one.
   *   Update under `research.write`, and NO INSERT POLICY AT ALL: an `ERROR` is what stops a row
   *   being promoted, so a hand-written one is a way to hold rows back with nothing in the
   *   pipeline log saying why.
   *
   *   `research_match_candidates` is a PROPOSAL a merchandiser decides, and deciding one writes
   *   `duplicate_of_id` and `disposition` on the product — both `research.confirm` columns. So the
   *   candidate row takes `research.confirm` too, or a researcher could accept a merge they are
   *   not permitted to perform directly. It has no insert policy for the same reason the issues
   *   table has none: the matcher proposes, and a proposal somebody made up is not one.
   */
  research_validation_issues: {
    policiesIn: PHASE_28_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    writeIsUpdateOnly: {
      why:
        'An issue is raised by lib/scraper/validation/rules.ts from the evidence, never by a ' +
        'person. An ERROR blocks promotion past VALIDATED, so a hand-written one holds rows back ' +
        'silently; what a person does here is dismiss one, with a reason the row demands.',
    },
    deviation:
      'One finding per (product, version, rule, field). No anon policy may ever exist on any ' +
      'research_* table (isolation invariant I2). Update under research.write is the dismissal; ' +
      'there is no insert policy and no delete policy, because an issue that was wrong is a fact ' +
      'about the rule that raised it and deleting it deletes the evidence that the rule needs ' +
      'changing.',
  },
  research_match_candidates: {
    policiesIn: PHASE_28_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    // `research.confirm`, NOT `research.write`, and the phase document is explicit: accepting a
    // candidate writes `duplicate_of_id` AND `disposition`, and both are disposition-bearing.
    writePermission: 'research.confirm',
    writeIsUpdateOnly: {
      why:
        'The matcher proposes; a merchandiser decides. A candidate somebody inserted by hand is ' +
        'not a proposal the matcher made, and accepting it would write a duplicate flag on ' +
        'evidence that never existed.',
    },
    deviation:
      'A proposal, never a verdict. Write is research.confirm rather than research.write because ' +
      'deciding one writes duplicate_of_id and disposition on the product, and a researcher who ' +
      'may not set those directly must not be able to set them through a candidate. No insert ' +
      'policy: the matcher writes these through the service role.',
  },
  research_material_lexicon: {
    policiesIn: PHASE_28_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deletePermission: 'destructive.execute',
    deviation:
      "A parsing vocabulary for other people's words, editable in Studio so that a material " +
      'nobody anticipated is added without a deploy. Delete is destructive.execute because ' +
      'removing a token unmatches it on every stored row the next re-normalisation touches.',
  },
  /*
   * Phase 29 — seven tables, and they sort into three groups by WHO MAY WRITE. The grouping is the
   * phase's argument, so it is stated once here rather than seven times below.
   *
   *   DETECTED BY THE SYSTEM — `research_changes`, `research_change_digests`. No write policy of
   *   any kind. A change somebody typed is not a change a page made, and the entire value of the
   *   review queue is that every row in it is evidence of something a competitor actually did. The
   *   same posture as `research_fetches` and `research_raw_items` in Phase 25, for the same reason.
   *
   *   DECIDED BY A PERSON — `research_review_actions`, `research_notes`, `research_product_tags`.
   *   `research.confirm`: the Phase 04 split's judging half. All three are INSERT-ONLY at the
   *   policy and append-only at the trigger, and a reversal is a new row.
   *
   *   CONFIGURED BY A PERSON — `research_change_rules`, `research_tags`. `research.write`: the
   *   operating half, exactly as `research_material_lexicon`. A threshold is a parsing decision
   *   about somebody else's page, not a verdict about a product.
   *
   * `research_product_tags` IS SHAPE C DESPITE BEING A JOIN TABLE. Shape B derives anon visibility
   * from its parents, and no research table has an anon leg at all (I2) — so B would describe a
   * public predicate for a row no member of the public may ever see.
   */
  research_changes: {
    policiesIn: PHASE_29_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      'Detected, never authored. No write policy of any kind: the detector writes these through ' +
      'the service role, and a change row a session could insert is a competitor price move ' +
      'somebody could invent. No anon policy may ever exist on any research_* table (isolation ' +
      'invariant I2). The decision columns are stamped by the same service-role path that writes ' +
      'the append-only action row, so a person decides through an action and never by an UPDATE.',
  },
  research_change_rules: {
    policiesIn: PHASE_29_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deletePermission: 'destructive.execute',
    deviation:
      'Configuration, like a URL pattern or a material token: research.write, because a ' +
      'threshold is a parsing decision about how loudly a source is read, not a verdict about a ' +
      'product. Delete is destructive.execute because removing a per-source override silently ' +
      'returns that source to the global default on the next detection pass. No anon policy may ' +
      'ever exist on any research_* table (isolation invariant I2).',
  },
  research_review_actions: {
    policiesIn: PHASE_29_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.confirm',
    writeIsInsertOnly: {
      why:
        'Append-only, enforced by tg_research_review_actions_append_only(), which refuses every ' +
        'UPDATE except setting undone_by_action_id once from null and refuses DELETE outright. An ' +
        'update policy would describe a path the database will not take, and a generated file is ' +
        'read as a statement of what is possible. The reversal itself is written by the server ' +
        'action through the service role, in the same call that inserts the reversing action.',
    },
    deviation:
      'The record of who decided what and why, under research.confirm because every one of the ' +
      'nine FEAT §25 actions is a disposition. No anon policy may ever exist on any research_* ' +
      'table (isolation invariant I2), and no delete policy exists on this one at all: a decision ' +
      'somebody could erase is not an audit trail.',
  },
  research_notes: {
    policiesIn: PHASE_29_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.confirm',
    writeIsInsertOnly: {
      why:
        'Append-only, enforced by tg_research_notes_append_only(). An edit is a NEW note with ' +
        'superseded_by set on the old one — written by the server action through the service ' +
        'role — because what somebody thought before they changed their mind is the useful half ' +
        'of a note thread.',
    },
    deviation:
      'Notes are never deleted, only superseded. research.confirm rather than research.write ' +
      'because a note on a research row is part of the judging conversation, alongside the action ' +
      'it usually accompanies. No anon policy may ever exist on any research_* table (I2).',
  },
  research_tags: {
    policiesIn: PHASE_29_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.write',
    deletePermission: 'destructive.execute',
    deviation:
      'A controlled vocabulary, configuration in exactly the sense research_material_lexicon is. ' +
      'Delete is destructive.execute because the cascade takes the tag off every row it was ever ' +
      'applied to, and a tag that was on forty rows yesterday and nothing today is unrecoverable. ' +
      'No anon policy may ever exist on any research_* table (I2).',
  },
  research_product_tags: {
    policiesIn: PHASE_29_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    writePermission: 'research.confirm',
    deletePermission: 'research.confirm',
    writeIsInsertOnly: {
      why:
        'A tag is applied or removed, never amended: the composite primary key IS the row, so an ' +
        'UPDATE could only move a tag from one product to another, which is two decisions ' +
        'disguised as one.',
    },
    deviation:
      'Shape C rather than B despite being a join table: shape B derives anon visibility from its ' +
      'parents, and no research_* table has an anon leg to derive from (I2). Applying a tag is a ' +
      'judgement about what a row IS, so research.confirm — and unlike every other table in this ' +
      'phase it takes a DELETE policy, because removing a tag applied in error is the correction, ' +
      'not a rewriting of history: no decision is recorded on this row, the action log holds it.',
  },
  research_change_digests: {
    policiesIn: PHASE_29_POLICIES,
    shape: 'C',
    readPermission: 'research.read',
    deviation:
      'Generated by the digest job under the service role, one row per day, keyed by date so a ' +
      'retried cron slice updates rather than duplicates. No write policy: a hand-edited summary ' +
      'read as a trend is worse than no summary. No anon policy may ever exist on any research_* ' +
      'table (isolation invariant I2).',
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
