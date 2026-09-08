import type { SeedModule } from './types'

/**
 * The D3 route shell: one `pages` row per static public route.
 *
 * WHAT THIS MODULE IS, AND IS NOT. It seeds the STRUCTURE the CMS engine needs — a row for each
 * addressable route, so `resolvePage` has something to resolve and Studio has something to list.
 * It seeds no sections and therefore no copy. Every headline, every paragraph and every call to
 * action on these pages arrives in Phase 09, through modules of its own, carrying its own
 * `fact_classification` and its own verification flag.
 *
 * DYNAMIC ROUTES ARE ABSENT. `/product/[slug]`, `/collection/[category]`, `/journal/[slug]` and
 * the rest are rendered from `products`, `categories` and `journal_posts` — one `pages` row could
 * not stand for all of them, and a row for the literal path `/product/[slug]` would be a page
 * nobody can reach with a `path_shape` the constraint refuses anyway.
 *
 * WHY THESE ROWS ARE `NOT_REQUIRED` AND PUBLISHED, INCLUDING `/large-format`.
 * -------------------------------------------------------------------------
 * `taxonomy.ts` seeds the `3d-resin` CATEGORY as `OWNER_VERIFICATION_REQUIRED`, because a category
 * named "3D Resin" asserts a fabrication capability nobody has confirmed. The same reasoning does
 * NOT reach these rows, and the difference is worth stating because it looks inconsistent.
 *
 * A category is an offer: it appears in navigation as something Rivya sells. A page row is an
 * ADDRESS — it says a route exists, not that there is anything behind it. What is behind it is the
 * sections, and `page_sections_verified_before_publish` holds each of those to the rule
 * individually. Marking a page row unverified would take the whole route offline via
 * `pages_verified_before_publish`, so `/large-format` would 404 rather than showing an honest
 * empty state. A 404 asserts nothing, but it also tells a visitor the wrong thing: that the site
 * has no such page, when what is true is that its copy is not written yet.
 *
 * So the burden sits where the claim is. `/portfolio` is the clearest case: D10 records that
 * Rivya's delivered work has not been confirmed, and the answer is the `empty-state` block with
 * SEED §28's copy — not an absent route.
 *
 * `title` IS THE ROUTE'S NAME, NOT A HEADLINE. Studio lists pages by it and it becomes the default
 * `<title>`; the page's actual heading is a `hero` or `statement` section an editor writes. None of
 * these titles asserts a business fact — they name a destination, in the plainest reading of the
 * path D3 already fixed.
 *
 * `/search` HAS NO ROW. It is a query surface with no editable content: nothing on it comes from
 * `page_sections`, so a row would exist only to be empty and to appear in Studio inviting an
 * editor to add blocks that would never render.
 */
export const pagesSeed: SeedModule = {
  name: 'pages',
  description: 'One pages row per static D3 route. Structure only — no sections, no copy.',
  records: [
    row('home', '/', 'Home'),
    row('about', '/about', 'About'),
    row('process', '/process', 'Process'),
    row('large-format', '/large-format', 'Large Format'),
    row('collection', '/collection', 'Collection'),
    row('custom-commissions', '/custom-commissions', 'Custom Commissions'),
    row('portfolio', '/portfolio', 'Portfolio'),
    row('journal', '/journal', 'Journal'),
    row('contact', '/contact', 'Contact'),
    row('faq', '/faq', 'Frequently Asked Questions'),
    row('privacy', '/privacy', 'Privacy'),
    row('terms', '/terms', 'Terms'),
    /**
     * The reserved SYSTEM row. `path` is null, which is what makes it structurally unreachable
     * from `resolvePage` — that function matches on `path`, and null equals nothing including
     * itself. `/studio/content/pages/global` is what it is for.
     */
    {
      seedKey: 'page:global',
      table: 'pages',
      fields: {
        slug: 'global',
        path: null,
        title: 'Global',
        kind: 'SYSTEM',
        is_system: true,
        status: 'PUBLISHED',
        fact_classification: 'EDITORIAL_COPY',
        owner_verification: 'NOT_REQUIRED',
      },
    },
  ],
}

function row(slug: string, path: string, title: string) {
  return {
    seedKey: `page:${slug}`,
    table: 'pages' as const,
    fields: {
      slug,
      path,
      title,
      kind: 'PAGE',
      is_system: false,
      /**
       * PUBLISHED on insert, which only the seed may do: `enforce_status_transition` lets a null
       * actor — a migration, or this runner over DATABASE_URL — insert a non-DRAFT row, and
       * refuses it for every session actor. A route shell that arrived as DRAFT would leave the
       * whole site 404ing until someone walked twelve pages through the status workflow by hand.
       *
       * The runner never changes `status` on a row that already exists, so an editor who archives
       * a page keeps it archived across every future seed.
       */
      status: 'PUBLISHED',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
}
