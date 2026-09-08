/**
 * The shape a seed module exports.
 *
 * A module declares WHAT should exist. The runner decides whether to insert it, update it, leave
 * it alone or defer it — a module never talks to the database and never contains a conditional
 * about one. That separation is what lets a phase add modules without touching the runner, and it
 * is why the seeding contract can be tested once rather than once per module.
 */

export type SeedableTable =
  | 'categories'
  | 'collections'
  | 'materials'
  // Phase 08. `pages` is the route shell and `global_content` the site-wide strings; both are
  // structure the CMS engine needs before any copy exists.
  | 'pages'
  | 'global_content'
  // Phase 09. The copy itself.
  | 'page_sections'
  | 'navigation_items'
  | 'seo_entries'
  | 'faqs'
  /**
   * Tables that do not exist yet. A record targeting one is `deferred` — authored now, written
   * when the phase that creates the table re-runs its module. They are in the union because they
   * ARE seedable; what they are not is present. `products` is a different case entirely and is
   * absent permanently, below.
   */
  | 'journal_categories' // Phase 18, migration 0160
  | 'journal_articles' // Phase 18, migration 0160
  | 'customization_forms' // Phase 19, migration 0170
  | 'customization_form_fields' // Phase 19, migration 0170

/**
 * `products` IS ABSENT, PERMANENTLY, and the type is the enforcement.
 *
 * SEED §32 forbids seeded inventory: a live product comes from owner entry, an approved import or
 * the confirmed-product workflow, never from a seed. Expressing that as a union member the type
 * system does not have means a module cannot even be written that targets it — there is nothing to
 * review, and `tests/unit/seed-modules.test.ts` asserts the runner's allowlist matches this type
 * so the two cannot drift.
 */
export const SEEDABLE_TABLES: readonly SeedableTable[] = [
  'categories',
  'collections',
  'materials',
  'pages',
  'global_content',
  'page_sections',
  'navigation_items',
  'seo_entries',
  'faqs',
  'journal_categories',
  'journal_articles',
  'customization_forms',
  'customization_form_fields',
]

/** A column value a module may state directly. Anything relational goes through `refs`. */
export type SeedFieldValue = string | number | boolean | null | readonly string[] | object

/**
 * A column whose value is another SEEDED row's uuid, named by that row's `seed_key`.
 *
 * WHY THIS EXISTS RATHER THAN A LITERAL UUID. A seeded section belongs to a seeded page, and
 * neither has an id until the runner writes it. Hard-coding uuids would make the modules depend on
 * a particular database, and computing them from the key would invent identifiers the database did
 * not choose. The runner resolves these at write time, in module order, which is why
 * `content/seed/index.ts` orders `pages` before anything that references a page.
 *
 * AN UNRESOLVABLE REF IS A FAILURE, NOT A NULL. A section pointing at a page that does not exist
 * is a typo in the module, and writing it with a null `page_id` would either violate the foreign
 * key (loudly, but naming a column rather than the mistake) or — for a nullable column — succeed
 * and produce content nothing can reach.
 */
export type SeedRef = {
  readonly table: SeedableTable
  readonly seedKey: string
}

/**
 * A column whose value is a `media_assets` uuid, named by the asset's `rivya_asset_id`.
 *
 * AN UNRESOLVED MEDIA REFERENCE FAILS THE RECORD rather than falling back. The phase document is
 * explicit: "Media binding map may only reference `rivya_asset_id` values present in the manifest;
 * unresolved bindings fail the run rather than falling back." A placeholder image in a seeded
 * section is exactly the fabrication D10 forbids — it would show a visitor a picture of something
 * Rivya may never have made.
 *
 * A slot with no asset is left NULL and recorded as a gap. That is a different thing from a
 * binding that names an asset which is not there, which is a mistake.
 */
export type SeedMediaRef = string

/**
 * One seeded row.
 *
 * `fields` holds only the columns the seed owns. Everything outside it — `status` on an existing
 * row, timestamps, anything an editor later types — is not the seed's business, and the runner
 * never writes a column that is not in here, `refs`, or `media`.
 */
export type SeedRecord = {
  /**
   * Stable identity, e.g. `home.hero`, `nav.header.collection.furniture`, `faq.01`. It is the key
   * the runner matches on, so it must never change once shipped: changing it orphans the existing
   * row and inserts a duplicate.
   */
  readonly seedKey: string
  readonly table: SeedableTable
  readonly fields: Record<string, SeedFieldValue>
  /** Columns resolved from another seeded row's uuid. See `SeedRef`. */
  readonly refs?: Record<string, SeedRef>
  /** Columns resolved from `media_assets.rivya_asset_id`. See `SeedMediaRef`. */
  readonly media?: Record<string, SeedMediaRef>
  /**
   * Tables this RECORD needs, overriding the module's declaration.
   *
   * PER-RECORD, BECAUSE THE TWO MODULES THAT DEFER ARE MIXED. `commissions.ts` writes six sections
   * that can land today and authors three form templates that cannot; `journal.ts` writes a
   * landing hero and an empty state and authors nineteen records that cannot. A module-level
   * declaration alone would defer the sections too, so `/custom-commissions` and `/journal` would
   * have no copy at all until Phases 18 and 19 — which is precisely the outcome the deferral
   * mechanism exists to avoid.
   *
   * The module-level declaration remains, as the default for records that state none.
   */
  readonly requiresTables?: readonly string[]
}

export type SeedModule = {
  /** Used by `--only=<name>`. */
  readonly name: string
  /** One line on what this module seeds, printed in the run report. */
  readonly description: string
  /**
   * Tables that must exist before any record in this module can be written.
   *
   * THE DEFERRAL MECHANISM, AND WHY IT IS A DECLARATION RATHER THAN A TRY/CATCH. Two modules in
   * this phase author copy for tables that arrive later — `journal.ts` needs `journal_categories`
   * and `journal_articles` (Phase 18), `commissions.ts` needs the `customization_forms*` trio
   * (Phase 19). Catching the resulting error would make "the table is missing" indistinguishable
   * from "the insert was wrong", and would leave the record counted as failed. Declaring the
   * dependency lets the runner probe once, report the records as `deferred`, and exit 0.
   *
   * The alternative — duplicating the copy into a Phase 18 module — is what this exists to
   * prevent: the copy lives in one module, is written once, and is applied unchanged when the
   * owning phase re-runs `--only=<module>`.
   */
  readonly requiresTables?: readonly string[]
  readonly records: readonly SeedRecord[]
}
