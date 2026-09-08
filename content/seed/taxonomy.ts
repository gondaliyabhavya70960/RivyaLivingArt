import type { SeedModule } from './types'

/**
 * The seven categories fixed by CANONICAL-DECISIONS.md D3, in its priority order.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT CONTAIN
 * ----------------------------------------------
 * No description, no subtitle, no SEO text — no marketing copy of any kind. Phase 03 seeds slug,
 * name and order; the SEED §14 category copy arrives in Phase 09, through a module of its own.
 * Writing it here would put prose in a phase whose exit criteria cannot review it, and would make
 * this module the second place category copy lives.
 *
 * Every `name` is the plain English reading of the slug D3 already fixed. None of them asserts
 * anything about the business — no claim about what Rivya makes, has made, or can make. That
 * matters because D10 forbids fabricating business capability, and a category name is the
 * cheapest place in the system to do it by accident.
 *
 * `3d-resin` is the one exception, and it is seeded OWNER_VERIFICATION_REQUIRED. A category named
 * "3D Resin" asserts a fabrication capability, and no one has yet confirmed the business has it.
 * The flag makes `status = 'PUBLISHED'` unreachable for that row — enforced by
 * `categories_verified_before_publish` in 0004_taxonomy.sql, not by review — until an owner
 * clears it. The other six name material or presentation categories that carry no such claim.
 *
 * `sort_order` is D3's priority order, spaced by ten so an owner can insert a category between
 * two existing ones without renumbering the rest.
 */
export const taxonomySeed: SeedModule = {
  name: 'taxonomy',
  description: 'The seven D3 categories: slug, name and order only.',
  records: [
    {
      seedKey: 'category:furniture',
      table: 'categories',
      fields: {
        slug: 'furniture',
        name: 'Furniture',
        sort_order: 10,
        is_primary: true,
        owner_verification: 'NOT_REQUIRED',
      },
    },
    {
      seedKey: 'category:collectible-design',
      table: 'categories',
      fields: {
        slug: 'collectible-design',
        name: 'Collectible Design',
        sort_order: 20,
        is_primary: true,
        owner_verification: 'NOT_REQUIRED',
      },
    },
    {
      // The capability claim. See the note above: this row cannot be published until an owner
      // confirms the business actually does 3D resin work.
      seedKey: 'category:3d-resin',
      table: 'categories',
      fields: {
        slug: '3d-resin',
        name: '3D Resin',
        sort_order: 30,
        is_primary: true,
        owner_verification: 'OWNER_VERIFICATION_REQUIRED',
      },
    },
    {
      seedKey: 'category:wall-statement-art',
      table: 'categories',
      fields: {
        slug: 'wall-statement-art',
        name: 'Wall Statement Art',
        sort_order: 40,
        is_primary: true,
        owner_verification: 'NOT_REQUIRED',
      },
    },
    {
      seedKey: 'category:preservation',
      table: 'categories',
      fields: {
        slug: 'preservation',
        name: 'Preservation',
        sort_order: 50,
        is_primary: true,
        owner_verification: 'NOT_REQUIRED',
      },
    },
    {
      seedKey: 'category:decor',
      table: 'categories',
      fields: {
        slug: 'decor',
        name: 'Decor',
        sort_order: 60,
        is_primary: true,
        owner_verification: 'NOT_REQUIRED',
      },
    },
    {
      seedKey: 'category:gifts',
      table: 'categories',
      fields: {
        slug: 'gifts',
        name: 'Gifts',
        sort_order: 70,
        is_primary: true,
        owner_verification: 'NOT_REQUIRED',
      },
    },
  ],
}
