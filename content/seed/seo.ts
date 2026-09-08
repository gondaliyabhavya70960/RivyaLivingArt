import type { SeedModule, SeedRecord } from './types'

/**
 * SEO: the global defaults (SEED §41), the keyword themes (§42) and the social defaults (§44),
 * plus a per-path entry for each of the thirteen static routes.
 *
 * TWO TABLES, FOR TWO DIFFERENT KINDS OF THING. `seo_entries` holds the per-scope metadata the
 * page head renders — one GLOBAL row and one PATH row per route, which is the shape 0050 gave that
 * table. `global_content` under `SEO_DEFAULT` and `SOCIAL` holds the editable strings that are not
 * per-page: the title template, the keyword themes, the OpenGraph headline.
 *
 * THE KEYWORD THEMES ARE NOT METADATA AND ARE NOT RENDERED. §42 is explicit — "do not keyword-
 * stuff", and "actual SEO strategy must be refined through research before claiming ranking
 * opportunity". They are seeded as one editorial row for the owner and whoever does that research
 * to work from; nothing puts them in a `<meta keywords>` tag, which search engines ignored two
 * decades ago and which would read as exactly the stuffing §42 forbids.
 *
 * THE PER-PATH TITLES AND DESCRIPTIONS ARE THE SPECIFICATION'S OWN, taken from the SEO block at
 * the head of each page section (§11 for /about, §12 for /large-format, and so on). Where a route
 * has no SEO block in the specification — `/search`, `/privacy`, `/terms` — no PATH row is seeded:
 * an invented description is a claim about a page nobody has written, and the GLOBAL default
 * covers them until someone does.
 */

const SITE_NAME = 'Rivya Living Art'

const seoGlobal = (key: string, value: string, label: string, description: string): SeedRecord => ({
  seedKey: `global:SEO_DEFAULT.${key}`,
  table: 'global_content',
  fields: {
    group_key: 'SEO_DEFAULT',
    key,
    label,
    value,
    description,
    is_enabled: true,
    status: 'PUBLISHED',
    fact_classification: 'SEO_COPY',
    owner_verification: 'NOT_REQUIRED',
  },
})

const socialRow = (key: string, value: string, label: string): SeedRecord => ({
  seedKey: `global:SOCIAL.${key}`,
  table: 'global_content',
  fields: {
    group_key: 'SOCIAL',
    key,
    label,
    value,
    description: 'SEED §44.',
    is_enabled: true,
    status: 'PUBLISHED',
    fact_classification: 'SEO_COPY',
    owner_verification: 'NOT_REQUIRED',
  },
})

/** §42's seventeen themes, in its order. Research input, never rendered. */
const KEYWORD_THEMES = [
  'resin furniture',
  'resin dining table',
  'river table',
  'epoxy resin furniture',
  'custom resin table',
  'bespoke resin furniture',
  'resin coffee table',
  'resin console table',
  'sculptural furniture',
  'collectible furniture',
  '3D printed furniture',
  'resin wall art',
  'large resin art',
  'custom furniture India',
  'resin furniture India',
  'custom resin art',
  'resin preservation',
] as const

/**
 * The per-path entries, from each page's own SEO block in the specification.
 *
 * `/` is not in this list: the homepage's metadata IS the global default, and a PATH row
 * duplicating it would be a second place to edit one title.
 */
const PATHS: readonly { path: string; title: string; description: string }[] = [
  {
    path: '/about',
    title: 'About Rivya Living Art | Resin Furniture & Functional Art',
    description:
      'Discover Rivya Living Art, a contemporary studio exploring resin furniture, sculptural objects, material craft and digital fabrication.',
  },
  {
    path: '/large-format',
    title: 'Large Resin Furniture & Custom Statement Pieces | Rivya Living Art',
    description:
      'Explore large-format resin tables, sculptural furniture, statement art and bespoke functional pieces by Rivya Living Art.',
  },
  {
    path: '/collection',
    title: 'Collection | Resin Furniture, Art & Custom Objects | Rivya Living Art',
    description:
      "Explore Rivya Living Art's collection of resin furniture, collectible objects, 3D + resin designs, statement art, preservation pieces and décor.",
  },
  {
    path: '/custom-commissions',
    title: 'Custom Resin Furniture & Art Commissions | Rivya Living Art',
    description:
      'Start a bespoke resin furniture, statement art or custom object project with Rivya Living Art.',
  },
  {
    path: '/process',
    title: 'Our Process | Rivya Living Art',
    description:
      "Explore the design, material and making process behind Rivya Living Art's resin furniture and custom objects.",
  },
  {
    path: '/portfolio',
    title: 'Selected Works & Projects | Rivya Living Art',
    description:
      'Explore furniture, resin art, material studies and custom projects from Rivya Living Art.',
  },
  {
    path: '/journal',
    title: 'Journal | Resin, Furniture & Material Stories | Rivya Living Art',
    description:
      'Explore ideas, guides and studio notes about resin furniture, materials, 3D fabrication, preservation and contemporary craft.',
  },
  {
    path: '/contact',
    title: 'Contact Rivya Living Art',
    description:
      'Contact Rivya Living Art for custom resin furniture, art, preservation and bespoke project enquiries.',
  },
]

const pathEntry = (p: (typeof PATHS)[number]): SeedRecord => ({
  seedKey: `seo:path${p.path === '/' ? '.home' : p.path.replace(/\//g, '.')}`,
  table: 'seo_entries',
  fields: {
    scope: 'PATH',
    path: p.path,
    title: p.title,
    description: p.description,
    robots: 'index,follow',
    status: 'DRAFT',
    fact_classification: 'SEO_COPY',
    owner_verification: 'NOT_REQUIRED',
  },
})

export const seoSeed: SeedModule = {
  name: 'seo',
  description:
    'The global SEO defaults (§41), keyword themes (§42), social defaults (§44) and 8 per-path entries.',
  records: [
    // --- §41 the one GLOBAL entry ---------------------------------------------------------------
    {
      seedKey: 'seo:global',
      table: 'seo_entries',
      fields: {
        scope: 'GLOBAL',
        title: SITE_NAME,
        description:
          'Rivya Living Art creates resin furniture, collectible objects, statement art and bespoke pieces shaped through material craft and contemporary form.',
        social_title: 'Rivya Living Art — Functional Art & Collectible Furniture',
        social_description:
          'Explore resin furniture, sculptural objects, large-format art and bespoke commissions.',
        robots: 'index,follow',
        // Published: the global fallback is what every page without its own entry renders, and a
        // DRAFT one would leave the whole site with no description at all.
        status: 'PUBLISHED',
        fact_classification: 'SEO_COPY',
        owner_verification: 'NOT_REQUIRED',
      },
    },

    seoGlobal('site_name', SITE_NAME, 'Site name', 'SEED §41.'),
    seoGlobal(
      'title_template',
      `%s | ${SITE_NAME}`,
      'Title template',
      'SEED §41. `%s` is the page title; the template is what puts the brand after it.',
    ),
    seoGlobal(
      'keyword_themes',
      KEYWORD_THEMES.join('\n'),
      'Keyword themes',
      'SEED §42. RESEARCH INPUT, NOT METADATA — nothing renders these. §42 says do not keyword-stuff and that the actual strategy must be refined through research before claiming ranking opportunity. They are here for whoever does that work.',
    ),

    // --- §44 social -----------------------------------------------------------------------------
    socialRow('og_headline', SITE_NAME, 'Social — default headline'),
    socialRow(
      'og_description',
      'Collectible furniture, resin art and bespoke material objects.',
      'Social — default supporting copy',
    ),

    // --- per-path -------------------------------------------------------------------------------
    ...PATHS.map(pathEntry),
  ],
}
