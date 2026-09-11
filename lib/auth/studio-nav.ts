import type { StudioStringKey } from '../../components/studio/strings'
import type { Permission } from './permissions'

/**
 * The D4 Studio route map, once.
 *
 * THIS IS THE ONLY PLACE A STUDIO ROUTE PATH IS WRITTEN DOWN. Not a style preference — a route map
 * duplicated between a sidebar component, a middleware matcher, a permission table and a test is
 * four things that drift, and the drift is invisible until somebody follows a link to a 404 or
 * reaches a page the sidebar swore they could not see. `tests/unit/studio-nav.test.ts` asserts the
 * three-way agreement this file is supposed to guarantee: manifest ↔ the D4 list in
 * CANONICAL-DECISIONS ↔ the `page.tsx` files actually on disk.
 *
 * IT HOLDS NO WORDING. Labels are keys into `components/studio/strings.ts`, which is where Phase 09
 * swaps constants for `global_content` rows. A label typed here would be copy inside the routing
 * layer, and changing "Inquiries" to "Enquiries" would become a code change.
 *
 * VISIBILITY IS NOT AUTHORISATION. `permission` is what the sidebar filters on AND what the page's
 * own `requirePermission()` call demands, but the filtering is presentation only: hiding a link
 * protects nothing, because the URL can still be typed. Every stub generated from this manifest
 * calls `requirePermission()` in its own body, and RLS refuses underneath that.
 *
 * `phases` records which phases build the surface, in order. The first entry is the phase that
 * stops it being a stub — which is what the stub itself displays, so "not built yet" is a specific,
 * checkable statement rather than the words "Coming Soon", which SEED §55 forbids.
 */

/** One D4 leaf: a real route with a real `page.tsx`. */
export type StudioNavLeaf = {
  /** The D4 path. */
  readonly href: string
  /** Key into STUDIO_STRINGS. Never a literal label. */
  readonly labelKey: StudioStringKey
  /** Required to open the page at all. The sidebar filters on this and the page demands it. */
  readonly permission: Permission
  /** Required to change anything here. Absent means the surface is read-only for everyone. */
  readonly writePermission?: Permission
  /** Phases that build this surface, in order; the first is when it stops being a stub. */
  readonly phases: readonly number[]
}

/** One sidebar group. A group is not itself a route — there is no `/studio/catalog` page. */
export type StudioNavGroup = {
  readonly id: string
  readonly labelKey: StudioStringKey
  /** Shared prefix of every leaf below, used for "is this path inside this group". */
  readonly pathPrefix: string
  readonly leaves: readonly StudioNavLeaf[]
}

/**
 * `/studio` itself: the Overview, and the one Studio surface Phase 05 fills rather than stubs.
 *
 * Outside the groups because it is the root of the tree rather than a member of it — putting it in
 * a one-leaf "Overview" group would make the sidebar render a heading above a single link.
 */
export const STUDIO_HOME_LEAF: StudioNavLeaf = {
  href: '/studio',
  labelKey: 'studio.nav.overview',
  permission: 'studio.access',
  phases: [5, 37],
}

export const STUDIO_NAV: readonly StudioNavGroup[] = [
  {
    id: 'catalog',
    labelKey: 'studio.nav.catalog',
    pathPrefix: '/studio/catalog',
    leaves: [
      {
        href: '/studio/catalog/products',
        labelKey: 'studio.nav.catalog.products',
        permission: 'catalog.read',
        writePermission: 'catalog.write',
        phases: [14, 15],
      },
      {
        href: '/studio/catalog/categories',
        labelKey: 'studio.nav.catalog.categories',
        permission: 'catalog.read',
        writePermission: 'catalog.write',
        phases: [14],
      },
      {
        href: '/studio/catalog/collections',
        labelKey: 'studio.nav.catalog.collections',
        permission: 'catalog.read',
        writePermission: 'catalog.write',
        phases: [14, 16],
      },
      {
        href: '/studio/catalog/materials',
        labelKey: 'studio.nav.catalog.materials',
        permission: 'catalog.read',
        writePermission: 'catalog.write',
        phases: [14],
      },
      {
        href: '/studio/catalog/relationships',
        labelKey: 'studio.nav.catalog.relationships',
        permission: 'catalog.read',
        writePermission: 'catalog.write',
        phases: [23],
      },
      {
        href: '/studio/catalog/customization-forms',
        labelKey: 'studio.nav.catalog.customization-forms',
        permission: 'catalog.read',
        writePermission: 'catalog.write',
        phases: [19],
      },
      {
        href: '/studio/catalog/bulk',
        labelKey: 'studio.nav.catalog.bulk',
        permission: 'bulk.execute',
        writePermission: 'bulk.execute',
        phases: [24],
      },
    ],
  },
  {
    id: 'merchandising',
    labelKey: 'studio.nav.merchandising',
    pathPrefix: '/studio/merchandising',
    leaves: [
      {
        href: '/studio/merchandising/homepage',
        labelKey: 'studio.nav.merchandising.homepage',
        permission: 'catalog.read',
        writePermission: 'merchandising.write',
        phases: [22],
      },
      {
        href: '/studio/merchandising/store',
        labelKey: 'studio.nav.merchandising.store',
        permission: 'catalog.read',
        writePermission: 'merchandising.write',
        phases: [22],
      },
      {
        href: '/studio/merchandising/featured',
        labelKey: 'studio.nav.merchandising.featured',
        permission: 'catalog.read',
        writePermission: 'merchandising.write',
        phases: [22],
      },
      {
        href: '/studio/merchandising/scheduling',
        labelKey: 'studio.nav.merchandising.scheduling',
        permission: 'catalog.read',
        writePermission: 'merchandising.write',
        phases: [22],
      },
    ],
  },
  {
    id: 'content',
    labelKey: 'studio.nav.content',
    pathPrefix: '/studio/content',
    leaves: [
      {
        href: '/studio/content/pages',
        labelKey: 'studio.nav.content.pages',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [8, 9],
      },
      {
        href: '/studio/content/homepage',
        labelKey: 'studio.nav.content.homepage',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [8, 11],
      },
      {
        href: '/studio/content/portfolio',
        labelKey: 'studio.nav.content.portfolio',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [17],
      },
      {
        href: '/studio/content/journal',
        labelKey: 'studio.nav.content.journal',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [18],
      },
      /*
       * THE FIRST NON-DYNAMIC SUB-PAGE IN THE STUDIO, and it is a leaf of its own rather than a tab
       * because it edits a different table. `/studio/content/journal` lists articles;
       * `/studio/content/journal/categories` edits the nine subjects they are filed under, which an
       * editor visits rarely and deliberately. Hiding it behind the article list would make the one
       * screen that changes a public URL harder to find than the ones that do not.
       */
      {
        href: '/studio/content/journal/categories',
        labelKey: 'studio.nav.content.journalCategories',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [18],
      },
      {
        href: '/studio/content/testimonials',
        labelKey: 'studio.nav.content.testimonials',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [17],
      },
      {
        href: '/studio/content/faqs',
        labelKey: 'studio.nav.content.faqs',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [8, 9],
      },
      {
        href: '/studio/content/navigation',
        labelKey: 'studio.nav.content.navigation',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [8],
      },
      {
        href: '/studio/content/footer',
        labelKey: 'studio.nav.content.footer',
        permission: 'content.read',
        writePermission: 'content.write',
        phases: [8],
      },
      {
        href: '/studio/content/seo',
        labelKey: 'studio.nav.content.seo',
        permission: 'content.read',
        writePermission: 'seo.write',
        phases: [8, 39],
      },
    ],
  },
  {
    id: 'media',
    labelKey: 'studio.nav.media',
    pathPrefix: '/studio/media',
    leaves: [
      {
        href: '/studio/media/all',
        labelKey: 'studio.nav.media.all',
        permission: 'media.read',
        writePermission: 'media.write',
        phases: [6, 24, 43],
      },
      {
        href: '/studio/media/images',
        labelKey: 'studio.nav.media.images',
        permission: 'media.read',
        writePermission: 'media.write',
        phases: [6],
      },
      {
        href: '/studio/media/videos',
        labelKey: 'studio.nav.media.videos',
        permission: 'media.read',
        writePermission: 'media.write',
        phases: [6],
      },
      {
        href: '/studio/media/models',
        labelKey: 'studio.nav.media.models',
        permission: 'media.read',
        writePermission: 'media.write',
        phases: [6, 21],
      },
      {
        href: '/studio/media/documents',
        labelKey: 'studio.nav.media.documents',
        permission: 'media.read',
        writePermission: 'media.write',
        phases: [6],
      },
      {
        href: '/studio/media/higgsfield',
        labelKey: 'studio.nav.media.higgsfield',
        permission: 'media.read',
        writePermission: 'media.write',
        phases: [7, 43],
      },
      {
        href: '/studio/media/brand',
        labelKey: 'studio.nav.media.brand',
        permission: 'media.read',
        writePermission: 'media.write',
        phases: [6, 43],
      },
    ],
  },
  {
    id: 'inquiries',
    labelKey: 'studio.nav.inquiries',
    pathPrefix: '/studio/inquiries',
    leaves: [
      {
        href: '/studio/inquiries/all',
        labelKey: 'studio.nav.inquiries.all',
        permission: 'inquiries.read',
        writePermission: 'inquiries.write',
        phases: [20],
      },
      {
        href: '/studio/inquiries/product',
        labelKey: 'studio.nav.inquiries.product',
        permission: 'inquiries.read',
        writePermission: 'inquiries.write',
        phases: [20],
      },
      {
        href: '/studio/inquiries/commission',
        labelKey: 'studio.nav.inquiries.commission',
        permission: 'inquiries.read',
        writePermission: 'inquiries.write',
        phases: [20],
      },
      {
        href: '/studio/inquiries/consultation',
        labelKey: 'studio.nav.inquiries.consultation',
        permission: 'inquiries.read',
        writePermission: 'inquiries.write',
        phases: [20],
      },
      {
        href: '/studio/inquiries/quote',
        labelKey: 'studio.nav.inquiries.quote',
        permission: 'inquiries.read',
        writePermission: 'inquiries.write',
        phases: [20],
      },
    ],
  },
  {
    id: 'research',
    labelKey: 'studio.nav.research',
    pathPrefix: '/studio/research',
    leaves: [
      {
        href: '/studio/research/dashboard',
        labelKey: 'studio.nav.research.dashboard',
        permission: 'research.read',
        phases: [25],
      },
      {
        href: '/studio/research/sources',
        labelKey: 'studio.nav.research.sources',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [25, 26],
      },
      {
        href: '/studio/research/scrape',
        labelKey: 'studio.nav.research.scrape',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [25],
      },
      {
        href: '/studio/research/jobs',
        labelKey: 'studio.nav.research.jobs',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [25],
      },
      {
        href: '/studio/research/runs',
        labelKey: 'studio.nav.research.runs',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [25, 27],
      },
      {
        href: '/studio/research/changes',
        labelKey: 'studio.nav.research.changes',
        permission: 'research.read',
        writePermission: 'research.confirm',
        phases: [29],
      },
      {
        href: '/studio/research/explorer',
        labelKey: 'studio.nav.research.explorer',
        permission: 'research.read',
        writePermission: 'research.confirm',
        phases: [28, 29],
      },
      {
        href: '/studio/research/large-format',
        labelKey: 'studio.nav.research.large-format',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [30],
      },
      {
        href: '/studio/research/compare',
        labelKey: 'studio.nav.research.compare',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [31],
      },
      {
        href: '/studio/research/similarity',
        labelKey: 'studio.nav.research.similarity',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [33],
      },
      {
        href: '/studio/research/opportunities',
        labelKey: 'studio.nav.research.opportunities',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [32, 34],
      },
      /*
       * Phase 34. The phase document mounts direction briefs as a nested segment of the
       * opportunities leaf; the manifest test governs every static route and a static child of a
       * static leaf must be named here, so the list is a leaf of its own (amendment A34). The
       * `[briefId]` editor sits directly beneath it and is governed through it.
       */
      {
        href: '/studio/research/opportunities/direction',
        labelKey: 'studio.nav.research.direction',
        permission: 'research.read',
        writePermission: 'research.direction.write',
        phases: [34],
      },
      {
        href: '/studio/research/shortlist',
        labelKey: 'studio.nav.research.shortlist',
        permission: 'research.read',
        writePermission: 'research.confirm',
        phases: [35],
      },
      {
        href: '/studio/research/confirmed',
        labelKey: 'studio.nav.research.confirmed',
        permission: 'research.read',
        writePermission: 'research.confirm',
        phases: [35],
      },
      {
        href: '/studio/research/sheets',
        labelKey: 'studio.nav.research.sheets',
        permission: 'research.read',
        writePermission: 'research.write',
        phases: [36],
      },
    ],
  },
  {
    id: 'operations',
    labelKey: 'studio.nav.operations',
    pathPrefix: '/studio/operations',
    leaves: [
      {
        href: '/studio/operations/workflows',
        labelKey: 'studio.nav.operations.workflows',
        permission: 'operations.logs.read',
        phases: [38],
      },
      {
        href: '/studio/operations/data-quality',
        labelKey: 'studio.nav.operations.data-quality',
        permission: 'catalog.read',
        phases: [14, 28],
      },
      {
        href: '/studio/operations/imports',
        labelKey: 'studio.nav.operations.imports',
        permission: 'bulk.execute',
        writePermission: 'bulk.execute',
        phases: [24],
      },
      {
        href: '/studio/operations/exports',
        labelKey: 'studio.nav.operations.exports',
        permission: 'bulk.execute',
        writePermission: 'bulk.execute',
        phases: [24],
      },
      {
        href: '/studio/operations/audit',
        labelKey: 'studio.nav.operations.audit',
        permission: 'operations.audit.read',
        phases: [4, 24],
      },
      {
        href: '/studio/operations/logs',
        labelKey: 'studio.nav.operations.logs',
        permission: 'operations.logs.read',
        phases: [38],
      },
    ],
  },
  {
    id: 'system',
    labelKey: 'studio.nav.system',
    pathPrefix: '/studio/system',
    leaves: [
      {
        href: '/studio/system/users',
        labelKey: 'studio.nav.system.users',
        permission: 'system.users.manage',
        writePermission: 'system.users.manage',
        phases: [4],
      },
      {
        href: '/studio/system/settings',
        labelKey: 'studio.nav.system.settings',
        permission: 'system.settings.write',
        writePermission: 'system.settings.write',
        phases: [20, 23, 29, 30],
      },
      {
        href: '/studio/system/integrations',
        labelKey: 'studio.nav.system.integrations',
        permission: 'system.settings.write',
        writePermission: 'system.settings.write',
        phases: [36, 38],
      },
      {
        href: '/studio/system/environment',
        labelKey: 'studio.nav.system.environment',
        permission: 'system.environment.read',
        phases: [38, 41, 44],
      },
      {
        href: '/studio/system/documentation',
        labelKey: 'studio.nav.system.documentation',
        permission: 'system.docs.read',
        phases: [38, 46],
      },
      {
        href: '/studio/system/flags',
        labelKey: 'studio.nav.system.flags',
        permission: 'studio.access',
        writePermission: 'system.flags.write',
        phases: [19, 38],
      },
    ],
  },
] as const

/** Every leaf, `/studio` included. The flat view most callers want. */
export const STUDIO_LEAVES: readonly StudioNavLeaf[] = [
  STUDIO_HOME_LEAF,
  ...STUDIO_NAV.flatMap((group) => group.leaves),
]

/** Every route path in the Studio, in manifest order. */
export const STUDIO_PATHS: readonly string[] = STUDIO_LEAVES.map((leaf) => leaf.href)

/**
 * The leaf that owns a path, by longest matching prefix.
 *
 * Longest rather than first, so `/studio/catalog/products/some-id` resolves to the products leaf
 * and not to `/studio`. A shortest-prefix match would gate every nested detail route on
 * `studio.access`, which every role holds — turning a future product editor into a page any viewer
 * could open.
 */
export function leafForPath(path: string): StudioNavLeaf | null {
  let best: StudioNavLeaf | null = null
  for (const leaf of STUDIO_LEAVES) {
    if (path !== leaf.href && !path.startsWith(`${leaf.href}/`)) continue
    if (best === null || leaf.href.length > best.href.length) best = leaf
  }
  return best
}

/** The group a path belongs to, or null for `/studio` itself. */
export function groupForPath(path: string): StudioNavGroup | null {
  return (
    STUDIO_NAV.find(
      (group) => path === group.pathPrefix || path.startsWith(`${group.pathPrefix}/`),
    ) ?? null
  )
}

/** Is this surface still a stub? True until the phase that fills it has been built. */
export function isStub(leaf: StudioNavLeaf, builtThroughPhase: number): boolean {
  const first = leaf.phases[0]
  return first === undefined ? true : first > builtThroughPhase
}
