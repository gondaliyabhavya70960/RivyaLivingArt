/**
 * EVERY ID THE TEST FIXTURE OWNS — Phase 42.
 *
 * A test that writes `'00000000-…-b1'` inline is a test nobody can safely change. Six months later
 * the row is renamed, four files still name the literal, and the failure they produce says
 * "expected 1 row, got 0" rather than "this id moved". So the ids live here, the seeder reads them
 * from here, and the suites import them.
 *
 * THE PREFIX IS THE POINT. Every fixture id begins `f0000000-0000-4000-8000-`, which
 * `scripts/test/check-fixture-isolation.mjs` greps for across the product. A fixture id appearing
 * in `lib/`, `app/`, `components/` or `content/` means test data has been wired into the running
 * product — the failure mode where a demo row becomes a real one because somebody hard-coded its
 * id to make a page render.
 *
 * THEY ARE VALID v4 UUIDs. The third group opens `4` and the fourth `8`, which is what the variant
 * demands; PostgreSQL would take anything, but `crypto.randomUUID`-shaped ids keep a fixture row
 * indistinguishable from a real one everywhere EXCEPT the prefix, which is exactly the property a
 * realistic fixture needs.
 *
 * THE LAST TWELVE DIGITS READ AS DECIMAL, four for the group and eight for the index, because 0–9
 * are also hex. `f0000000-0000-4000-8000-000200000003` is group 2, item 3 — the third product — and
 * a person reading a failing assertion can tell that without opening this file.
 */

/** Group number → what it holds. Also the order the seeder writes them in. */
export const FIXTURE_GROUP = {
  staff: 1,
  product: 2,
  collection: 3,
  project: 4,
  article: 5,
  faq: 6,
  inquiry: 7,
  researchSource: 8,
  researchRun: 9,
  researchProduct: 10,
  media: 11,
  category: 12,
} as const

export type FixtureGroup = keyof typeof FIXTURE_GROUP

/** The one place a fixture id is constructed. */
export function fixtureId(group: FixtureGroup, index: number): string {
  const g = String(FIXTURE_GROUP[group]).padStart(4, '0')
  const i = String(index).padStart(8, '0')
  return `f0000000-0000-4000-8000-${g}${i}`
}

/** True for an id this fixture owns. Used by the seeder's wipe and by the isolation gate. */
export const FIXTURE_ID_PREFIX = 'f0000000-0000-4000-8000-'
export const isFixtureId = (value: string): boolean => value.startsWith(FIXTURE_ID_PREFIX)

/**
 * ONE STAFF USER PER ROLE, so an authorisation test can name the role it means rather than a user.
 *
 * There is no suspended user here and that is deliberate: `tests/unit/rls/harness.ts` already owns
 * the suspension case with its own users, and two fixtures both inserting a suspended admin into
 * `staff_profiles` would fight over the last-owner trigger.
 */
export const FIXTURE_STAFF = {
  owner: fixtureId('staff', 1),
  admin: fixtureId('staff', 2),
  editor: fixtureId('staff', 3),
  merchandiser: fixtureId('staff', 4),
  researcher: fixtureId('staff', 5),
  viewer: fixtureId('staff', 6),
} as const

export type FixtureRole = keyof typeof FIXTURE_STAFF

/** The email each fixture user signs in with. `@fixture.test` is reserved by RFC 2606. */
export const FIXTURE_EMAIL: Record<FixtureRole, string> = {
  owner: 'owner@fixture.test',
  admin: 'admin@fixture.test',
  editor: 'editor@fixture.test',
  merchandiser: 'merchandiser@fixture.test',
  researcher: 'researcher@fixture.test',
  viewer: 'viewer@fixture.test',
}

/**
 * FOUR PRODUCTS, ONE PER `price_state`, and the count is a rule rather than a convenience.
 *
 * Every price surface in the product — the card, the detail page, the JSON-LD builder, the inquiry
 * form's opening line — branches on this enum, and the branch nobody tests is the one that ships a
 * price for a product that has none. Four products means every branch has a row.
 */
export const FIXTURE_PRODUCTS = {
  startingFrom: fixtureId('product', 1),
  requestQuote: fixtureId('product', 2),
  priceOnRequest: fixtureId('product', 3),
  fixed: fixtureId('product', 4),
} as const

export const FIXTURE_PRODUCT_SLUG = {
  startingFrom: 'fixture-resin-dining-table',
  requestQuote: 'fixture-timber-console',
  priceOnRequest: 'fixture-collectible-bench',
  fixed: 'fixture-resin-coaster-set',
} as const

export const FIXTURE_COLLECTION = fixtureId('collection', 1)
export const FIXTURE_COLLECTION_SLUG = 'fixture-river-series'

export const FIXTURE_PROJECT = fixtureId('project', 1)
export const FIXTURE_PROJECT_SLUG = 'fixture-studio-commission'

export const FIXTURE_ARTICLES = {
  published: fixtureId('article', 1),
  draft: fixtureId('article', 2),
} as const

export const FIXTURE_ARTICLE_SLUG = {
  published: 'fixture-choosing-a-resin-table',
  draft: 'fixture-inside-the-workshop',
} as const

/** Ten FAQs: enough that the accordion's keyboard behaviour is exercised past the first item. */
export const FIXTURE_FAQ_COUNT = 10
export const FIXTURE_FAQS = Array.from({ length: FIXTURE_FAQ_COUNT }, (_, index) =>
  fixtureId('faq', index + 1),
)

/**
 * FIVE INQUIRIES, ONE PER PIPELINE STATUS, so the Studio list has something in every column and the
 * status filter has something to filter.
 */
export const FIXTURE_INQUIRIES = {
  new: fixtureId('inquiry', 1),
  contacted: fixtureId('inquiry', 2),
  qualified: fixtureId('inquiry', 3),
  won: fixtureId('inquiry', 4),
  lost: fixtureId('inquiry', 5),
} as const

/**
 * Reference codes. A trigger allocates these from a sequence in production, and the fixture states
 * its own so a test can assert one.
 *
 * THE 900000 BLOCK IS RESERVED FOR THE FIXTURE and sits far above anything the sequence will reach,
 * so a fixture code can never collide with a real enquiry's. They still match
 * `inquiries_reference_shape` — a fixture that had to relax a production constraint to exist would
 * be testing a database this project does not ship.
 */
export const FIXTURE_INQUIRY_REFERENCE = {
  new: 'RIV-2026-900001',
  contacted: 'RIV-2026-900002',
  qualified: 'RIV-2026-900003',
  won: 'RIV-2026-900004',
  lost: 'RIV-2026-900005',
} as const

export const FIXTURE_RESEARCH_SOURCE = fixtureId('researchSource', 1)
export const FIXTURE_RESEARCH_SOURCE_SLUG = 'fixture-source'
export const FIXTURE_RESEARCH_RUN = fixtureId('researchRun', 1)

/**
 * TWENTY RESEARCH PRODUCTS, because the analytics floor is twelve.
 *
 * `lib/scraper/analytics/*` refuses to compute a statistic from fewer than twelve observations and
 * reports `INSUFFICIENT SAMPLE` instead. A fixture of ten would make every analytics assertion a
 * test of the refusal path. Twenty clears the floor with room for a filter to exclude a few.
 */
export const FIXTURE_RESEARCH_PRODUCT_COUNT = 20
export const FIXTURE_RESEARCH_PRODUCTS = Array.from(
  { length: FIXTURE_RESEARCH_PRODUCT_COUNT },
  (_, index) => fixtureId('researchProduct', index + 1),
)

/**
 * TWELVE MEDIA ASSETS, each mirroring a real manifest asset.
 *
 * The `publicId` is the manifest's own, so a fixture page requests exactly the URL the real page
 * would and `tests/support/media-route.ts` can serve a committed derivative for it. A fixture that
 * invented its own public ids would exercise a URL shape that never ships.
 */
export interface FixtureMedia {
  readonly id: string
  /** `rivya_asset_id` in `data/higgsfield/asset-manifest.json`. */
  readonly assetId: string
  readonly publicId: string
  readonly width: number
  readonly height: number
  /**
   * The committed stand-in under `tests/fixtures/media/`.
   *
   * A PNG, where the manifest asset is a WebP: these are generated locally and byte-stable rather
   * than fetched, and the extension says which of the two a reader is looking at.
   */
  readonly file: string
}

export const FIXTURE_MEDIA: readonly FixtureMedia[] = [
  {
    id: fixtureId('media', 1),
    assetId: 'LARGEFORMAT-DINING-003',
    publicId: 'rivya/large-format/dining/largeformat-dining-003-16x9',
    width: 2048,
    height: 1152,
    file: 'largeformat-dining-003-16x9.png',
  },
  {
    id: fixtureId('media', 2),
    assetId: 'LARGEFORMAT-CONSOLE-001',
    publicId: 'rivya/large-format/console/largeformat-console-001-16x9',
    width: 5504,
    height: 3072,
    file: 'largeformat-console-001-16x9.png',
  },
  {
    id: fixtureId('media', 3),
    assetId: 'LARGEFORMAT-SEATING-001',
    publicId: 'rivya/large-format/seating/largeformat-seating-001-4x5',
    width: 3712,
    height: 4608,
    file: 'largeformat-seating-001-4x5.png',
  },
  {
    id: fixtureId('media', 4),
    assetId: 'LARGEFORMAT-SIDE-001',
    publicId: 'rivya/large-format/side/largeformat-side-001-4x5',
    width: 3712,
    height: 4608,
    file: 'largeformat-side-001-4x5.png',
  },
  {
    id: fixtureId('media', 5),
    assetId: 'GALLERY-SCENE-003',
    publicId: 'rivya/portfolio/gallery/gallery-scene-003-16x9',
    width: 2688,
    height: 1536,
    file: 'gallery-scene-003-16x9.png',
  },
  {
    id: fixtureId('media', 6),
    assetId: 'INTERIOR-LIFESTYLE-005',
    publicId: 'rivya/interior/interior-lifestyle-005-16x9',
    width: 2048,
    height: 1152,
    file: 'interior-lifestyle-005-16x9.png',
  },
  {
    id: fixtureId('media', 7),
    assetId: 'PROCESS-STUDIO-001',
    publicId: 'rivya/process/studio/process-studio-001-4x3',
    width: 4800,
    height: 3584,
    file: 'process-studio-001-4x3.png',
  },
  {
    id: fixtureId('media', 8),
    assetId: 'PROCESS-TIMBER-001',
    publicId: 'rivya/process/timber/process-timber-001-4x5',
    width: 3712,
    height: 4608,
    file: 'process-timber-001-4x5.png',
  },
  {
    id: fixtureId('media', 9),
    assetId: 'MATERIAL-MACRO-001',
    publicId: 'rivya/material/material-macro-001-1x1',
    width: 4096,
    height: 4096,
    file: 'material-macro-001-1x1.png',
  },
  {
    id: fixtureId('media', 10),
    assetId: 'MATERIAL-MACRO-008',
    publicId: 'rivya/material/material-macro-008-16x9',
    width: 2752,
    height: 1536,
    file: 'material-macro-008-16x9.png',
  },
  {
    id: fixtureId('media', 11),
    assetId: 'EDITORIAL-003',
    publicId: 'rivya/journal/editorial/editorial-003-16x9',
    width: 2752,
    height: 1536,
    file: 'editorial-003-16x9.png',
  },
  {
    id: fixtureId('media', 12),
    assetId: 'EDITORIAL-001',
    publicId: 'rivya/journal/editorial/editorial-001-4x5',
    width: 3712,
    height: 4608,
    file: 'editorial-001-4x5.png',
  },
]

/**
 * THE CLOCK EVERY FIXTURE ROW IS DATED FROM.
 *
 * A visual snapshot of a page showing "3 days ago" is a snapshot that fails on the fourth day. A
 * coverage figure computed over "the last 30 days" moves every night. So every timestamp the seeder
 * writes is derived from this instant, and a suite that needs "now" freezes to it too.
 *
 * IT IS IN THE PAST, not the future: a `published_at` after `now()` is refused by more than one
 * publish gate, and a research run that has not happened yet is not a run.
 */
export const FIXTURE_NOW = '2026-01-15T12:00:00.000Z'
export const fixtureNow = (): Date => new Date(FIXTURE_NOW)

/** Offset from the frozen clock, in days. Negative is earlier. */
export const fixtureDate = (days: number): Date =>
  new Date(fixtureNow().getTime() + days * 24 * 60 * 60 * 1000)
