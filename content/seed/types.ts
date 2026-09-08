/**
 * The shape a seed module exports.
 *
 * A module declares WHAT should exist. The runner decides whether to insert it, update it or
 * leave it alone — a module never talks to the database and never contains a conditional about
 * one. That separation is what lets Phase 09 add nine more modules without touching the runner,
 * and it is why the seeding contract can be tested once rather than once per module.
 */

/** The tables a seed module may write to. `products` is absent, permanently: requirement §32
 *  forbids seeded inventory, so the type system does not let a module ask for one. */
export type SeedableTable =
  | 'categories'
  | 'collections'
  | 'materials'
  // Phase 08. `pages` is the route shell and `global_content` the site-wide strings; both are
  // structure the CMS engine needs before any copy exists. `page_sections` is deliberately ABSENT:
  // a section is where copy lives, and seeding copy is Phase 09's work through modules of its own.
  | 'pages'
  | 'global_content'

/**
 * One seeded row.
 *
 * `fields` holds only the columns the seed owns. Everything outside it — status, timestamps,
 * anything an editor later types — is not the seed's business, and the runner never writes a
 * column that is not in here.
 */
export type SeedRecord = {
  /**
   * Stable identity, e.g. `category:furniture`. It is the key the runner matches on, so it must
   * never change once shipped: changing it orphans the existing row and inserts a duplicate.
   */
  seedKey: string
  table: SeedableTable
  fields: Record<string, string | number | boolean | null>
}

export type SeedModule = {
  /** Used by `--only=<name>`. */
  name: string
  /** One line on what this module seeds, printed in the run report. */
  description: string
  records: readonly SeedRecord[]
}
